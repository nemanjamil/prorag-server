export interface EvaluationScores {
  faithfulness: number;
  relevance: number;
  completeness: number;
  overallScore: number;
  evaluatedAt: string;
  evaluatorModel: string;
}

export interface EvaluationReasoning {
  faithfulness: string;
  relevance: string;
  completeness: string;
}

export interface EvaluationDetail {
  queryLogId: number;
  queryText: string;
  answerText: string;
  scores: EvaluationScores;
  reasoning: EvaluationReasoning;
}

export interface LlmJudgeResponse {
  score: number;
  reasoning: string;
}
