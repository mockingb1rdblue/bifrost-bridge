## Cost Management [pricepertoken](https://pricepertoken.com/pricing-page/model/perplexity-sonar)

```typescript
// src/cost-tracker.ts
export class CostTracker {
  private totalCost = 0;

  calculateCost(usage: Usage, model: string): number {
    const pricing = {
      sonar: { input: 1, output: 1 },
      'sonar-pro': { input: 5, output: 15 },
      'sonar-reasoning-pro': { input: 15, output: 45 },
    };

    const rates = pricing[model] || pricing['sonar-pro'];
    const cost =
      (usage.prompt_tokens / 1_000_000) * rates.input +
      (usage.completion_tokens / 1_000_000) * rates.output;

    this.totalCost += cost;
    return cost;
  }

  getTotalCost(): number {
    return this.totalCost;
  }
}
```

This plan gives you Perplexity research and chat capabilities that work behind your corporate firewall, integrate with CarPiggy, and fit into your portable development toolkit. [perplexity.mintlify](https://perplexity.mintlify.app/guides/perplexity-sdk)

---

Yes, you absolutely can! Antigravity supports **Function Calling** (Google Gemini's native tool system) directly without needing MCP. [ai.google](https://ai.google.dev/gemini-api/docs/tools)
