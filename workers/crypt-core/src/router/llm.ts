import { LLMRouter, RoutingRequest } from '../llm/router';
import { LLMResponse } from '../llm/types';
import { EventStoreClient } from '../events';
import { RouterStateManager } from './state';

export class RouterLLMManager {
  constructor(
    private llmRouter: LLMRouter,
    private events: EventStoreClient,
    private stateManager: RouterStateManager
  ) {}

  async routeLLM(request: RoutingRequest): Promise<LLMResponse> {
    try {
      // 1. Fetch Optimized Prompts from Shared Memory
      let optimizedMessages = request.messages;
      const meshResult = (await this.events.getState('global-optimization')) as any;
      const optimizationState = meshResult?.state;

      const optKey = `optimizedPrompt_${request.taskType || 'default'} `;
      if (optimizationState && optimizationState[optKey]) {
        const optimizedPrompt = optimizationState[optKey];
        optimizedMessages = [
          { role: 'system', content: `[OPTIMIZATION_ACTIVE] ${optimizedPrompt} ` },
          ...request.messages,
        ];
      }

      // 2. Route to LLM
      const result = await this.llmRouter.route({
        ...request,
        messages: optimizedMessages,
      });

      // 3. Record Metrics
      await this.stateManager.recordProviderMetric(
        result.provider,
        'success',
        result.usage.totalTokens
      );

      return result;
    } catch (e: any) {
      // We don't logError here directly as it needs the DO's context, 
      // but we throw for the caller to handle.
      throw e;
    }
  }
}
