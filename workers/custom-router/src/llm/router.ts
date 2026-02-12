import { LLMClient, LLMMessage, LLMOptions, LLMProvider, LLMResponse } from './types';
import { LLMFactory, LLMConfig } from './factory';

export interface RoutingRequest {
    messages: LLMMessage[];
    options?: LLMOptions;
    taskType?: 'planning' | 'coding' | 'troubleshooting' | 'context-analysis';
    preferredProvider?: LLMProvider;
}

export class LLMRouter {
    private factory: LLMFactory;

    constructor(config: LLMConfig) {
        this.factory = new LLMFactory(config);
    }

    async route(request: RoutingRequest): Promise<LLMResponse> {
        const provider = this.selectProvider(request);
        const client = this.factory.get(provider);

        // Auto-adjust models based on provider and task
        const options = { ...request.options };
        if (!options.model) {
            options.model = this.getDefaultModel(provider, request.taskType);
        }

        return client.chat(request.messages, options);
    }

    private selectProvider(request: RoutingRequest): LLMProvider {
        if (request.preferredProvider) return request.preferredProvider;

        switch (request.taskType) {
            case 'planning':
                return 'anthropic';
            case 'troubleshooting':
                return 'openai'; // Perplexity Sonar
            case 'context-analysis':
                return 'gemini';
            case 'coding':
            default:
                // For coding, we check token counts (simplified check here)
                const totalCharCount = request.messages.reduce((sum, m) => sum + m.content.length, 0);
                if (totalCharCount > 100000) return 'gemini'; // Huge context
                return 'deepseek';
        }
    }

    private getDefaultModel(provider: LLMProvider, taskType?: string): string {
        switch (provider) {
            case 'anthropic':
                return 'claude-3-5-sonnet-20241022';
            case 'deepseek':
                return 'deepseek-chat';
            case 'gemini':
                return 'gemini-1.5-pro';
            case 'openai':
                return 'sonar-reasoning-pro';
            default:
                return '';
        }
    }
}
