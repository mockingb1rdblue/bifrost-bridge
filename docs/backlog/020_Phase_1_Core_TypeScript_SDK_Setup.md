## Phase 1: Core TypeScript SDK Setup

### 1.1 **Official SDK Integration** [npmjs](https://www.npmjs.com/package/@ai-sdk/perplexity)

```typescript
// src/perplexity-client.ts
import { Perplexity } from '@perplexity-sdk/node';

export class PerplexityClient {
  private client: Perplexity;

  constructor(apiKey: string) {
    this.client = new Perplexity({
      apiKey,
      baseURL: process.env.PERPLEXITY_BASE_URL, // For corporate proxy routing
    });
  }

  // Chat completion wrapper
  async chat(messages: Message[], options?: ChatOptions) {
    return await this.client.chat.completions.create({
      model: options?.model || 'sonar-pro',
      messages,
      stream: options?.stream || false,
      ...options,
    });
  }

  // Research-focused wrapper
  async research(query: string, options?: ResearchOptions) {
    return await this.client.chat.completions.create({
      model: 'sonar-reasoning-pro', // Best for deep research [web:65]
      messages: [
        {
          role: 'system',
          content: 'You are a research assistant. Provide comprehensive, well-cited answers.',
        },
        {
          role: 'user',
          content: query,
        },
      ],
      return_citations: true,
      return_images: options?.includeImages || false,
      search_domain_filter: options?.domainFilter,
      ...options,
    });
  }

  // Streaming research
  async *researchStream(query: string) {
    const stream = await this.client.chat.completions.create({
      model: 'sonar-pro',
      messages: [{ role: 'user', content: query }],
      stream: true,
    });

    for await (const chunk of stream) {
      yield chunk.choices[0]?.delta?.content || '';
    }
  }
}
```

### 1.2 **Model Selection Strategy** [glbgpt](https://www.glbgpt.com/hub/perplexity-api-cost-2025/)

```typescript
// src/models.ts
export const PERPLEXITY_MODELS = {
  // Fast & cheap for simple queries ($1/M tokens)
  SONAR: 'sonar',

  // Balanced for most research tasks ($5/M input, $15/M output)
  SONAR_PRO: 'sonar-pro',

  // Deep reasoning for complex analysis ($15/M input, $45/M output)
  SONAR_REASONING_PRO: 'sonar-reasoning-pro',
} as const;

export function selectModel(task: ResearchTask): string {
  if (task.complexity === 'simple' || task.maxCost < 0.01) {
    return PERPLEXITY_MODELS.SONAR;
  }
  if (task.requiresDeepReasoning) {
    return PERPLEXITY_MODELS.SONAR_REASONING_PRO;
  }
  return PERPLEXITY_MODELS.SONAR_PRO; // Default
}
```

---
