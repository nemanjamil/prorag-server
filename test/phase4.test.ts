import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { reciprocalRankFusion } from '../src/query/rrf.util';
import { RerankerService } from '../src/reranker/reranker.service';
import { GenerationService } from '../src/generation/generation.service';
import { QueryTransformationService } from '../src/query/query-transformation.service';
import { QueryRequestDto } from '../src/query/dto/query-request.dto';
import { QueryStrategy } from '../src/common/enums/query-strategy.enum';
import { QdrantSearchResult } from '../src/qdrant/qdrant.service';
import { Bm25SearchResult } from '../src/bm25/bm25.service';

// ─── RRF Tests (pure function) ──────────────────────────────────────────

describe('Phase 4: Reciprocal Rank Fusion', () => {
  const makeVectorResult = (
    documentId: number,
    chunkIndex: number,
    score: number,
  ): QdrantSearchResult => ({
    id: `uuid-${documentId}-${chunkIndex}`,
    score,
    documentId,
    chunkIndex,
    pageNumber: 1,
    text: `vector chunk ${documentId}:${chunkIndex}`,
    chunkStrategy: 'recursive',
  });

  const makeBm25Result = (
    documentId: number,
    chunkIndex: number,
    score: number,
  ): Bm25SearchResult => ({
    documentId,
    chunkIndex,
    score,
    text: `bm25 chunk ${documentId}:${chunkIndex}`,
  });

  it('should fuse vector and bm25 results with correct RRF scores', () => {
    const vectorResults = [
      makeVectorResult(1, 0, 0.95),
      makeVectorResult(1, 1, 0.85),
    ];
    const bm25Results = [
      makeBm25Result(1, 1, 5.2),
      makeBm25Result(2, 0, 3.1),
    ];

    const fused = reciprocalRankFusion(vectorResults, bm25Results, 0.7, 60);

    // Chunk 1:1 appears in both → should have highest RRF score
    const chunk11 = fused.find((c) => c.documentId === 1 && c.chunkIndex === 1);
    expect(chunk11).toBeDefined();
    expect(chunk11!.source).toBe('both');
    expect(chunk11!.vectorRank).toBe(2);
    expect(chunk11!.bm25Rank).toBe(1);

    // Verify RRF score for 1:1 → 0.7/(60+2) + 0.3/(60+1)
    const expectedScore = 0.7 / (60 + 2) + 0.3 / (60 + 1);
    expect(chunk11!.rrfScore).toBeCloseTo(expectedScore, 6);
  });

  it('should deduplicate by documentId:chunkIndex', () => {
    const vectorResults = [
      makeVectorResult(1, 0, 0.9),
      makeVectorResult(1, 1, 0.8),
    ];
    const bm25Results = [
      makeBm25Result(1, 0, 4.0),
      makeBm25Result(1, 1, 3.0),
    ];

    const fused = reciprocalRankFusion(vectorResults, bm25Results, 0.5, 60);
    expect(fused.length).toBe(2);
    expect(fused.every((c) => c.source === 'both')).toBe(true);
  });

  it('should sort by RRF score descending', () => {
    const vectorResults = [
      makeVectorResult(1, 0, 0.99),
      makeVectorResult(2, 0, 0.80),
    ];
    const bm25Results = [
      makeBm25Result(2, 0, 6.0),
      makeBm25Result(3, 0, 5.0),
    ];

    const fused = reciprocalRankFusion(vectorResults, bm25Results, 0.5, 60);

    for (let i = 1; i < fused.length; i++) {
      expect(fused[i - 1].rrfScore! >= fused[i].rrfScore!).toBe(true);
    }
  });

  it('should handle empty vector results', () => {
    const bm25Results = [makeBm25Result(1, 0, 3.0)];
    const fused = reciprocalRankFusion([], bm25Results, 0.7, 60);
    expect(fused.length).toBe(1);
    expect(fused[0].source).toBe('bm25');
  });

  it('should handle empty bm25 results', () => {
    const vectorResults = [makeVectorResult(1, 0, 0.9)];
    const fused = reciprocalRankFusion(vectorResults, [], 0.7, 60);
    expect(fused.length).toBe(1);
    expect(fused[0].source).toBe('vector');
  });

  it('should handle both empty', () => {
    const fused = reciprocalRankFusion([], [], 0.7, 60);
    expect(fused.length).toBe(0);
  });
});

// ─── RerankerService Tests (mocked fetch) ───────────────────────────────

describe('Phase 4: RerankerService', () => {
  let reranker: RerankerService;

  beforeEach(() => {
    const mockConfig = {
      get: (key: string) => {
        const map: Record<string, any> = { 'jina.apiKey': 'test-jina-key' };
        return map[key];
      },
    } as unknown as ConfigService;
    reranker = new RerankerService(mockConfig);
  });

  it('should throw if JINA_API_KEY is empty', async () => {
    const noKeyConfig = {
      get: () => '',
    } as unknown as ConfigService;
    const noKeyReranker = new RerankerService(noKeyConfig);

    await expect(
      noKeyReranker.rerank('test', [{ text: 'doc', index: 0 }], 5),
    ).rejects.toThrow(BadRequestException);
  });

  it('should send correct request and map response', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { index: 1, relevance_score: 0.95, document: { text: 'second doc' } },
          { index: 0, relevance_score: 0.80, document: { text: 'first doc' } },
        ],
      }),
    });
    global.fetch = mockFetch;

    const docs = [
      { text: 'first doc', index: 5 },
      { text: 'second doc', index: 10 },
    ];

    const results = await reranker.rerank('query', docs, 2);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.jina.ai/v1/rerank');
    const body = JSON.parse(options.body);
    expect(body.model).toBe('jina-reranker-v2-base-multilingual');
    expect(body.documents).toEqual(['first doc', 'second doc']);
    expect(body.top_n).toBe(2);

    // Verify index mapping: Jina index 1 → original index 10
    expect(results[0].originalIndex).toBe(10);
    expect(results[0].relevanceScore).toBe(0.95);
    expect(results[1].originalIndex).toBe(5);
  });

  it('should return empty array for empty documents', async () => {
    const results = await reranker.rerank('query', [], 5);
    expect(results).toEqual([]);
  });

  it('should throw on non-ok response', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(
      reranker.rerank('query', [{ text: 'doc', index: 0 }], 5),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── GenerationService Tests (mocked OpenAI) ───────────────────────────

describe('Phase 4: GenerationService', () => {
  let genService: GenerationService;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    const mockConfig = {
      get: (key: string) => {
        const map: Record<string, any> = {
          'openai.apiKey': 'test-key',
          'openai.llmModel': 'gpt-4o',
          'limits.llmMaxTokens': 4096,
        };
        return map[key];
      },
    } as unknown as ConfigService;

    genService = new GenerationService(mockConfig);
    mockCreate = jest.fn();
    (genService as any).client = {
      chat: { completions: { create: mockCreate } },
    };
  });

  it('generate() should return text and usage', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Hello world' } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });

    const result = await genService.generate('system', 'user msg', 0.1);

    expect(result.text).toBe('Hello world');
    expect(result.promptTokens).toBe(10);
    expect(result.completionTokens).toBe(5);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o',
        stream: false,
        temperature: 0.1,
      }),
    );
  });

  it('generateStream() should yield tokens and return usage', async () => {
    // Create an async iterable to simulate the OpenAI stream
    const chunks = [
      { choices: [{ delta: { content: 'Hello' } }], usage: null },
      { choices: [{ delta: { content: ' world' } }], usage: null },
      { choices: [{ delta: {} }], usage: { prompt_tokens: 15, completion_tokens: 8 } },
    ];

    async function* fakeStream() {
      for (const chunk of chunks) {
        yield chunk;
      }
    }

    mockCreate.mockResolvedValue(fakeStream());

    const gen = genService.generateStream('system', 'user msg', 0.5);
    const tokens: string[] = [];

    let result = await gen.next();
    while (!result.done) {
      tokens.push(result.value);
      result = await gen.next();
    }

    expect(tokens).toEqual(['Hello', ' world']);
    expect(result.value).toEqual({ promptTokens: 15, completionTokens: 8 });
  });
});

// ─── QueryTransformationService Tests ───────────────────────────────────

describe('Phase 4: QueryTransformationService', () => {
  let transformService: QueryTransformationService;
  let mockGenerate: jest.Mock;

  beforeEach(() => {
    mockGenerate = jest.fn();
    const mockGenerationService = {
      generate: mockGenerate,
    } as unknown as GenerationService;

    transformService = new QueryTransformationService(mockGenerationService);
  });

  it('DIRECT should return original query with 0 tokens', async () => {
    const result = await transformService.transform('What is RAG?', QueryStrategy.DIRECT, 0.1);
    expect(result.searchQueries).toEqual(['What is RAG?']);
    expect(result.promptTokens).toBe(0);
    expect(result.completionTokens).toBe(0);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('HYDE should return hypothetical document', async () => {
    mockGenerate.mockResolvedValue({
      text: 'RAG stands for Retrieval Augmented Generation...',
      promptTokens: 50,
      completionTokens: 30,
    });

    const result = await transformService.transform('What is RAG?', QueryStrategy.HYDE, 0.1);
    expect(result.searchQueries).toEqual(['RAG stands for Retrieval Augmented Generation...']);
    expect(result.promptTokens).toBe(50);
    expect(result.completionTokens).toBe(30);
  });

  it('MULTI_QUERY should return original + rephrasings', async () => {
    mockGenerate.mockResolvedValue({
      text: 'What does RAG mean?\nHow does retrieval augmented generation work?\nExplain RAG in NLP\nDefine RAG technique',
      promptTokens: 40,
      completionTokens: 25,
    });

    const result = await transformService.transform(
      'What is RAG?',
      QueryStrategy.MULTI_QUERY,
      0.1,
    );
    expect(result.searchQueries[0]).toBe('What is RAG?');
    expect(result.searchQueries.length).toBe(5); // original + 4
  });

  it('STEP_BACK should return original + step-back question', async () => {
    mockGenerate.mockResolvedValue({
      text: 'What are the main approaches to combining retrieval with generation in NLP?',
      promptTokens: 35,
      completionTokens: 15,
    });

    const result = await transformService.transform(
      'What is RAG?',
      QueryStrategy.STEP_BACK,
      0.1,
    );
    expect(result.searchQueries.length).toBe(2);
    expect(result.searchQueries[0]).toBe('What is RAG?');
    expect(result.searchQueries[1]).toContain('retrieval');
  });
});

// ─── QueryRequestDto Validation Tests ───────────────────────────────────

describe('Phase 4: QueryRequestDto Validation', () => {
  function toDto(plain: object) {
    return plainToInstance(QueryRequestDto, plain);
  }

  it('should pass with valid queryText only', async () => {
    const errors = await validate(toDto({ queryText: 'What is RAG?' }));
    expect(errors.length).toBe(0);
  });

  it('should fail with missing queryText', async () => {
    const errors = await validate(toDto({}));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'queryText')).toBe(true);
  });

  it('should fail with empty queryText', async () => {
    const errors = await validate(toDto({ queryText: '' }));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail with invalid searchMode', async () => {
    const errors = await validate(toDto({ queryText: 'test', searchMode: 'invalid' }));
    expect(errors.some((e) => e.property === 'searchMode')).toBe(true);
  });

  it('should fail with temperature out of range', async () => {
    const errors = await validate(toDto({ queryText: 'test', temperature: 3 }));
    expect(errors.some((e) => e.property === 'temperature')).toBe(true);
  });

  it('should fail with retrievalTopK out of range', async () => {
    const errors = await validate(toDto({ queryText: 'test', retrievalTopK: 0 }));
    expect(errors.some((e) => e.property === 'retrievalTopK')).toBe(true);

    const errors2 = await validate(toDto({ queryText: 'test', retrievalTopK: 101 }));
    expect(errors2.some((e) => e.property === 'retrievalTopK')).toBe(true);
  });

  it('should pass with all valid fields', async () => {
    const errors = await validate(
      toDto({
        queryText: 'What is RAG?',
        searchMode: 'hybrid',
        queryStrategy: 'direct',
        rerankerEnabled: true,
        temperature: 0.5,
        retrievalTopK: 10,
        rerankerTopN: 3,
        documentIds: [1, 2],
        promptTemplateId: 1,
      }),
    );
    expect(errors.length).toBe(0);
  });
});
