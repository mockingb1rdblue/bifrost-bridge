import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function queryPerplexity() {
  const apiKey = process.env.PROXY_API_KEY || process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PROXY_API_KEY or PERPLEXITY_API_KEY must be set in the environment.');
  }

  const baseUrl = process.env.PERPLEXITY_BASE_URL || 'https://api.perplexity.ai';

  const systemPrompt = `You are an expert AI architect assisting in building an autonomous AI agent swarm called Sluagh, which bridges GitHub, Linear, and an AI execution environment.
We have set up a local documentation RAG ingestion pipeline to provide our agents with the latest API contexts.
Return your response in clean Markdown format with structured bullet points.`;

  const currentStack = `
Our current architecture relies on:
1. Core Runtime: Node.js (via tsx locally, and deployed to Cloudflare Workers).
2. Infrastructure: Cloudflare Workers (Durable Objects for routing and state, KV for secret management), Fly.io (Docker machines for Worker Bees performing long-running file system / git tasks).
3. Project Management: Linear (GraphQL API and Webhooks).
4. Code / SCM: GitHub API (creating branches, PRs).
5. AI Models: Google Gemini (flash, flash-lite, pro via @google/genai), DeepSeek Chat (via OpenAI SDK compat), Perplexity Sonar.
6. Local Knowledge DB: SQLite (WAL mode) via better-sqlite3 with the sqlite-vec extension.
7. Future Cloud Knowledge DB: Cloudflare D1 and Vectorize.

We are currently ingesting the documentation and API references for these explicit technologies.
Task: Based on modern AI agent development, TypeScript tooling, vector search patterns, and Cloudflare/Fly.io nuances, what **other specific documentation sites, API guides, frameworks, or libraries** are CRITICAL for our AI swarm to understand but are missing from our ingestion list? Justify each recommendation briefly.`;

  console.log(`🔍 Querying Perplexity for Architecture Documentation Recommendations...`);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: currentStack },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to query Perplexity (${response.status}): ${err}`);
  }

  const data = (await response.json()) as any;
  const content = data.choices[0].message.content.trim();

  console.log(`\n✅ Perplexity Recommendations Received:\n`);
  console.log(content);

  const outDir = join(process.cwd(), 'docs', 'temp-library');
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const filepath = join(outDir, 'stack-recommendations.md');
  writeFileSync(filepath, content);
  console.log(`\n💾 Saved recommendations to ${filepath}`);
}

queryPerplexity().catch(console.error);
