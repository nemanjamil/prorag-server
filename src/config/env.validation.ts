import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),

  MYSQL_HOST: Joi.string().required(),
  MYSQL_PORT: Joi.number().default(3306),
  MYSQL_USER: Joi.string().required(),
  MYSQL_PASSWORD: Joi.string().required(),
  MYSQL_DATABASE: Joi.string().required(),
  MYSQL_ROOT_PASSWORD: Joi.string().optional(),

  QDRANT_URL: Joi.string().default('http://localhost:6333'),

  OPENAI_API_KEY: Joi.string().required(),
  EMBEDDING_MODEL: Joi.string().default('text-embedding-3-large'),
  LLM_MODEL: Joi.string().default('gpt-4o'),

  JINA_API_KEY: Joi.string().allow('').default(''),
  RERANKER_PROVIDER: Joi.string().default('jina'),

  DEFAULT_CHUNK_SIZE: Joi.number().default(512),
  DEFAULT_CHUNK_OVERLAP: Joi.number().default(50),
  DEFAULT_CHUNK_STRATEGY: Joi.string().valid('fixed', 'recursive', 'semantic').default('recursive'),
  SEMANTIC_SIMILARITY_THRESHOLD: Joi.number().default(0.85),

  DEFAULT_RETRIEVAL_TOP_K: Joi.number().default(20),
  DEFAULT_RERANKER_TOP_N: Joi.number().default(5),
  DEFAULT_TEMPERATURE: Joi.number().default(0.1),
  DEFAULT_SEARCH_MODE: Joi.string().valid('vector', 'bm25', 'hybrid').default('hybrid'),
  DEFAULT_QUERY_STRATEGY: Joi.string().valid('direct', 'hyde', 'multi_query', 'step_back').default('direct'),
  DEFAULT_VECTOR_WEIGHT: Joi.number().default(0.7),

  BM25_K1: Joi.number().default(1.2),
  BM25_B: Joi.number().default(0.75),
  RRF_K: Joi.number().default(60),

  OPENAI_EMBEDDING_PRICE_PER_1K: Joi.number().default(0.00013),
  OPENAI_PROMPT_PRICE_PER_1K: Joi.number().default(0.005),
  OPENAI_COMPLETION_PRICE_PER_1K: Joi.number().default(0.015),
  JINA_RERANKER_PRICE_PER_1K: Joi.number().default(0.00002),

  MAX_FILE_SIZE_MB: Joi.number().default(50),
  MAX_FILES_PER_UPLOAD: Joi.number().default(10),
  LLM_MAX_TOKENS: Joi.number().default(4096),
});
