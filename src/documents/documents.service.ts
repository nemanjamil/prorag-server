import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PDFParse } from 'pdf-parse';
import * as fs from 'fs';
import { Document } from '../database/entities/document.entity.js';
import { ChunkingService, Chunk } from '../chunking/chunking.service.js';
import { EmbeddingService } from '../embedding/embedding.service.js';
import { QdrantService } from '../qdrant/qdrant.service.js';
import { Bm25Service } from '../bm25/bm25.service.js';
import { DocumentStatus } from '../common/enums/document-status.enum.js';
import { ChunkStrategy } from '../common/enums/chunk-strategy.enum.js';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private documentRepo: Repository<Document>,
    private chunkingService: ChunkingService,
    private embeddingService: EmbeddingService,
    private qdrantService: QdrantService,
    @Inject(forwardRef(() => Bm25Service))
    private bm25Service: Bm25Service,
    private config: ConfigService,
  ) {}

  async upload(
    file: Express.Multer.File,
    chunkStrategy?: ChunkStrategy,
    chunkSize?: number,
    chunkOverlap?: number,
  ): Promise<{ document: Document; chunks: Chunk[] }> {
    const strategy =
      chunkStrategy ||
      (this.config.get<string>('DEFAULT_CHUNK_STRATEGY') as ChunkStrategy) ||
      ChunkStrategy.RECURSIVE;
    const size = chunkSize || this.config.get<number>('DEFAULT_CHUNK_SIZE') || 512;
    const overlap =
      chunkOverlap || this.config.get<number>('DEFAULT_CHUNK_OVERLAP') || 50;

    const doc = this.documentRepo.create({
      originalFilename: file.originalname,
      storagePath: file.path,
      fileSizeBytes: file.size,
      chunkStrategy: strategy,
      chunkSize: size,
      chunkOverlap: overlap,
      status: DocumentStatus.PENDING,
    });
    await this.documentRepo.save(doc);

    try {
      doc.status = DocumentStatus.PROCESSING;
      await this.documentRepo.save(doc);

      const pages = await this.parsePdf(file.path);

      doc.pageCount = pages.length;
      const chunks = this.chunkingService.chunk(pages, strategy, size, overlap);

      // Embed chunks
      const chunkTexts = chunks.map((c) => c.text);
      const { vectors, totalTokens } = await this.embeddingService.embedBatch(chunkTexts);
      this.logger.log(
        `Embedded ${chunks.length} chunks for document ${doc.id} (${totalTokens} tokens)`,
      );

      // Index in Qdrant
      await this.qdrantService.upsertChunks(doc.id, chunks, vectors, strategy);

      // Add to BM25 index
      this.bm25Service.addDocument(
        doc.id,
        chunks.map((c) => ({ text: c.text, chunkIndex: c.chunkIndex })),
      );

      doc.chunkCount = chunks.length;
      doc.status = DocumentStatus.READY;
      await this.documentRepo.save(doc);

      return { document: doc, chunks };
    } catch (error: any) {
      this.logger.error(`Failed to process document ${doc.id}: ${error.message}`);
      doc.status = DocumentStatus.ERROR;
      doc.errorMessage = error.message;
      await this.documentRepo.save(doc);
      throw new BadRequestException(`PDF processing failed: ${error.message}`);
    }
  }

  async findAll(): Promise<Document[]> {
    return this.documentRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: number): Promise<Document> {
    const doc = await this.documentRepo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException(`Document #${id} not found`);
    return doc;
  }

  async remove(id: number): Promise<void> {
    const doc = await this.findOne(id);

    // Remove from Qdrant
    await this.qdrantService.deleteByDocumentId(doc.id);

    // Remove from BM25
    this.bm25Service.removeDocument(doc.id);

    if (fs.existsSync(doc.storagePath)) {
      fs.unlinkSync(doc.storagePath);
    }

    await this.documentRepo.remove(doc);
  }

  async getChunks(id: number): Promise<Chunk[]> {
    const doc = await this.findOne(id);

    if (doc.status !== DocumentStatus.READY) {
      throw new BadRequestException(
        `Document #${id} is not ready (status: ${doc.status})`,
      );
    }

    const pages = await this.parsePdf(doc.storagePath);
    return this.chunkingService.chunk(
      pages,
      doc.chunkStrategy,
      doc.chunkSize,
      doc.chunkOverlap,
    );
  }

  async previewChunks(
    id: number,
    strategy: ChunkStrategy,
    chunkSize: number,
    chunkOverlap: number,
  ) {
    const doc = await this.findOne(id);

    if (doc.status !== DocumentStatus.READY) {
      throw new BadRequestException(
        `Document #${id} is not ready (status: ${doc.status})`,
      );
    }

    const pages = await this.parsePdf(doc.storagePath);
    const chunks = this.chunkingService.chunk(pages, strategy, chunkSize, chunkOverlap);

    const lengths = chunks.map((c) => c.text.length);
    const totalChars = lengths.reduce((a, b) => a + b, 0);

    return {
      chunks,
      stats: {
        count: chunks.length,
        avgLength: chunks.length ? Math.round(totalChars / chunks.length) : 0,
        minLength: chunks.length ? Math.min(...lengths) : 0,
        maxLength: chunks.length ? Math.max(...lengths) : 0,
        totalChars,
      },
    };
  }

  async rechunk(
    id: number,
    strategy: ChunkStrategy,
    chunkSize: number,
    chunkOverlap: number,
  ): Promise<{ document: Document; chunks: Chunk[] }> {
    const doc = await this.findOne(id);

    // Remove old vectors and BM25 entries
    await this.qdrantService.deleteByDocumentId(doc.id);
    this.bm25Service.removeDocument(doc.id);

    const pages = await this.parsePdf(doc.storagePath);
    const chunks = this.chunkingService.chunk(pages, strategy, chunkSize, chunkOverlap);

    // Re-embed and re-index
    const chunkTexts = chunks.map((c) => c.text);
    const { vectors, totalTokens } = await this.embeddingService.embedBatch(chunkTexts);
    this.logger.log(
      `Re-embedded ${chunks.length} chunks for document ${doc.id} (${totalTokens} tokens)`,
    );

    await this.qdrantService.upsertChunks(doc.id, chunks, vectors, strategy);
    this.bm25Service.addDocument(
      doc.id,
      chunks.map((c) => ({ text: c.text, chunkIndex: c.chunkIndex })),
    );

    doc.chunkStrategy = strategy;
    doc.chunkSize = chunkSize;
    doc.chunkOverlap = chunkOverlap;
    doc.chunkCount = chunks.length;
    doc.status = DocumentStatus.READY;
    await this.documentRepo.save(doc);

    return { document: doc, chunks };
  }

  async parsePdf(
    filePath: string,
  ): Promise<{ pageNumber: number; text: string }[]> {
    const buffer = fs.readFileSync(filePath);
    const uint8 = new Uint8Array(buffer);
    const parser = new PDFParse(uint8);

    try {
      const result = await parser.getText();

      return result.pages.map((page: { text: string; num: number }) => ({
        pageNumber: page.num,
        text: page.text,
      }));
    } finally {
      parser.destroy();
    }
  }
}
