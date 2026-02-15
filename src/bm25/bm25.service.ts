import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentsService } from '../documents/documents.service.js';
import { DocumentStatus } from '../common/enums/document-status.enum.js';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../database/entities/document.entity.js';

export interface Bm25SearchResult {
  documentId: number;
  chunkIndex: number;
  score: number;
  text: string;
}

interface IndexedChunk {
  documentId: number;
  chunkIndex: number;
  text: string;
  tokens: string[];
  length: number;
}

@Injectable()
export class Bm25Service implements OnModuleInit {
  private readonly logger = new Logger(Bm25Service.name);
  private readonly k1: number;
  private readonly b: number;

  private documents = new Map<number, IndexedChunk[]>();
  private invertedIndex = new Map<string, Map<string, number>>();
  private avgDocLength = 0;
  private totalChunks = 0;

  constructor(
    private config: ConfigService,
    @InjectRepository(Document)
    private documentRepo: Repository<Document>,
    @Inject(forwardRef(() => DocumentsService))
    private documentsService: DocumentsService,
  ) {
    this.k1 = this.config.get<number>('bm25.k1') || 1.2;
    this.b = this.config.get<number>('bm25.b') || 0.75;
  }

  async onModuleInit() {
    await this.rebuildFromDatabase();
  }

  private async rebuildFromDatabase(): Promise<void> {
    const readyDocs = await this.documentRepo.find({
      where: { status: DocumentStatus.READY },
    });

    this.logger.log(`Rebuilding BM25 index from ${readyDocs.length} READY documents`);

    for (const doc of readyDocs) {
      try {
        const chunks = await this.documentsService.getChunks(doc.id);
        this.addDocumentInternal(doc.id, chunks.map((c) => ({ text: c.text, chunkIndex: c.chunkIndex })));
      } catch (error: any) {
        this.logger.warn(`Failed to index document ${doc.id} for BM25: ${error.message}`);
      }
    }

    this.buildInvertedIndex();
    this.logger.log(`BM25 index built: ${this.totalChunks} chunks across ${this.documents.size} documents`);
  }

  addDocument(documentId: number, chunks: { text: string; chunkIndex: number }[]): void {
    this.addDocumentInternal(documentId, chunks);
    this.buildInvertedIndex();
    this.logger.log(`BM25: added document ${documentId} (${chunks.length} chunks)`);
  }

  removeDocument(documentId: number): void {
    this.documents.delete(documentId);
    this.buildInvertedIndex();
    this.logger.log(`BM25: removed document ${documentId}`);
  }

  search(query: string, topK = 20): Bm25SearchResult[] {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const scores: Bm25SearchResult[] = [];

    for (const [documentId, chunks] of this.documents) {
      for (const chunk of chunks) {
        const score = this.scoreChunk(chunk, queryTokens);
        if (score > 0) {
          scores.push({
            documentId,
            chunkIndex: chunk.chunkIndex,
            score,
            text: chunk.text,
          });
        }
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }

  private addDocumentInternal(
    documentId: number,
    chunks: { text: string; chunkIndex: number }[],
  ): void {
    const indexedChunks: IndexedChunk[] = chunks.map((c) => {
      const tokens = this.tokenize(c.text);
      return {
        documentId,
        chunkIndex: c.chunkIndex,
        text: c.text,
        tokens,
        length: tokens.length,
      };
    });
    this.documents.set(documentId, indexedChunks);
  }

  private buildInvertedIndex(): void {
    this.invertedIndex.clear();
    this.totalChunks = 0;
    let totalLength = 0;

    for (const [, chunks] of this.documents) {
      for (const chunk of chunks) {
        this.totalChunks++;
        totalLength += chunk.length;

        const chunkKey = `${chunk.documentId}:${chunk.chunkIndex}`;
        const termFreqs = new Map<string, number>();

        for (const token of chunk.tokens) {
          termFreqs.set(token, (termFreqs.get(token) || 0) + 1);
        }

        for (const [term, freq] of termFreqs) {
          if (!this.invertedIndex.has(term)) {
            this.invertedIndex.set(term, new Map());
          }
          this.invertedIndex.get(term)!.set(chunkKey, freq);
        }
      }
    }

    this.avgDocLength = this.totalChunks > 0 ? totalLength / this.totalChunks : 0;
  }

  private scoreChunk(chunk: IndexedChunk, queryTokens: string[]): number {
    let score = 0;
    const chunkKey = `${chunk.documentId}:${chunk.chunkIndex}`;

    for (const term of queryTokens) {
      const docFreq = this.invertedIndex.get(term);
      if (!docFreq) continue;

      const tf = docFreq.get(chunkKey) || 0;
      if (tf === 0) continue;

      const df = docFreq.size;
      const idf = this.calculateIdf(df);
      const tfNorm =
        (tf * (this.k1 + 1)) /
        (tf + this.k1 * (1 - this.b + this.b * (chunk.length / this.avgDocLength)));

      score += idf * tfNorm;
    }

    return score;
  }

  private calculateIdf(df: number): number {
    return Math.log(1 + (this.totalChunks - df + 0.5) / (df + 0.5));
  }

  tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0);
  }
}
