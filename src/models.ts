/**
 * Perplexity AI Models
 * https://docs.perplexity.ai/docs/model-cards
 */
export const PERPLEXITY_MODELS = {
  // Fast & cheap for simple queries
  SONAR: 'sonar',

  // Balanced for most research tasks
  SONAR_PRO: 'sonar-pro',

  // Deep reasoning for complex analysis
  SONAR_REASONING_PRO: 'sonar-reasoning-pro',
} as const;

export interface ResearchTask {
  complexity: 'simple' | 'medium' | 'complex';
  requiresDeepReasoning?: boolean;
  maxCost?: number;
}

export function selectModel(task: ResearchTask): string {
  if (task.requiresDeepReasoning || task.complexity === 'complex') {
    return PERPLEXITY_MODELS.SONAR_REASONING_PRO;
  }
  if (task.complexity === 'simple' && (!task.maxCost || task.maxCost < 0.01)) {
    return PERPLEXITY_MODELS.SONAR;
  }
  return PERPLEXITY_MODELS.SONAR_PRO; // Default
}
