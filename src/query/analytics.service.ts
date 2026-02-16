import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryLog } from '../database/entities/query-log.entity.js';
import type {
  AnalyticsResponse,
  AnalyticsSummary,
  ModelBreakdown,
  StrategyBreakdown,
  SearchModeBreakdown,
  DailyCostTrend,
} from './interfaces/analytics.js';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(QueryLog)
    private queryLogRepo: Repository<QueryLog>,
  ) {}

  async getAnalytics(days: number): Promise<AnalyticsResponse> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [summaryRaw, byModelRaw, byStrategyRaw, bySearchModeRaw, dailyTrendRaw] =
      await Promise.all([
        this.getSummary(since),
        this.getByModel(since),
        this.getByStrategy(since),
        this.getBySearchMode(since),
        this.getDailyTrend(since),
      ]);

    return {
      summary: summaryRaw,
      byModel: byModelRaw,
      byStrategy: byStrategyRaw,
      bySearchMode: bySearchModeRaw,
      dailyTrend: dailyTrendRaw,
    };
  }

  private async getSummary(since: Date): Promise<AnalyticsSummary> {
    const result = await this.queryLogRepo
      .createQueryBuilder('ql')
      .select('COUNT(*)', 'totalQueries')
      .addSelect('COALESCE(SUM(ql.estimated_cost_usd), 0)', 'totalCostUsd')
      .addSelect('COALESCE(AVG(ql.estimated_cost_usd), 0)', 'avgCostPerQuery')
      .addSelect('COALESCE(SUM(ql.embedding_tokens), 0)', 'totalEmbeddingTokens')
      .addSelect('COALESCE(SUM(ql.prompt_tokens), 0)', 'totalPromptTokens')
      .addSelect('COALESCE(SUM(ql.completion_tokens), 0)', 'totalCompletionTokens')
      .addSelect('COALESCE(AVG(ql.total_ms), 0)', 'avgLatencyMs')
      .where('ql.created_at >= :since', { since })
      .getRawOne();

    return {
      totalQueries: parseInt(result.totalQueries, 10) || 0,
      totalCostUsd: parseFloat(result.totalCostUsd) || 0,
      avgCostPerQuery: parseFloat(result.avgCostPerQuery) || 0,
      totalEmbeddingTokens: parseInt(result.totalEmbeddingTokens, 10) || 0,
      totalPromptTokens: parseInt(result.totalPromptTokens, 10) || 0,
      totalCompletionTokens: parseInt(result.totalCompletionTokens, 10) || 0,
      avgLatencyMs: parseFloat(result.avgLatencyMs) || 0,
    };
  }

  private async getByModel(since: Date): Promise<ModelBreakdown[]> {
    const results = await this.queryLogRepo
      .createQueryBuilder('ql')
      .select('ql.llm_model', 'model')
      .addSelect('COUNT(*)', 'queryCount')
      .addSelect('COALESCE(SUM(ql.estimated_cost_usd), 0)', 'totalCostUsd')
      .addSelect('COALESCE(AVG(ql.estimated_cost_usd), 0)', 'avgCostPerQuery')
      .addSelect(
        'COALESCE(SUM(ql.embedding_tokens + ql.prompt_tokens + ql.completion_tokens), 0)',
        'totalTokens',
      )
      .where('ql.created_at >= :since', { since })
      .groupBy('ql.llm_model')
      .getRawMany();

    return results.map((r) => ({
      model: r.model,
      queryCount: parseInt(r.queryCount, 10) || 0,
      totalCostUsd: parseFloat(r.totalCostUsd) || 0,
      avgCostPerQuery: parseFloat(r.avgCostPerQuery) || 0,
      totalTokens: parseInt(r.totalTokens, 10) || 0,
    }));
  }

  private async getByStrategy(since: Date): Promise<StrategyBreakdown[]> {
    const results = await this.queryLogRepo
      .createQueryBuilder('ql')
      .select('ql.query_strategy', 'strategy')
      .addSelect('COUNT(*)', 'queryCount')
      .addSelect('COALESCE(SUM(ql.estimated_cost_usd), 0)', 'totalCostUsd')
      .addSelect('COALESCE(AVG(ql.total_ms), 0)', 'avgLatencyMs')
      .where('ql.created_at >= :since', { since })
      .groupBy('ql.query_strategy')
      .getRawMany();

    return results.map((r) => ({
      strategy: r.strategy,
      queryCount: parseInt(r.queryCount, 10) || 0,
      totalCostUsd: parseFloat(r.totalCostUsd) || 0,
      avgLatencyMs: parseFloat(r.avgLatencyMs) || 0,
    }));
  }

  private async getBySearchMode(since: Date): Promise<SearchModeBreakdown[]> {
    const results = await this.queryLogRepo
      .createQueryBuilder('ql')
      .select('ql.search_mode', 'searchMode')
      .addSelect('COUNT(*)', 'queryCount')
      .addSelect('COALESCE(SUM(ql.estimated_cost_usd), 0)', 'totalCostUsd')
      .addSelect('COALESCE(AVG(ql.total_ms), 0)', 'avgLatencyMs')
      .where('ql.created_at >= :since', { since })
      .groupBy('ql.search_mode')
      .getRawMany();

    return results.map((r) => ({
      searchMode: r.searchMode,
      queryCount: parseInt(r.queryCount, 10) || 0,
      totalCostUsd: parseFloat(r.totalCostUsd) || 0,
      avgLatencyMs: parseFloat(r.avgLatencyMs) || 0,
    }));
  }

  private async getDailyTrend(since: Date): Promise<DailyCostTrend[]> {
    const results = await this.queryLogRepo
      .createQueryBuilder('ql')
      .select('DATE_FORMAT(ql.created_at, \'%Y-%m-%d\')', 'date')
      .addSelect('COALESCE(SUM(ql.estimated_cost_usd), 0)', 'totalCostUsd')
      .addSelect('COUNT(*)', 'queryCount')
      .where('ql.created_at >= :since', { since })
      .groupBy('DATE_FORMAT(ql.created_at, \'%Y-%m-%d\')')
      .orderBy('date', 'ASC')
      .getRawMany();

    return results.map((r) => ({
      date: r.date,
      totalCostUsd: parseFloat(r.totalCostUsd) || 0,
      queryCount: parseInt(r.queryCount, 10) || 0,
    }));
  }
}
