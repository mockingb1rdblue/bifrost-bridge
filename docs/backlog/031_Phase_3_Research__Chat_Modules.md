## Phase 3: Research & Chat Modules

### 3.1 **Research Agent** [perplexity.mintlify](https://perplexity.mintlify.app/guides/chat-completions-sdk)
```typescript
// src/research-agent.ts
export class ResearchAgent {
  constructor(private client: PerplexityClient) {}
  
  async conductResearch(topic: string, depth: 'quick' | 'standard' | 'deep' = 'standard') {
    const modelMap = {
      quick: 'sonar',
      standard: 'sonar-pro',
      deep: 'sonar-reasoning-pro'
    };
    
    const result = await this.client.research(
      `Research: ${topic}. Provide comprehensive analysis with citations.`,
      {
        model: modelMap[depth],
        return_citations: true,
        return_images: depth !== 'quick'
      }
    );
    
    return {
      answer: result.choices[0].message.content,
      citations: result.citations,
      images: result.images,
      usage: result.usage
    };
  }
  
  // Multi-query research with aggregation
  async deepDive(queries: string[]) {
    const results = await Promise.all(
      queries.map(q => this.conductResearch(q, 'standard'))
    );
    
    // Synthesize results
    const synthesis = await this.client.chat([
      {
        role: 'system',
        content: 'Synthesize the following research findings into a coherent analysis.'
      },
      {
        role: 'user',
        content: JSON.stringify(results.map(r => r.answer))
      }
    ], { model: 'sonar-reasoning-pro' });
    
    return {
      synthesis: synthesis.choices[0].message.content,
      individualFindings: results
    };
  }
}
```

### 3.2 **Chat Completion Service** [perplexity.mintlify](https://perplexity.mintlify.app/guides/chat-completions-sdk)
```typescript
// src/chat-service.ts
export class ChatService {
  private conversationHistory: Message[] = [];
  
  constructor(private client: PerplexityClient) {}
  
  async chat(userMessage: string, options?: {
    includeWebSearch?: boolean;
    maxTokens?: number;
  }) {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });
    
    const response = await this.client.chat(
      this.conversationHistory,
      {
        model: options?.includeWebSearch ? 'sonar-pro' : 'sonar',
        max_tokens: options?.maxTokens || 2000
      }
    );
    
    const assistantMessage = response.choices[0].message;
    this.conversationHistory.push(assistantMessage);
    
    return assistantMessage.content;
  }
  
  async streamChat(userMessage: string) {
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });
    
    return this.client.researchStream(userMessage);
  }
  
  clearHistory() {
    this.conversationHistory = [];
  }
}
```

***
