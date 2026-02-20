import { DeepSeekClient } from './deepseek';
import { AnthropicClient } from './anthropic';
import { GeminiClient } from './gemini';
import { PerplexityClient } from './perplexity';
import { LLMClient, LLMProvider } from './types';

export interface LLMConfig {
    deepseekKey?: string;
    anthropicKey?: string;
    geminiKey?: string;
    perplexityKey?: string;
    deepseekBaseUrl?: string;
    anthropicBaseUrl?: string;
    geminiBaseUrl?: string;
}

export class LLMFactory {
    private config: LLMConfig;

    constructor(config: LLMConfig) {
        this.config = config;
    }

    get(provider: LLMProvider): LLMClient | null {
        switch (provider) {
            case 'deepseek':
                if (!this.config.deepseekKey) return null;
                return new DeepSeekClient(this.config.deepseekKey, this.config.deepseekBaseUrl);
            case 'anthropic':
                if (!this.config.anthropicKey) return null;
                return new AnthropicClient(this.config.anthropicKey, this.config.anthropicBaseUrl);
            case 'gemini':
                if (!this.config.geminiKey) return null;
                return new GeminiClient(this.config.geminiKey);
            case 'openai': // Used for Perplexity or others
                if (!this.config.perplexityKey) return null;
                return new PerplexityClient(this.config.perplexityKey);
            default:
                return null;
        }
    }
}
