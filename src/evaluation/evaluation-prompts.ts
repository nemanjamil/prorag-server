const JUDGE_SYSTEM_PROMPT = `You are an expert evaluator for RAG (Retrieval-Augmented Generation) systems. You will be given a question, an answer, and the context that was used to generate the answer. Your job is to evaluate the answer on a specific criterion.

You MUST respond with a valid JSON object containing exactly two fields:
- "score": a number between 0 and 1 (inclusive), rounded to 2 decimal places
- "reasoning": a brief explanation (1-3 sentences) justifying your score

Do not include any text outside the JSON object.`;

export function buildFaithfulnessPrompt(
  query: string,
  answer: string,
  context: string,
): { system: string; user: string } {
  return {
    system: JUDGE_SYSTEM_PROMPT,
    user: `Evaluate FAITHFULNESS: Is every claim in the answer supported by the provided context? A score of 1.0 means every statement is directly grounded in the context with no hallucinated information. A score of 0.0 means the answer is entirely fabricated or contradicts the context.

**Question:** ${query}

**Context:**
${context}

**Answer:** ${answer}

Respond with JSON: {"score": <0-1>, "reasoning": "<explanation>"}`,
  };
}

export function buildRelevancePrompt(
  query: string,
  answer: string,
  context: string,
): { system: string; user: string } {
  return {
    system: JUDGE_SYSTEM_PROMPT,
    user: `Evaluate RELEVANCE: How well does the answer address the original question? A score of 1.0 means the answer directly and completely addresses what was asked. A score of 0.0 means the answer is entirely off-topic or unrelated to the question.

**Question:** ${query}

**Context:**
${context}

**Answer:** ${answer}

Respond with JSON: {"score": <0-1>, "reasoning": "<explanation>"}`,
  };
}

export function buildCompletenessPrompt(
  query: string,
  answer: string,
  context: string,
): { system: string; user: string } {
  return {
    system: JUDGE_SYSTEM_PROMPT,
    user: `Evaluate COMPLETENESS: How thoroughly does the answer cover the relevant information available in the context? A score of 1.0 means all key information from the context relevant to the question is included. A score of 0.0 means the answer barely touches on the available information.

**Question:** ${query}

**Context:**
${context}

**Answer:** ${answer}

Respond with JSON: {"score": <0-1>, "reasoning": "<explanation>"}`,
  };
}
