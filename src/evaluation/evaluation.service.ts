import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { QueryLog } from '../database/entities/query-log.entity.js';
import type {
  EvaluationScores,
  EvaluationDetail,
  EvaluationReasoning,
  LlmJudgeResponse,
} from './interfaces/evaluation.js';
import {
  buildFaithfulnessPrompt,
  buildRelevancePrompt,
  buildCompletenessPrompt,
} from './evaluation-prompts.js';

@Injectable()
export class EvaluationService {
  private readonly logger = new Logger(EvaluationService.name);
  private readonly client: OpenAI;
  private readonly evalModel: string;

  constructor(
    @InjectRepository(QueryLog)
    private queryLogRepo: Repository<QueryLog>,
    private config: ConfigService,
  ) {
    this.client = new OpenAI({
      apiKey: this.config.get<string>('openai.apiKey'),
    });
    this.evalModel = this.config.get<string>('openai.evalModel') || 'gpt-4o-mini';
  }

  async evaluateQueryLog(id: number): Promise<EvaluationDetail> {
    const queryLog = await this.queryLogRepo.findOne({ where: { id } });
    if (!queryLog) {
      throw new NotFoundException(`Query log #${id} not found`);
    }
    if (!queryLog.answerText) {
      throw new BadRequestException(`Query log #${id} has no answer to evaluate`);
    }
    if (!queryLog.retrievedChunks || queryLog.retrievedChunks.length === 0) {
      throw new BadRequestException(`Query log #${id} has no retrieved chunks to evaluate against`);
    }

    const context = this.buildContextString(queryLog.retrievedChunks);
    const query = queryLog.queryText;
    const answer = queryLog.answerText;

    const faithfulnessPrompt = buildFaithfulnessPrompt(query, answer, context);
    const relevancePrompt = buildRelevancePrompt(query, answer, context);
    const completenessPrompt = buildCompletenessPrompt(query, answer, context);

    this.logger.log(`Evaluating query log #${id} with ${this.evalModel}`);

    const [faithfulness, relevance, completeness] = await Promise.all([
      this.callJudge(faithfulnessPrompt.system, faithfulnessPrompt.user),
      this.callJudge(relevancePrompt.system, relevancePrompt.user),
      this.callJudge(completenessPrompt.system, completenessPrompt.user),
    ]);

    const overallScore = Math.round(
      ((faithfulness.score + relevance.score + completeness.score) / 3) * 100,
    ) / 100;

    const scores: EvaluationScores = {
      faithfulness: faithfulness.score,
      relevance: relevance.score,
      completeness: completeness.score,
      overallScore,
      evaluatedAt: new Date().toISOString(),
      evaluatorModel: this.evalModel,
    };

    const reasoning: EvaluationReasoning = {
      faithfulness: faithfulness.reasoning,
      relevance: relevance.reasoning,
      completeness: completeness.reasoning,
    };

    queryLog.evaluationScores = { ...scores, reasoning };
    await this.queryLogRepo.save(queryLog);

    this.logger.log(
      `Query log #${id} evaluated: F=${faithfulness.score} R=${relevance.score} C=${completeness.score} Overall=${overallScore}`,
    );

    return {
      queryLogId: queryLog.id,
      queryText: query,
      answerText: answer,
      scores,
      reasoning,
    };
  }

  async getEvaluationDetail(id: number): Promise<EvaluationDetail> {
    const queryLog = await this.queryLogRepo.findOne({ where: { id } });
    if (!queryLog) {
      throw new NotFoundException(`Query log #${id} not found`);
    }
    if (!queryLog.evaluationScores) {
      throw new NotFoundException(`Query log #${id} has not been evaluated yet`);
    }

    const { reasoning, ...scores } = queryLog.evaluationScores;

    return {
      queryLogId: queryLog.id,
      queryText: queryLog.queryText,
      answerText: queryLog.answerText || '',
      scores,
      reasoning: reasoning || { faithfulness: '', relevance: '', completeness: '' },
    };
  }

  async listEvaluatedLogs(page: number, limit: number) {
    const [data, total] = await this.queryLogRepo.findAndCount({
      where: { evaluationScores: Not(IsNull()) },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  private buildContextString(chunks: any[]): string {
    return chunks
      .map((chunk: any, i: number) => `[Chunk ${i + 1}]: ${chunk.text}`)
      .join('\n\n');
  }

  private async callJudge(systemPrompt: string, userMessage: string): Promise<LlmJudgeResponse> {
    const response = await this.client.chat.completions.create({
      model: this.evalModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0,
      max_completion_tokens: 256,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    try {
      const parsed = JSON.parse(content);
      return {
        score: Math.max(0, Math.min(1, Number(parsed.score) || 0)),
        reasoning: String(parsed.reasoning || ''),
      };
    } catch {
      this.logger.warn(`Failed to parse judge response: ${content}`);
      return { score: 0, reasoning: 'Failed to parse evaluation response' };
    }
  }
}
