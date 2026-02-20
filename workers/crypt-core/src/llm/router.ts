import { LLMClient, LLMMessage, LLMOptions, LLMProvider, LLMResponse } from './types';
import { LLMFactory, LLMConfig } from './factory';

export interface RoutingRequest {
    messages: LLMMessage[];
    options?: LLMOptions;
    taskType?: 'planning' | 'coding' | 'troubleshooting' | 'context-analysis' | 'research' | 'triage';
    preferredProvider?: LLMProvider;
}

export class LLMRouter {
    private factory: LLMFactory;

    constructor(config: LLMConfig) {
        this.factory = new LLMFactory(config);
    }

    async route(request: RoutingRequest): Promise<LLMResponse> {
        let provider = this.selectProvider(request);

        // Key-check fallback
        if (!this.isValidProvider(provider)) {
            provider = this.getFallbackProvider(provider);
        }

        const client = this.factory.get(provider);

        // Auto-adjust models based on provider and task
        const options = { ...request.options };
        if (!options.model) {
            options.model = this.getDefaultModel(provider, request.taskType);
        }

        if (!client) {
            throw new Error(`Client for provider ${provider} could not be initialized.`);
        }

        return client.chat(request.messages, options);
    }

    private isValidProvider(provider: LLMProvider): boolean {
        // factory knows the keys
        return !!this.factory.get(provider);
    }

    private getFallbackProvider(failed: LLMProvider): LLMProvider {
        const priority: LLMProvider[] = ['anthropic', 'deepseek', 'gemini', 'openai'];
        return priority.find(p => p !== failed && this.isValidProvider(p)) || 'gemini';
    }

    private selectProvider(request: RoutingRequest): LLMProvider {
        if (request.preferredProvider) return request.preferredProvider;

        switch (request.taskType) {
            case 'planning':
                return 'anthropic';
            case 'troubleshooting':
                return 'openai'; // Perplexity / Sonar
            case 'context-analysis':
            case 'research':
                return 'gemini';
            case 'triage':
                return 'gemini'; // Fast/Cheap
            case 'coding':
            default:
                const totalCharCount = request.messages.reduce((sum, m) => sum + m.content.length, 0);
                if (totalCharCount > 100000) return 'gemini';
                return 'anthropic';
        }
    }

    private getDefaultModel(provider: LLMProvider, taskType?: string): string {
        switch (provider) {
            case 'anthropic':
                return 'claude-3-5-sonnet-20241022';
            case 'deepseek':
                return 'deepseek-chat';
            case 'gemini':
                return taskType === 'triage' ? 'gemini-1.5-flash' : 'gemini-1.5-pro';
            case 'openai':
                return 'sonar-reasoning-pro';
            default:
                return '';
        }
    }
}
