# ProRAG — PDF-Based RAG Learning Platform

An educational platform for learning RAG (Retrieval-Augmented Generation) internals with full pipeline observability, experimentation controls, and evaluation.

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- OpenAI API key
- Jina API key (for reranking)

## Project Structure

```
ragpro/
  prorag-server/    # NestJS backend (this repo)
  prorag-web/       # React frontend
```

## Quick Start

### 1. Start infrastructure

From the server directory, start MySQL and Qdrant:

```bash
cd prorag-server
docker compose up -d
```

This starts:
- **MySQL 8.0** on port 3306
- **Qdrant** on port 6333 — Dashboard: `http://localhost:6333/dashboard`, REST API: `http://localhost:6333/collections`

### 2. Configure the backend

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```
OPENAI_API_KEY=sk-...
JINA_API_KEY=jina_...
```

All other defaults work out of the box for local development.

### 3. Install and start the backend

```bash
npm install
npm run start:dev
```

The API starts at `http://localhost:3000/api`. Swagger docs at `http://localhost:3000/api/docs`.

### 4. Install and start the frontend

```bash
cd ../prorag-web
npm install
npm run dev
```

The frontend starts at `http://localhost:5173`.

## Useful Links

| Service | URL |
|---|---|
| Backend API | http://localhost:3000/api |
| Swagger Docs | http://localhost:3000/api/docs |
| Health Check | http://localhost:3000/api/health |
| Qdrant Dashboard | http://localhost:6333/dashboard |
| Frontend | http://localhost:5173 |

## Available Scripts

### Backend (`prorag-server`)

| Command | Description |
|---|---|
| `npm run start:dev` | Start in watch mode |
| `npm run build` | Compile TypeScript |
| `npm run test` | Run unit tests |
| `npm run lint` | Lint with auto-fix |

### Frontend (`prorag-web`)

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Lint |
| `npm run preview` | Preview production build |

## Tech Stack

**Backend:** NestJS 11, TypeORM, MySQL 8, Qdrant, OpenAI (embeddings + LLM), Jina Reranker v2, pdf-parse

**Frontend:** React 19, Vite 7, TypeScript 5.9, Tailwind v4, shadcn/ui, TanStack Query v5, React Router
