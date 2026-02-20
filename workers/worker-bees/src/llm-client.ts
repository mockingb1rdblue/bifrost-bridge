export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  model?: string;
  maxTokens?: number;
}

/**
 *
 */
export class LLMClient {
  private routerUrl: string;
  private apiKey: string;

  /**
   *
   */
  constructor(routerUrl: string, apiKey: string) {
    this.routerUrl = routerUrl;
    this.apiKey = apiKey;
  }

  /**
   *
   */
  async chat(
    messages: LLMMessage[],
    taskType: string = 'coding',
    options?: LLMOptions,
  ): Promise<string> {
    try {
      const response = await fetch(`${this.routerUrl}/v1/llm/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages,
          taskType,
          options,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`LLM Request failed: ${response.status} ${text}`);
      }

      const data = (await response.json()) as any;
      return data.content || '';
    } catch (error: any) {
      console.error('[LLMClient] Error:', error.message);
      throw error;
    }
  }
}
