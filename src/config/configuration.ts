export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    user: process.env.MYSQL_USER || 'prorag',
    password: process.env.MYSQL_PASSWORD || 'prorag_secret',
    database: process.env.MYSQL_DATABASE || 'prorag',
  },

  qdrant: {
    url: process.env.QDRANT_URL || 'http://localhost:6333',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-large',
    llmModel: process.env.LLM_MODEL || 'gpt-4o',
  },

  jina: {
    apiKey: process.env.JINA_API_KEY || '',
    rerankerProvider: process.env.RERANKER_PROVIDER || 'jina',
  },

  chunking: {
    defaultChunkSize: parseInt(process.env.DEFAULT_CHUNK_SIZE || '512', 10),
    defaultChunkOverlap: parseInt(process.env.DEFAULT_CHUNK_OVERLAP || '50', 10),
    defaultChunkStrategy: process.env.DEFAULT_CHUNK_STRATEGY || 'recursive',
    semanticSimilarityThreshold: parseFloat(
      process.env.SEMANTIC_SIMILARITY_THRESHOLD || '0.85',
    ),
  },

  retrieval: {
    defaultTopK: parseInt(process.env.DEFAULT_RETRIEVAL_TOP_K || '20', 10),
    defaultRerankerTopN: parseInt(process.env.DEFAULT_RERANKER_TOP_N || '5', 10),
    defaultTemperature: parseFloat(process.env.DEFAULT_TEMPERATURE || '0.1'),
    defaultSearchMode: process.env.DEFAULT_SEARCH_MODE || 'hybrid',
    defaultQueryStrategy: process.env.DEFAULT_QUERY_STRATEGY || 'direct',
    defaultVectorWeight: parseFloat(process.env.DEFAULT_VECTOR_WEIGHT || '0.7'),
  },

  bm25: {
    k1: parseFloat(process.env.BM25_K1 || '1.2'),
    b: parseFloat(process.env.BM25_B || '0.75'),
  },

  rrf: {
    k: parseInt(process.env.RRF_K || '60', 10),
  },

  pricing: {
    openaiEmbeddingPer1K: parseFloat(
      process.env.OPENAI_EMBEDDING_PRICE_PER_1K || '0.00013',
    ),
    openaiPromptPer1K: parseFloat(process.env.OPENAI_PROMPT_PRICE_PER_1K || '0.005'),
    openaiCompletionPer1K: parseFloat(
      process.env.OPENAI_COMPLETION_PRICE_PER_1K || '0.015',
    ),
    jinaRerankerPer1K: parseFloat(
      process.env.JINA_RERANKER_PRICE_PER_1K || '0.00002',
    ),
  },

  limits: {
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
    maxFilesPerUpload: parseInt(process.env.MAX_FILES_PER_UPLOAD || '10', 10),
    llmMaxTokens: parseInt(process.env.LLM_MAX_TOKENS || '4096', 10),
  },
});
