import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryLog } from '../database/entities/query-log.entity.js';
import { PromptTemplate } from '../database/entities/prompt-template.entity.js';
import { SearchMode } from '../common/enums/search-mode.enum.js';
import { QueryStrategy } from '../common/enums/query-strategy.enum.js';
import { EmbeddingService } from '../embedding/embedding.service.js';
import { QdrantService, QdrantSearchResult } from '../qdrant/qdrant.service.js';
import { Bm25Service, Bm25SearchResult } from '../bm25/bm25.service.js';
import { RerankerService } from '../reranker/reranker.service.js';
import { GenerationService } from '../generation/generation.service.js';
import { QueryTransformationService } from './query-transformation.service.js';
import { QueryRequestDto } from './dto/query-request.dto.js';
import { reciprocalRankFusion } from './rrf.util.js';
import {
  RetrievedChunk,
  SseEmitter,
  PipelineSettings,
} from './interfaces/pipeline-context.js';

const DEFAULT_TEMPLATE_NAME = 'Default RAG Template';
const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant answering questions based on PDF document context.

Context:
{{context}}

Question: {{query}}

Answer based only on the provided context. If the context does not contain enough information to answer the question, say so clearly.`;

@Injectable()
export class QueryService implements OnModuleInit {
  private readonly logger = new Logger(QueryService.name);

  constructor(
    private config: ConfigService,
    @InjectRepository(QueryLog)
    private queryLogRepo: Repository<QueryLog>,
    @InjectRepository(PromptTemplate)
    private promptTemplateRepo: Repository<PromptTemplate>,
    private embeddingService: EmbeddingService,
    private qdrantService: QdrantService,
    private bm25Service: Bm25Service,
    private rerankerService: RerankerService,
    private generationService: GenerationService,
    private queryTransformationService: QueryTransformationService,
  ) {}

  async onModuleInit() {
    const existing = await this.promptTemplateRepo.findOne({
      where: { isDefault: true },
    });
    if (!existing) {
      const template = this.promptTemplateRepo.create({
        name: DEFAULT_TEMPLATE_NAME,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        description: 'Default RAG prompt template with context and query placeholders',
        isDefault: true,
      });
      await this.promptTemplateRepo.save(template);
      this.logger.log('Default prompt template seeded');
    }
  }

  async executeQuery(dto: QueryRequestDto, emitter: SseEmitter): Promise<void> {
    const totalStart = Date.now();

    try {
      // 1. Resolve params
      const settings = this.resolveSettings(dto);

      // 2. Load prompt template
      const template = await this.loadPromptTemplate(settings.promptTemplateId);

      // 3. Query Transformation
      const transformStart = Date.now();
      const transformation = await this.queryTransformationService.transform(
        dto.queryText,
        settings.queryStrategy,
        settings.temperature,
      );
      const transformationMs = Date.now() - transformStart;
      let transformTokensPrompt = transformation.promptTokens;
      let transformTokensCompletion = transformation.completionTokens;

      // 4. Embed queries
      const embeddingStart = Date.now();
      let embeddingTokens = 0;
      const vectors: number[][] = [];

      if (settings.searchMode !== SearchMode.BM25) {
        for (const q of transformation.searchQueries) {
          const { vector, tokens } = await this.embeddingService.embedSingle(q);
          vectors.push(vector);
          embeddingTokens += tokens;
        }
      }
      const embeddingMs = Date.now() - embeddingStart;

      // 5. Parallel Retrieval
      const retrievalStart = Date.now();
      const filter = this.buildQdrantFilter(settings.documentIds);

      let retrievedChunks: RetrievedChunk[];

      if (settings.searchMode === SearchMode.VECTOR) {
        const allResults = await this.searchVector(vectors, settings.retrievalTopK, filter);
        retrievedChunks = this.vectorResultsToChunks(allResults);
      } else if (settings.searchMode === SearchMode.BM25) {
        const allResults = this.searchBm25(
          transformation.searchQueries,
          settings.retrievalTopK,
          settings.documentIds,
        );
        retrievedChunks = this.bm25ResultsToChunks(allResults);
      } else {
        // HYBRID
        const [vectorResults, bm25Results] = await Promise.all([
          this.searchVector(vectors, settings.retrievalTopK, filter),
          Promise.resolve(
            this.searchBm25(
              transformation.searchQueries,
              settings.retrievalTopK,
              settings.documentIds,
            ),
          ),
        ]);

        const vectorWeight = this.config.get<number>('retrieval.defaultVectorWeight') ?? 0.7;
        const rrfK = this.config.get<number>('rrf.k') ?? 60;
        retrievedChunks = reciprocalRankFusion(vectorResults, bm25Results, vectorWeight, rrfK);
      }

      const retrievalMs = Date.now() - retrievalStart;

      // 6. Reranking
      const rerankStart = Date.now();
      let finalChunks: RetrievedChunk[];

      if (settings.rerankerEnabled && retrievedChunks.length > 0) {
        const docs = retrievedChunks.map((c, i) => ({ text: c.text, index: i }));
        const reranked = await this.rerankerService.rerank(
          dto.queryText,
          docs,
          settings.rerankerTopN,
        );
        finalChunks = reranked.map((r) => ({
          ...retrievedChunks[r.originalIndex],
          rerankerScore: r.relevanceScore,
        }));
      } else {
        finalChunks = retrievedChunks.slice(0, settings.rerankerTopN);
      }

      const rerankingMs = Date.now() - rerankStart;

      // 7. Emit metadata SSE event
      emitter.emit({
        type: 'metadata',
        data: {
          timings: { transformationMs, embeddingMs, retrievalMs, rerankingMs },
          retrievedChunks: finalChunks,
          settings,
          transformedQueries: transformation.searchQueries,
        },
      });

      // 8. Prompt Assembly
      const context = finalChunks
        .map(
          (c, i) =>
            `[Chunk ${i + 1} | Doc ${c.documentId}, Chunk ${c.chunkIndex}${c.pageNumber != null ? `, Page ${c.pageNumber}` : ''}]\n${c.text}`,
        )
        .join('\n\n');

      const renderedPrompt = template.systemPrompt
        .replace('{{context}}', context)
        .replace('{{query}}', dto.queryText);

      // 9. Generation (streaming)
      const generationStart = Date.now();
      let answerText = '';

      const gen = this.generationService.generateStream(
        renderedPrompt,
        dto.queryText,
        settings.temperature,
      );

      let result = await gen.next();
      while (!result.done) {
        const token = result.value;
        answerText += token;
        emitter.emit({ type: 'token', data: { token } });
        result = await gen.next();
      }

      const generationMs = Date.now() - generationStart;
      const usage = result.value;

      // 10. Cost calculation
      const pricing = {
        embeddingPer1K: this.config.get<number>('pricing.openaiEmbeddingPer1K') ?? 0.00013,
        promptPer1K: this.config.get<number>('pricing.openaiPromptPer1K') ?? 0.005,
        completionPer1K: this.config.get<number>('pricing.openaiCompletionPer1K') ?? 0.015,
      };

      const totalPromptTokens = transformTokensPrompt + usage.promptTokens;
      const totalCompletionTokens = transformTokensCompletion + usage.completionTokens;

      const estimatedCostUsd =
        (embeddingTokens / 1000) * pricing.embeddingPer1K +
        (totalPromptTokens / 1000) * pricing.promptPer1K +
        (totalCompletionTokens / 1000) * pricing.completionPer1K;

      // 11. Save QueryLog
      const totalMs = Date.now() - totalStart;

      const queryLog = this.queryLogRepo.create({
        queryText: dto.queryText,
        answerText,
        queryStrategy: settings.queryStrategy,
        searchMode: settings.searchMode,
        rerankerEnabled: settings.rerankerEnabled,
        temperature: settings.temperature,
        retrievalTopK: settings.retrievalTopK,
        rerankerTopN: settings.rerankerTopN,
        llmModel: settings.llmModel,
        promptTemplateId: settings.promptTemplateId,
        transformationMs,
        transformedQueries: transformation.searchQueries,
        queryEmbeddingMs: embeddingMs,
        retrievalMs,
        rerankingMs,
        generationMs,
        totalMs,
        embeddingTokens,
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        estimatedCostUsd,
        retrievedChunks: finalChunks,
      });
      const savedLog = await this.queryLogRepo.save(queryLog);

      // 12. Emit done event
      emitter.emit({
        type: 'done',
        data: {
          answerText,
          queryLogId: savedLog.id,
          finalCostUsd: estimatedCostUsd,
        },
      });
    } catch (error: any) {
      this.logger.error(`Query pipeline error: ${error.message}`, error.stack);
      emitter.emit({ type: 'error', data: { message: error.message } });
    }
  }

  private resolveSettings(dto: QueryRequestDto): PipelineSettings {
    return {
      searchMode:
        dto.searchMode ??
        ((this.config.get<string>('retrieval.defaultSearchMode') as SearchMode) ??
          SearchMode.HYBRID),
      queryStrategy:
        dto.queryStrategy ??
        ((this.config.get<string>('retrieval.defaultQueryStrategy') as QueryStrategy) ??
          QueryStrategy.DIRECT),
      rerankerEnabled: dto.rerankerEnabled ?? true,
      temperature: dto.temperature ?? (this.config.get<number>('retrieval.defaultTemperature') ?? 0.1),
      retrievalTopK:
        dto.retrievalTopK ?? (this.config.get<number>('retrieval.defaultTopK') ?? 20),
      rerankerTopN:
        dto.rerankerTopN ?? (this.config.get<number>('retrieval.defaultRerankerTopN') ?? 5),
      documentIds: dto.documentIds ?? null,
      promptTemplateId: dto.promptTemplateId ?? null,
      llmModel: this.config.get<string>('openai.llmModel') || 'gpt-4o',
    };
  }

  private async loadPromptTemplate(id: number | null): Promise<PromptTemplate> {
    if (id) {
      const template = await this.promptTemplateRepo.findOne({ where: { id } });
      if (!template) {
        throw new NotFoundException(`Prompt template with ID ${id} not found`);
      }
      return template;
    }
    const defaultTemplate = await this.promptTemplateRepo.findOne({
      where: { isDefault: true },
    });
    if (!defaultTemplate) {
      throw new NotFoundException('No default prompt template found');
    }
    return defaultTemplate;
  }

  private buildQdrantFilter(
    documentIds: number[] | null,
  ): Record<string, any> | undefined {
    if (!documentIds || documentIds.length === 0) return undefined;

    if (documentIds.length === 1) {
      return {
        must: [{ key: 'document_id', match: { value: documentIds[0] } }],
      };
    }

    return {
      must: [{ key: 'document_id', match: { any: documentIds } }],
    };
  }

  private async searchVector(
    vectors: number[][],
    topK: number,
    filter?: Record<string, any>,
  ): Promise<QdrantSearchResult[]> {
    if (vectors.length === 0) return [];

    if (vectors.length === 1) {
      return this.qdrantService.search(vectors[0], topK, filter);
    }

    // Multi-query: search each vector and merge + dedup
    const allResults: QdrantSearchResult[] = [];
    const seen = new Set<string>();

    for (const vector of vectors) {
      const results = await this.qdrantService.search(vector, topK, filter);
      for (const r of results) {
        const key = `${r.documentId}:${r.chunkIndex}`;
        if (!seen.has(key)) {
          seen.add(key);
          allResults.push(r);
        }
      }
    }

    allResults.sort((a, b) => b.score - a.score);
    return allResults.slice(0, topK);
  }

  private searchBm25(
    queries: string[],
    topK: number,
    documentIds: number[] | null,
  ): Bm25SearchResult[] {
    const allResults: Bm25SearchResult[] = [];
    const seen = new Set<string>();

    for (const q of queries) {
      const results = this.bm25Service.search(q, topK);
      for (const r of results) {
        const key = `${r.documentId}:${r.chunkIndex}`;
        if (!seen.has(key)) {
          seen.add(key);
          allResults.push(r);
        }
      }
    }

    // Post-filter by documentIds
    let filtered = allResults;
    if (documentIds && documentIds.length > 0) {
      const idSet = new Set(documentIds);
      filtered = allResults.filter((r) => idSet.has(r.documentId));
    }

    filtered.sort((a, b) => b.score - a.score);
    return filtered.slice(0, topK);
  }

  private vectorResultsToChunks(results: QdrantSearchResult[]): RetrievedChunk[] {
    return results.map((r, i) => ({
      documentId: r.documentId,
      chunkIndex: r.chunkIndex,
      pageNumber: r.pageNumber,
      text: r.text,
      chunkStrategy: r.chunkStrategy,
      vectorRank: i + 1,
      vectorScore: r.score,
      bm25Rank: null,
      bm25Score: null,
      rrfScore: null,
      rerankerScore: null,
      source: 'vector' as const,
    }));
  }

  private bm25ResultsToChunks(results: Bm25SearchResult[]): RetrievedChunk[] {
    return results.map((r, i) => ({
      documentId: r.documentId,
      chunkIndex: r.chunkIndex,
      pageNumber: null,
      text: r.text,
      chunkStrategy: '',
      vectorRank: null,
      vectorScore: null,
      bm25Rank: i + 1,
      bm25Score: r.score,
      rrfScore: null,
      rerankerScore: null,
      source: 'bm25' as const,
    }));
  }

  async listQueryLogs(page: number, limit: number) {
    const [data, total] = await this.queryLogRepo.findAndCount({
      select: [
        'id',
        'queryText',
        'queryStrategy',
        'searchMode',
        'rerankerEnabled',
        'llmModel',
        'totalMs',
        'embeddingTokens',
        'promptTokens',
        'completionTokens',
        'estimatedCostUsd',
        'createdAt',
      ],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async getQueryLog(id: number) {
    const log = await this.queryLogRepo.findOne({ where: { id } });
    if (!log) {
      throw new NotFoundException(`Query log with ID ${id} not found`);
    }
    return log;
  }

  async executeAndReturn(dto: QueryRequestDto): Promise<QueryLog> {
    return new Promise((resolve, reject) => {
      const emitter: SseEmitter = {
        emit: (event) => {
          if (event.type === 'done') {
            this.getQueryLog(event.data.queryLogId).then(resolve, reject);
          } else if (event.type === 'error') {
            reject(new Error(event.data.message));
          }
        },
      };
      this.executeQuery(dto, emitter).catch(reject);
    });
  }
}
