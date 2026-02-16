export interface AnalyticsSummary {
  totalQueries: number;
  totalCostUsd: number;
  avgCostPerQuery: number;
  totalEmbeddingTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  avgLatencyMs: number;
}

export interface ModelBreakdown {
  model: string;
  queryCount: number;
  totalCostUsd: number;
  avgCostPerQuery: number;
  totalTokens: number;
}

export interface StrategyBreakdown {
  strategy: string;
  queryCount: number;
  totalCostUsd: number;
  avgLatencyMs: number;
}

export interface SearchModeBreakdown {
  searchMode: string;
  queryCount: number;
  totalCostUsd: number;
  avgLatencyMs: number;
}

export interface DailyCostTrend {
  date: string;
  totalCostUsd: number;
  queryCount: number;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummary;
  byModel: ModelBreakdown[];
  byStrategy: StrategyBreakdown[];
  bySearchMode: SearchModeBreakdown[];
  dailyTrend: DailyCostTrend[];
}
