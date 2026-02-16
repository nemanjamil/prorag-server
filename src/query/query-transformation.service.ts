import { Injectable, Logger } from '@nestjs/common';
import { QueryStrategy } from '../common/enums/query-strategy.enum.js';
import { GenerationService } from '../generation/generation.service.js';

export interface TransformationResult {
  searchQueries: string[];
  promptTokens: number;
  completionTokens: number;
  description: string;
}

@Injectable()
export class QueryTransformationService {
  private readonly logger = new Logger(QueryTransformationService.name);

  constructor(private generationService: GenerationService) {}

  async transform(
    query: string,
    strategy: QueryStrategy,
    temperature: number,
  ): Promise<TransformationResult> {
    switch (strategy) {
      case QueryStrategy.DIRECT:
        return this.direct(query);
      case QueryStrategy.HYDE:
        return this.hyde(query, temperature);
      case QueryStrategy.MULTI_QUERY:
        return this.multiQuery(query, temperature);
      case QueryStrategy.STEP_BACK:
        return this.stepBack(query, temperature);
      default:
        return this.direct(query);
    }
  }

  private direct(query: string): TransformationResult {
    return {
      searchQueries: [query],
      promptTokens: 0,
      completionTokens: 0,
      description: 'Direct query — no transformation applied',
    };
  }

  private async hyde(query: string, temperature: number): Promise<TransformationResult> {
    const systemPrompt =
      'You are a helpful assistant. Given a question, write a detailed paragraph that would ' +
      'appear in a document answering this question. Do not include any preamble — just write ' +
      'the hypothetical answer paragraph directly.';

    const result = await this.generationService.generate(systemPrompt, query, temperature);
    this.logger.log(`HyDE generated hypothetical document (${result.text.length} chars)`);

    return {
      searchQueries: [result.text],
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      description: 'HyDE — searching with hypothetical document embedding',
    };
  }

  private async multiQuery(query: string, temperature: number): Promise<TransformationResult> {
    const systemPrompt =
      'You are a helpful assistant. Given a question, generate 4 different rephrasings of the ' +
      'same question to improve search recall. Return ONLY the 4 questions, one per line, ' +
      'without numbering or bullet points.';

    const result = await this.generationService.generate(systemPrompt, query, temperature);
    const queries = result.text
      .split('\n')
      .map((q) => q.trim())
      .filter((q) => q.length > 0);

    this.logger.log(`Multi-query generated ${queries.length} rephrasings`);

    return {
      searchQueries: [query, ...queries],
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      description: `Multi-query — searching with original + ${queries.length} rephrasings`,
    };
  }

  private async stepBack(query: string, temperature: number): Promise<TransformationResult> {
    const systemPrompt =
      'You are a helpful assistant. Given a specific question, generate a single broader, ' +
      'more general "step-back" question that would help retrieve relevant background context. ' +
      'Return ONLY the step-back question, nothing else.';

    const result = await this.generationService.generate(systemPrompt, query, temperature);
    const stepBackQuery = result.text.trim();
    this.logger.log(`Step-back generated: "${stepBackQuery}"`);

    return {
      searchQueries: [query, stepBackQuery],
      promptTokens: result.promptTokens,
      completionTokens: result.completionTokens,
      description: 'Step-back — searching with original + broader question',
    };
  }
}
