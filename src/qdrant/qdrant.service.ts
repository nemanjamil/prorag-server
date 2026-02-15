import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';
import { randomUUID } from 'crypto';
import { Chunk } from '../chunking/chunking.service.js';
import { ChunkStrategy } from '../common/enums/chunk-strategy.enum.js';

export interface QdrantSearchResult {
  id: string;
  score: number;
  documentId: number;
  chunkIndex: number;
  pageNumber: number | null;
  text: string;
  chunkStrategy: string;
}

const COLLECTION_NAME = 'pdf_documents';
const VECTOR_SIZE = 3072;
const UPSERT_BATCH_SIZE = 100;

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private readonly client: QdrantClient;

  constructor(private config: ConfigService) {
    this.client = new QdrantClient({
      url: this.config.get<string>('qdrant.url'),
    });
  }

  async onModuleInit() {
    await this.ensureCollection(COLLECTION_NAME, VECTOR_SIZE);
  }

  async ensureCollection(name: string, vectorSize = VECTOR_SIZE): Promise<void> {
    try {
      await this.client.getCollection(name);
      this.logger.log(`Qdrant collection "${name}" already exists`);
    } catch {
      this.logger.log(`Creating Qdrant collection "${name}" (${vectorSize}-dim, cosine)`);
      await this.client.createCollection(name, {
        vectors: {
          size: vectorSize,
          distance: 'Cosine',
        },
      });
      this.logger.log(`Qdrant collection "${name}" created`);
    }
  }

  async upsertChunks(
    documentId: number,
    chunks: Chunk[],
    vectors: number[][],
    chunkStrategy: ChunkStrategy,
    collection = COLLECTION_NAME,
  ): Promise<number> {
    if (chunks.length === 0) return 0;

    const points = chunks.map((chunk, i) => ({
      id: randomUUID(),
      vector: vectors[i],
      payload: {
        document_id: documentId,
        chunk_index: chunk.chunkIndex,
        page_number: chunk.pageNumber,
        text_content: chunk.text,
        chunk_strategy: chunkStrategy,
      },
    }));

    for (let i = 0; i < points.length; i += UPSERT_BATCH_SIZE) {
      const batch = points.slice(i, i + UPSERT_BATCH_SIZE);
      await this.client.upsert(collection, { wait: true, points: batch });
      this.logger.log(
        `Upserted batch ${Math.floor(i / UPSERT_BATCH_SIZE) + 1}/${Math.ceil(points.length / UPSERT_BATCH_SIZE)} (${batch.length} points) for document ${documentId}`,
      );
    }

    return points.length;
  }

  async deleteByDocumentId(
    documentId: number,
    collection = COLLECTION_NAME,
  ): Promise<void> {
    await this.client.delete(collection, {
      wait: true,
      filter: {
        must: [
          {
            key: 'document_id',
            match: { value: documentId },
          },
        ],
      },
    });
    this.logger.log(`Deleted Qdrant points for document ${documentId}`);
  }

  async search(
    vector: number[],
    topK: number,
    filter?: Record<string, any>,
    collection = COLLECTION_NAME,
  ): Promise<QdrantSearchResult[]> {
    const results = await this.client.search(collection, {
      vector,
      limit: topK,
      with_payload: true,
      filter: filter || undefined,
    });

    return results.map((point) => {
      const payload = point.payload as Record<string, any>;
      return {
        id: String(point.id),
        score: point.score,
        documentId: payload.document_id as number,
        chunkIndex: payload.chunk_index as number,
        pageNumber: payload.page_number as number | null,
        text: payload.text_content as string,
        chunkStrategy: payload.chunk_strategy as string,
      };
    });
  }
}
