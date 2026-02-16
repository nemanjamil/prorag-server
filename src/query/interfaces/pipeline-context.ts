import { SearchMode } from '../../common/enums/search-mode.enum.js';
import { QueryStrategy } from '../../common/enums/query-strategy.enum.js';

export interface RetrievedChunk {
  documentId: number;
  chunkIndex: number;
  pageNumber: number | null;
  text: string;
  chunkStrategy: string;
  vectorRank: number | null;
  vectorScore: number | null;
  bm25Rank: number | null;
  bm25Score: number | null;
  rrfScore: number | null;
  rerankerScore: number | null;
  source: 'vector' | 'bm25' | 'both';
}

export interface PipelineSettings {
  searchMode: SearchMode;
  queryStrategy: QueryStrategy;
  rerankerEnabled: boolean;
  temperature: number;
  retrievalTopK: number;
  rerankerTopN: number;
  documentIds: number[] | null;
  promptTemplateId: number | null;
  llmModel: string;
}

export interface PipelineTimings {
  transformationMs: number;
  embeddingMs: number;
  retrievalMs: number;
  rerankingMs: number;
  generationMs: number;
  totalMs: number;
}

export interface PipelineMetadata {
  timings: Omit<PipelineTimings, 'generationMs' | 'totalMs'>;
  retrievedChunks: RetrievedChunk[];
  settings: PipelineSettings;
  transformedQueries: string[];
}

export type SseEvent =
  | { type: 'metadata'; data: PipelineMetadata }
  | { type: 'token'; data: { token: string } }
  | { type: 'done'; data: { answerText: string; queryLogId: number; finalCostUsd: number } }
  | { type: 'error'; data: { message: string } };

export interface SseEmitter {
  emit: (event: SseEvent) => void;
}
