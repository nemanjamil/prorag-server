import { QdrantSearchResult } from '../qdrant/qdrant.service.js';
import { Bm25SearchResult } from '../bm25/bm25.service.js';
import { RetrievedChunk } from './interfaces/pipeline-context.js';

export function reciprocalRankFusion(
  vectorResults: QdrantSearchResult[],
  bm25Results: Bm25SearchResult[],
  vectorWeight: number,
  k: number,
): RetrievedChunk[] {
  const chunkMap = new Map<string, RetrievedChunk>();

  // Process vector results
  for (let rank = 0; rank < vectorResults.length; rank++) {
    const r = vectorResults[rank];
    const key = `${r.documentId}:${r.chunkIndex}`;
    chunkMap.set(key, {
      documentId: r.documentId,
      chunkIndex: r.chunkIndex,
      pageNumber: r.pageNumber,
      text: r.text,
      chunkStrategy: r.chunkStrategy,
      vectorRank: rank + 1,
      vectorScore: r.score,
      bm25Rank: null,
      bm25Score: null,
      rrfScore: vectorWeight / (k + rank + 1),
      rerankerScore: null,
      source: 'vector',
    });
  }

  // Process BM25 results
  for (let rank = 0; rank < bm25Results.length; rank++) {
    const r = bm25Results[rank];
    const key = `${r.documentId}:${r.chunkIndex}`;
    const existing = chunkMap.get(key);

    if (existing) {
      existing.bm25Rank = rank + 1;
      existing.bm25Score = r.score;
      existing.rrfScore! += (1 - vectorWeight) / (k + rank + 1);
      existing.source = 'both';
    } else {
      chunkMap.set(key, {
        documentId: r.documentId,
        chunkIndex: r.chunkIndex,
        pageNumber: null,
        text: r.text,
        chunkStrategy: '',
        vectorRank: null,
        vectorScore: null,
        bm25Rank: rank + 1,
        bm25Score: r.score,
        rrfScore: (1 - vectorWeight) / (k + rank + 1),
        rerankerScore: null,
        source: 'bm25',
      });
    }
  }

  const results = Array.from(chunkMap.values());
  results.sort((a, b) => (b.rrfScore ?? 0) - (a.rrfScore ?? 0));
  return results;
}
