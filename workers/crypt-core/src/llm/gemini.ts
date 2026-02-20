import { GoogleGenAI } from '@google/genai';
import { LLMClient, LLMMessage, LLMOptions, LLMResponse } from './types';

/**
 *
 */
export class GeminiClient implements LLMClient {
  private client: GoogleGenAI;

  /**
   *
   */
  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  /**
   *
   */
  async chat(messages: LLMMessage[], options: LLMOptions = {}): Promise<LLMResponse> {
    const model = options.model || 'gemini-flash-latest';

    // Extract system instruction if present
    const systemInstruction = messages.find((m) => m.role === 'system')?.content;

    // Format messages for GenAI SDK
    // Map 'assistant' back to the API's expected 'model' role, 'user' remains 'user'.
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const response = await this.client.models.generateContent({
      model: model,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        maxOutputTokens: options.maxTokens,
        temperature: options.temperature ?? 0.7,
        stopSequences: options.stopSequences,
      },
    });

    const textOutput = response.text || '';
    const usageData = response.usageMetadata;

    return {
      content: textOutput,
      usage: {
        promptTokens: usageData?.promptTokenCount || 0,
        completionTokens: usageData?.candidatesTokenCount || 0,
        totalTokens: usageData?.totalTokenCount || 0,
      },
      model,
      provider: 'gemini',
    };
  }
}
