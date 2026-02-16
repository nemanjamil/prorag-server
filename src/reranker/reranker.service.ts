import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RerankerResult {
  originalIndex: number;
  text: string;
  relevanceScore: number;
}

const JINA_RERANK_URL = 'https://api.jina.ai/v1/rerank';
const JINA_MODEL = 'jina-reranker-v2-base-multilingual';

@Injectable()
export class RerankerService {
  private readonly logger = new Logger(RerankerService.name);
  private readonly apiKey: string;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('jina.apiKey') || '';
  }

  async rerank(
    query: string,
    documents: { text: string; index: number }[],
    topN: number,
  ): Promise<RerankerResult[]> {
    if (!this.apiKey) {
      throw new BadRequestException(
        'JINA_API_KEY is not configured. Disable reranking or set the key.',
      );
    }

    if (documents.length === 0) return [];

    const response = await fetch(JINA_RERANK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: JINA_MODEL,
        query,
        documents: documents.map((d) => d.text),
        top_n: topN,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Jina rerank failed (${response.status}): ${body}`);
      throw new BadRequestException(`Jina reranker error: ${response.status}`);
    }

    const json = (await response.json()) as {
      results: { index: number; relevance_score: number; document: { text: string } }[];
    };

    return json.results.map((r) => ({
      originalIndex: documents[r.index].index,
      text: r.document.text,
      relevanceScore: r.relevance_score,
    }));
  }
}
