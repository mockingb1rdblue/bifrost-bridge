import { DeepSeekClient } from './deepseek';
import { AnthropicClient } from './anthropic';
import { GeminiClient } from './gemini';
import { PerplexityClient } from './perplexity';
import { VellumClient } from './vellum';
import { LLMClient, LLMProvider } from './types';

export interface LLMConfig {
  vellumApiKey?: string;
  deepseekKey?: string;
  anthropicKey?: string;
  geminiKey?: string;
  perplexityKey?: string;
  // ... existing options ...
}

/**
 *
 */
export class LLMFactory {
  private config: LLMConfig;

  /**
   *
   */
  constructor(config: LLMConfig) {
    this.config = config;
  }

  /**
   *
   */
  get(provider: LLMProvider): LLMClient | null {
    // 🛡️ Vellum-First Strategy: If vellumApiKey is present, it handles routing
    if (this.config.vellumApiKey) {
      return new VellumClient(this.config.vellumApiKey);
    }

    switch (provider) {
      case 'deepseek':
        if (!this.config.deepseekKey) return null;
        return new DeepSeekClient(this.config.deepseekKey);
      case 'anthropic':
        if (!this.config.anthropicKey) return null;
        return new AnthropicClient(this.config.anthropicKey);
      case 'gemini':
        if (!this.config.geminiKey) return null;
        return new GeminiClient(this.config.geminiKey);
      case 'openai':
        if (!this.config.perplexityKey) return null;
        return new PerplexityClient(this.config.perplexityKey);
      default:
        return null;
    }
  }
}
