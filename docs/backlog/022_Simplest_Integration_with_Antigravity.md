## Simplest Integration with Antigravity

If you just want to use it in Antigravity code editor:

```typescript
// In any Antigravity editor file
import { PerplexityClient } from '@your-org/perplexity-client';

const pplx = new PerplexityClient(process.env.PERPLEXITY_API_KEY!);

async function main() {
  const result = await pplx.research('my question');
  console.log(result);
}
```

Then run it: Antigravity has Chrome access, so it can execute this directly. [cloud.google](https://cloud.google.com/blog/products/data-analytics/connect-google-antigravity-ide-to-googles-data-cloud-services)

**You don't need MCP unless you want Antigravity's AI agent to autonomously decide when to call Perplexity**. If you're just writing code that calls Perplexity, use the simple TypeScript client approach. [docs.perplexity](https://docs.perplexity.ai/getting-started/quickstart)
