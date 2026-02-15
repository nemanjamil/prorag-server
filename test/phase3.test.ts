import { ConfigService } from '@nestjs/config';
import { Bm25Service } from '../src/bm25/bm25.service';
import { EmbeddingService } from '../src/embedding/embedding.service';
import { QdrantService } from '../src/qdrant/qdrant.service';
import { ChunkStrategy } from '../src/common/enums/chunk-strategy.enum';

// ─── BM25 Tests (pure logic, no external deps) ─────────────────────────

describe('Phase 3: BM25 Search', () => {
  let bm25: Bm25Service;

  beforeAll(() => {
    const mockConfig = {
      get: (key: string, defaultVal?: any) => {
        const map: Record<string, any> = {
          'bm25.k1': 1.2,
          'bm25.b': 0.75,
        };
        return map[key] ?? defaultVal;
      },
    } as unknown as ConfigService;

    // Create with minimal mocks — onModuleInit will NOT be called in unit tests
    bm25 = new (Bm25Service as any)(
      mockConfig,
      null, // documentRepo (not used in unit logic)
      null, // documentsService (not used in unit logic)
    );
  });

  describe('tokenize', () => {
    it('should lowercase and split on whitespace/punctuation', () => {
      const tokens = bm25.tokenize('Hello, World! This is a TEST.');
      expect(tokens).toEqual(['hello', 'world', 'this', 'is', 'a', 'test']);
    });

    it('should handle empty string', () => {
      expect(bm25.tokenize('')).toEqual([]);
    });

    it('should handle string with only punctuation', () => {
      expect(bm25.tokenize('...,,,!!!')).toEqual([]);
    });

    it('should preserve numbers', () => {
      const tokens = bm25.tokenize('chapter 3 section 4.2');
      expect(tokens).toContain('3');
      expect(tokens).toContain('4');
      expect(tokens).toContain('2');
    });
  });

  describe('addDocument and search', () => {
    beforeEach(() => {
      // Reset index by removing all docs
      (bm25 as any).documents.clear();
      (bm25 as any).invertedIndex.clear();
      (bm25 as any).totalChunks = 0;
      (bm25 as any).avgDocLength = 0;
    });

    it('should find relevant chunks by keyword', () => {
      bm25.addDocument(1, [
        { text: 'Machine learning is a subset of artificial intelligence', chunkIndex: 0 },
        { text: 'Deep learning uses neural networks for pattern recognition', chunkIndex: 1 },
        { text: 'The weather today is sunny and warm', chunkIndex: 2 },
      ]);

      const results = bm25.search('machine learning artificial intelligence');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].chunkIndex).toBe(0);
      expect(results[0].documentId).toBe(1);
      expect(results[0].score).toBeGreaterThan(0);
    });

    it('should rank more relevant chunks higher', () => {
      bm25.addDocument(1, [
        { text: 'Cats are popular pets around the world', chunkIndex: 0 },
        { text: 'RAG retrieval augmented generation is a key technique in NLP', chunkIndex: 1 },
        { text: 'Vector databases store embeddings for similarity search retrieval', chunkIndex: 2 },
      ]);

      const results = bm25.search('retrieval augmented generation');
      expect(results.length).toBeGreaterThanOrEqual(1);
      // The chunk about RAG should rank first
      expect(results[0].chunkIndex).toBe(1);
    });

    it('should search across multiple documents', () => {
      bm25.addDocument(1, [
        { text: 'Document one talks about Python programming', chunkIndex: 0 },
      ]);
      bm25.addDocument(2, [
        { text: 'Document two discusses JavaScript frameworks', chunkIndex: 0 },
      ]);

      const pythonResults = bm25.search('Python programming');
      expect(pythonResults.length).toBeGreaterThan(0);
      expect(pythonResults[0].documentId).toBe(1);

      const jsResults = bm25.search('JavaScript frameworks');
      expect(jsResults.length).toBeGreaterThan(0);
      expect(jsResults[0].documentId).toBe(2);
    });

    it('should return empty for no match', () => {
      bm25.addDocument(1, [
        { text: 'The quick brown fox jumps over the lazy dog', chunkIndex: 0 },
      ]);

      const results = bm25.search('quantum physics relativity');
      expect(results.length).toBe(0);
    });

    it('should respect topK limit', () => {
      bm25.addDocument(1, [
        { text: 'machine learning algorithms', chunkIndex: 0 },
        { text: 'machine learning models', chunkIndex: 1 },
        { text: 'machine learning data', chunkIndex: 2 },
        { text: 'machine learning pipelines', chunkIndex: 3 },
        { text: 'machine learning deployment', chunkIndex: 4 },
      ]);

      const results = bm25.search('machine learning', 3);
      expect(results.length).toBe(3);
    });

    it('should handle empty query', () => {
      bm25.addDocument(1, [
        { text: 'some text', chunkIndex: 0 },
      ]);
      const results = bm25.search('');
      expect(results.length).toBe(0);
    });
  });

  describe('removeDocument', () => {
    beforeEach(() => {
      (bm25 as any).documents.clear();
      (bm25 as any).invertedIndex.clear();
      (bm25 as any).totalChunks = 0;
      (bm25 as any).avgDocLength = 0;
    });

    it('should remove document from search results', () => {
      bm25.addDocument(1, [
        { text: 'machine learning algorithms', chunkIndex: 0 },
      ]);
      bm25.addDocument(2, [
        { text: 'machine learning models', chunkIndex: 0 },
      ]);

      let results = bm25.search('machine learning');
      expect(results.length).toBe(2);

      bm25.removeDocument(1);
      results = bm25.search('machine learning');
      expect(results.length).toBe(1);
      expect(results[0].documentId).toBe(2);
    });

    it('should handle removing non-existent document gracefully', () => {
      expect(() => bm25.removeDocument(999)).not.toThrow();
    });
  });
});

// ─── Embedding Service Tests (mocked OpenAI) ────────────────────────────

describe('Phase 3: EmbeddingService', () => {
  it('should batch texts and aggregate results', async () => {
    const mockConfig = {
      get: (key: string) => {
        const map: Record<string, any> = {
          'openai.apiKey': 'test-key',
          'openai.embeddingModel': 'text-embedding-3-large',
        };
        return map[key];
      },
    } as unknown as ConfigService;

    const service = new EmbeddingService(mockConfig);

    // Mock the OpenAI client
    const mockCreate = jest.fn();
    (service as any).client = {
      embeddings: { create: mockCreate },
    };

    // Simulate 3 texts, batch size 2 → 2 batches
    const fakeVector = new Array(3072).fill(0.1);
    mockCreate
      .mockResolvedValueOnce({
        data: [
          { index: 0, embedding: fakeVector },
          { index: 1, embedding: fakeVector },
        ],
        usage: { total_tokens: 100 },
      })
      .mockResolvedValueOnce({
        data: [{ index: 0, embedding: fakeVector }],
        usage: { total_tokens: 50 },
      });

    const result = await service.embedBatch(['text1', 'text2', 'text3'], 2);

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(result.vectors.length).toBe(3);
    expect(result.totalTokens).toBe(150);
    expect(result.vectors[0].length).toBe(3072);
  });

  it('should handle empty input', async () => {
    const mockConfig = {
      get: (key: string) => {
        const map: Record<string, any> = {
          'openai.apiKey': 'test-key',
          'openai.embeddingModel': 'text-embedding-3-large',
        };
        return map[key];
      },
    } as unknown as ConfigService;

    const service = new EmbeddingService(mockConfig);
    const result = await service.embedBatch([]);
    expect(result.vectors).toEqual([]);
    expect(result.totalTokens).toBe(0);
  });

  it('embedSingle should return single vector', async () => {
    const mockConfig = {
      get: (key: string) => {
        const map: Record<string, any> = {
          'openai.apiKey': 'test-key',
          'openai.embeddingModel': 'text-embedding-3-large',
        };
        return map[key];
      },
    } as unknown as ConfigService;

    const service = new EmbeddingService(mockConfig);
    const fakeVector = new Array(3072).fill(0.5);
    (service as any).client = {
      embeddings: {
        create: jest.fn().mockResolvedValue({
          data: [{ index: 0, embedding: fakeVector }],
          usage: { total_tokens: 20 },
        }),
      },
    };

    const result = await service.embedSingle('hello world');
    expect(result.vector.length).toBe(3072);
    expect(result.tokens).toBe(20);
  });
});

// ─── Qdrant Service Tests (mocked client) ────────────────────────────────

describe('Phase 3: QdrantService', () => {
  let qdrantService: QdrantService;
  let mockClient: any;

  beforeEach(() => {
    const mockConfig = {
      get: (key: string) => {
        const map: Record<string, any> = {
          'qdrant.url': 'http://localhost:6333',
        };
        return map[key];
      },
    } as unknown as ConfigService;

    qdrantService = new QdrantService(mockConfig);

    mockClient = {
      getCollection: jest.fn(),
      createCollection: jest.fn(),
      upsert: jest.fn().mockResolvedValue({ status: 'completed' }),
      delete: jest.fn().mockResolvedValue({ status: 'completed' }),
      search: jest.fn().mockResolvedValue([]),
    };
    (qdrantService as any).client = mockClient;
  });

  describe('ensureCollection', () => {
    it('should not create collection if it already exists', async () => {
      mockClient.getCollection.mockResolvedValue({});
      await qdrantService.ensureCollection('test_collection');
      expect(mockClient.createCollection).not.toHaveBeenCalled();
    });

    it('should create collection if it does not exist', async () => {
      mockClient.getCollection.mockRejectedValue(new Error('Not found'));
      mockClient.createCollection.mockResolvedValue(true);
      await qdrantService.ensureCollection('test_collection');
      expect(mockClient.createCollection).toHaveBeenCalledWith('test_collection', {
        vectors: { size: 3072, distance: 'Cosine' },
      });
    });
  });

  describe('upsertChunks', () => {
    it('should upsert chunks with correct payload', async () => {
      const chunks = [
        { text: 'chunk one', chunkIndex: 0, pageNumber: 1, startChar: 0, endChar: 9 },
        { text: 'chunk two', chunkIndex: 1, pageNumber: 1, startChar: 10, endChar: 19 },
      ];
      const vectors = [new Array(3072).fill(0.1), new Array(3072).fill(0.2)];

      const count = await qdrantService.upsertChunks(
        1,
        chunks,
        vectors,
        ChunkStrategy.RECURSIVE,
      );

      expect(count).toBe(2);
      expect(mockClient.upsert).toHaveBeenCalledTimes(1);

      const upsertCall = mockClient.upsert.mock.calls[0];
      expect(upsertCall[0]).toBe('pdf_documents');
      expect(upsertCall[1].points.length).toBe(2);
      expect(upsertCall[1].points[0].payload.document_id).toBe(1);
      expect(upsertCall[1].points[0].payload.text_content).toBe('chunk one');
      expect(upsertCall[1].points[0].payload.chunk_strategy).toBe('recursive');
    });

    it('should batch upserts for large sets', async () => {
      const chunks = Array.from({ length: 150 }, (_, i) => ({
        text: `chunk ${i}`,
        chunkIndex: i,
        pageNumber: 1,
        startChar: 0,
        endChar: 10,
      }));
      const vectors = Array.from({ length: 150 }, () => new Array(3072).fill(0.1));

      await qdrantService.upsertChunks(1, chunks, vectors, ChunkStrategy.FIXED);

      // 150 points → 2 batches (100 + 50)
      expect(mockClient.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteByDocumentId', () => {
    it('should delete by document_id filter', async () => {
      await qdrantService.deleteByDocumentId(42);
      expect(mockClient.delete).toHaveBeenCalledWith('pdf_documents', {
        wait: true,
        filter: {
          must: [{ key: 'document_id', match: { value: 42 } }],
        },
      });
    });
  });

  describe('search', () => {
    it('should map search results correctly', async () => {
      mockClient.search.mockResolvedValue([
        {
          id: 'uuid-1',
          score: 0.95,
          payload: {
            document_id: 1,
            chunk_index: 3,
            page_number: 2,
            text_content: 'found text',
            chunk_strategy: 'recursive',
          },
        },
      ]);

      const results = await qdrantService.search(new Array(3072).fill(0.1), 10);
      expect(results.length).toBe(1);
      expect(results[0].documentId).toBe(1);
      expect(results[0].chunkIndex).toBe(3);
      expect(results[0].text).toBe('found text');
      expect(results[0].score).toBe(0.95);
    });
  });
});
