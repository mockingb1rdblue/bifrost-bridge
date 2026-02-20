import { join } from 'path';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

async function fetchSitemaps(target: string) {
  const apiKey = process.env.PROXY_API_KEY || process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error('PROXY_API_KEY or PERPLEXITY_API_KEY must be set in the environment.');
  }

  const baseUrl = process.env.PERPLEXITY_BASE_URL || 'https://api.perplexity.ai';

  const systemPrompt = `You are a bot that finds the official sitemap.xml URLs for software documentation.
Return ONLY a JSON array of string URLs. Do not include markdown, explanations, or any other text.
Example output: ["https://developers.cloudflare.com/sitemap.xml", "https://developers.cloudflare.com/workers/sitemap.xml"]`;

  console.log(`🔍 Querying Perplexity for documentation sitemaps for: ${target}`);

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
        {
          role: 'user',
          content: `Find the official sitemap.xml URLs for the documentation of: ${target}`,
        },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Failed to query Perplexity (${response.status}): ${err}`);
  }

  const data = (await response.json()) as any;
  let content = data.choices[0].message.content.trim();

  // Clean up potential markdown blocks
  if (content.startsWith('\`\`\`json')) {
    content = content
      .replace(/^\`\`\`json/g, '')
      .replace(/\`\`\`$/g, '')
      .trim();
  } else if (content.startsWith('\`\`\`')) {
    content = content
      .replace(/^\`\`\`/g, '')
      .replace(/\`\`\`$/g, '')
      .trim();
  }

  let urls: string[] = [];
  try {
    urls = JSON.parse(content);
    if (!Array.isArray(urls)) {
      throw new Error('Expected a JSON array of URLs.');
    }
  } catch (e: any) {
    console.error('Failed to parse JSON response:', content);
    throw e;
  }

  console.log(`✅ Found ${urls.length} sitemaps:`, urls);

  const outDir = join(process.cwd(), 'docs', 'temp-library', 'raw', 'sitemaps');
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const filename = target.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_sitemaps.json';
  const filepath = join(outDir, filename);

  writeFileSync(filepath, JSON.stringify(urls, null, 2));
  console.log(`💾 Saved to ${filepath}`);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npx tsx scripts/library/1-discover-urls.ts "<target software>"');
  process.exit(1);
}

const target = args.join(' ');
fetchSitemaps(target).catch(console.error);
