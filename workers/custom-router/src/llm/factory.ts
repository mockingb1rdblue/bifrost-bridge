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
}

export class LLMFactory {
    private config: LLMConfig;

    constructor(config: LLMConfig) {
        this.config = config;
    }

    get(provider: LLMProvider): LLMClient {
        switch (provider) {
            case 'deepseek':
                if (!this.config.deepseekKey) throw new Error('Missing DEEPSEEK_API_KEY');
                return new DeepSeekClient(this.config.deepseekKey);
            case 'anthropic':
                if (!this.config.anthropicKey) throw new Error('Missing ANTHROPIC_API_KEY');
                return new AnthropicClient(this.config.anthropicKey);
            case 'gemini':
                if (!this.config.geminiKey) throw new Error('Missing GEMINI_API_KEY');
                return new GeminiClient(this.config.geminiKey);
            case 'openai': // Used for Perplexity or others
                if (!this.config.perplexityKey) throw new Error('Missing PERPLEXITY_API_KEY');
                return new PerplexityClient(this.config.perplexityKey);
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }
}
