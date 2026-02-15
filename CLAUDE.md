# ProRAG Server

## Project Overview

PDF-Based RAG Learning Platform backend — an educational tool for pro-level students to learn RAG internals with full pipeline observability, experimentation controls, and evaluation.

## Tech Stack

- **Framework:** NestJS 11 (TypeScript)
- **Database:** MySQL 8.x via TypeORM
- **Vector DB:** Qdrant (cosine similarity, 3072-dim vectors)
- **Embeddings:** OpenAI text-embedding-3-large
- **LLM:** OpenAI GPT-4o / GPT-4o-mini
- **Reranker:** Jina Reranker v2
- **PDF Parsing:** pdf-parse
- **Search:** Hybrid (Qdrant vector + custom BM25), Reciprocal Rank Fusion

## Project Structure

```
src/
  main.ts                     # Bootstrap: global prefix /api, CORS, validation, Swagger
  app.module.ts               # Root module
  config/                     # ConfigModule setup, env validation (Joi)
  database/                   # TypeORM module + entities (documents, query_logs, prompt_templates)
  health/                     # GET /api/health endpoint
  common/                     # Shared enums, filters, interceptors
  documents/                  # PDF upload, CRUD, chunking pipeline
  chunking/                   # Fixed-size, recursive, semantic chunking strategies
  embedding/                  # OpenAI embedding service
  qdrant/                     # Qdrant client wrapper
  bm25/                       # In-memory Okapi BM25 search
  query/                      # RAG query pipeline, query transformations
  reranker/                   # Jina reranker service
  generation/                 # GPT-4o generation + SSE streaming
```

## Key Commands

```bash
docker compose up -d          # Start MySQL + Qdrant
npm run start:dev             # Start NestJS in watch mode
npm run build                 # Compile TypeScript
npm run test                  # Run unit tests
npm run lint                  # Lint with auto-fix
```

## API Prefix

All endpoints are under `/api`. Swagger docs at `/api/docs`.

## Environment

Copy `.env.example` to `.env` and fill in API keys. MySQL and Qdrant run via Docker Compose.

## Conventions

- Use NestJS module pattern: each feature gets its own module, controller, service
- Entities use TypeORM decorators, snake_case column names
- DTOs use class-validator decorators for input validation
- Enums defined in `src/common/enums/` and shared across modules
- All query parameters and pipeline state logged to `query_logs` table for observability
- No authentication in this phase — intended for local/classroom use
