import { PerplexityClient } from '../../workers/crypt-core/src/llm/perplexity';
import * as fs from 'fs';
import * as path from 'path';

const API_KEY = process.env.PROXY_API_KEY;

if (!API_KEY) {
  console.error('❌ Missing PROXY_API_KEY from Cloud Vault.');
  process.exit(1);
}

async function optimizeArchitecture() {
  console.log('🔍 Consulting Perplexity for Local Scraper Optimization...');
  const client = new PerplexityClient(API_KEY!);

  const strategyPath = path.resolve(
    __dirname,
    '../../docs/temp-library/local-documentation-strategy.md',
  );
  const architecturePath = path.resolve(
    __dirname,
    '../../docs/temp-library/local-knowledge-architecture.md',
  );

  const strategy = fs.readFileSync(strategyPath, 'utf8');
  const architecture = fs.readFileSync(architecturePath, 'utf8');

  const prompt = `
I am building a completely local documentation scraper pipeline to create "Immutable Truths" for my AI agents. 
The system must be highly performant, local-first (no deploy commands), and eventually migrate seamlessly to Cloudflare D1 and Vectorize.

Here is the current strategy:
---
${strategy}
---

Here is the architectural path to the cloud:
---
${architecture}
---

Please critically review this architecture and strategy.
1. Are there any bottlenecks or anti-patterns in using sqlite-vec alongside gemini-flash-lite for a completely local pipeline?
2. How can I optimize the "Content Extraction" phase (Phase 2) to ensure massive HTML pages don't blow up Node.js memory limits while still preserving the semantic structure (headers + code blocks) for SQLite?
3. What is the most robust way to structure the SQLite schema to guarantee a flawless 1:1 migration to Cloudflare D1 and Vectorize later?

Provide your optimized recommendations in markdown format. Be brutally honest about potential failure points.
`;

  try {
    const response = await client.chat([{ role: 'user', content: prompt }], {
      model: 'sonar-reasoning-pro',
    });

    console.log('\n=======================================\n');
    console.log(response.content);
    console.log('\n=======================================\n');

    fs.writeFileSync(
      path.resolve(__dirname, '../../docs/temp-library/perplexity-optimization.md'),
      response.content,
    );
    console.log('✅ Saved recommendations to docs/temp-library/perplexity-optimization.md');
  } catch (err) {
    console.error('❌ Failed to consult Perplexity:', err);
  }
}

optimizeArchitecture();
