import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private config: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.config.get<string>('openai.apiKey'),
    });
    this.model = this.config.get<string>('openai.embeddingModel') || 'text-embedding-3-large';
  }

  async embedBatch(
    texts: string[],
    batchSize = 100,
  ): Promise<{ vectors: number[][]; totalTokens: number }> {
    if (texts.length === 0) {
      return { vectors: [], totalTokens: 0 };
    }

    const allVectors: number[][] = [];
    let totalTokens = 0;

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      this.logger.log(
        `Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)} (${batch.length} texts)`,
      );

      const response = await this.client.embeddings.create({
        model: this.model,
        input: batch,
      });

      const batchVectors = response.data
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding);

      allVectors.push(...batchVectors);
      totalTokens += response.usage.total_tokens;
    }

    return { vectors: allVectors, totalTokens };
  }

  async embedSingle(text: string): Promise<{ vector: number[]; tokens: number }> {
    const { vectors, totalTokens } = await this.embedBatch([text]);
    return { vector: vectors[0], tokens: totalTokens };
  }
}
