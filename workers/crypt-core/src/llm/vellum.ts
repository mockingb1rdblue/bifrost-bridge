import { VellumClient as VellumSDK } from 'vellum-ai';
import { LLMClient, LLMMessage, LLMOptions, LLMResponse } from './types';

/**
 *
 */
export class VellumClient implements LLMClient {
  private client: VellumSDK;

  /**
   *
   */
  constructor(apiKey: string) {
    this.client = new VellumSDK({
      apiKey,
    });
  }

  /**
   *
   */
  async chat(messages: LLMMessage[], options: LLMOptions): Promise<LLMResponse> {
    console.log(`[VellumClient] Routing request for model: ${options.model}`);

    // Map model strings to Vellum Deployment Names if needed,
    // or pass through if the model name IS the deployment name.
    const deploymentName = options.model || 'default-coding-deployment';

    try {
      const response = await this.client.executePrompt({
        promptDeploymentName: deploymentName,
        inputs: [
          {
            type: 'CHAT_HISTORY',
            name: 'chat_history',
            value: messages.map((m) => ({
              role: m.role.toUpperCase() as any,
              text: m.content,
            })),
          },
        ],
      });

      if (!('outputs' in response) || !response.outputs || response.outputs.length === 0) {
        throw new Error(
          `Vellum prompt execution failed or was rejected: ${JSON.stringify(response)}`,
        );
      }

      const output = response.outputs[0];
      if (!output || output.type !== 'STRING') {
        throw new Error(`Unexpected Vellum output type or missing output: ${output?.type}`);
      }

      return {
        content: output.value as string,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        model: deploymentName,
        provider: 'openai', // Vellum acts as a unified proxy
      };
    } catch (error: any) {
      console.error('[VellumClient] Error:', error.message);
      throw error;
    }
  }
}
