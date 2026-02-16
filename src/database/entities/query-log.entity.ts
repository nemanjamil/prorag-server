import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { SearchMode } from '../../common/enums/search-mode.enum.js';
import { QueryStrategy } from '../../common/enums/query-strategy.enum.js';

@Entity('query_logs')
export class QueryLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'query_text', type: 'text' })
  queryText: string;

  @Column({ name: 'answer_text', type: 'text', nullable: true })
  answerText: string | null;

  @Column({
    name: 'query_strategy',
    type: 'enum',
    enum: QueryStrategy,
    default: QueryStrategy.DIRECT,
  })
  queryStrategy: QueryStrategy;

  @Column({
    name: 'search_mode',
    type: 'enum',
    enum: SearchMode,
    default: SearchMode.HYBRID,
  })
  searchMode: SearchMode;

  @Column({ name: 'reranker_enabled', type: 'boolean', default: true })
  rerankerEnabled: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.1 })
  temperature: number;

  @Column({ name: 'retrieval_top_k', type: 'int', default: 20 })
  retrievalTopK: number;

  @Column({ name: 'reranker_top_n', type: 'int', default: 5 })
  rerankerTopN: number;

  @Column({ name: 'llm_model', type: 'varchar', length: 100, default: 'gpt-4o' })
  llmModel: string;

  @Column({ name: 'prompt_template_id', type: 'int', nullable: true })
  promptTemplateId: number | null;

  @Column({ name: 'transformation_ms', type: 'int', nullable: true })
  transformationMs: number | null;

  @Column({ name: 'transformed_queries', type: 'json', nullable: true })
  transformedQueries: string[] | null;

  @Column({ name: 'query_embedding_ms', type: 'int', nullable: true })
  queryEmbeddingMs: number | null;

  @Column({ name: 'retrieval_ms', type: 'int', nullable: true })
  retrievalMs: number | null;

  @Column({ name: 'reranking_ms', type: 'int', nullable: true })
  rerankingMs: number | null;

  @Column({ name: 'generation_ms', type: 'int', nullable: true })
  generationMs: number | null;

  @Column({ name: 'total_ms', type: 'int', nullable: true })
  totalMs: number | null;

  @Column({ name: 'embedding_tokens', type: 'int', default: 0 })
  embeddingTokens: number;

  @Column({ name: 'prompt_tokens', type: 'int', default: 0 })
  promptTokens: number;

  @Column({ name: 'completion_tokens', type: 'int', default: 0 })
  completionTokens: number;

  @Column({
    name: 'estimated_cost_usd',
    type: 'decimal',
    precision: 10,
    scale: 6,
    default: 0,
  })
  estimatedCostUsd: number;

  @Column({ name: 'retrieved_chunks', type: 'json', nullable: true })
  retrievedChunks: any;

  @Column({ name: 'evaluation_scores', type: 'json', nullable: true })
  evaluationScores: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
