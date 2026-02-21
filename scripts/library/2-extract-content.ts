import { join } from 'path';
import { readFileSync, existsSync, readdirSync } from 'fs';
import Database from 'better-sqlite3';
import { GoogleGenAI } from '@google/genai';
import { createHash } from 'crypto';

const DB_PATH = join(process.cwd(), '.data', 'library.sqlite');

function getDb() {
  return new Database(DB_PATH);
}

// Ensure "zero local secrets" via execution from secure-connect.ts mapping GEMINI_API_KEY
const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  throw new Error(
    'GEMINI_API_KEY is not set. Run this with: npm run secure:exec npx tsx scripts/library/2-extract-content.ts',
  );
}
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

async function fetchSitemapLocs(sitemapUrl: string): Promise<string[]> {
  console.log(`fetching sitemaps from: ${sitemapUrl}`);
  const res = await fetch(sitemapUrl);
  const text = await res.text();
  const locMatches = text.match(/<loc>(.*?)<\/loc>/g) || [];
  return locMatches.map((loc) => loc.replace(/<\/?loc>/g, ''));
}

async function extractFlashLite(htmlContent: string) {
  const systemPrompt = `You are a documentation parsing engine. Extract the documentation from the provided HTML into purely structured Markdown. Drop navigation, sidebars, scripts, footers, and keep only the core educational/API content.`;
  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest', // alias for flash, we can use flash here if flash-lite is not explicitly registered or proxy remaps
    contents: htmlContent,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.1,
    },
  });
  return response.text || '';
}

async function processPage(url: string, db: Database.Database) {
  console.log(`Crawling: ${url}`);
  const res = await fetch(url);
  if (!res.body) return;

  // Node fetch stream reading approach
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sourceBuffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sourceBuffer += decoder.decode(value, { stream: true });
  }

  // For average doc pages, we can just grab the main body to avoid token blowing
  const bodyMatch =
    sourceBuffer.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
    sourceBuffer.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const contentToParse = bodyMatch ? bodyMatch[1] : sourceBuffer;

  const sourceHash = createHash('sha256').update(sourceBuffer).digest('hex');

  // Check if we already crawled this version
  const existing = db
    .prepare('SELECT id FROM immutable_chunks WHERE source_url = ? AND source_hash = ? LIMIT 1')
    .get(url, sourceHash);
  if (existing) {
    console.log(`Skipping ${url} - already ingested.`);
    return;
  }

  try {
    console.log(`Extracting markdown with Gemini for ${url}...`);
    const markdown = await extractFlashLite(contentToParse.substring(0, 500000)); // Safely chunk to prevent massive context if raw HTML is crazy

    const id = crypto.randomUUID();
    const sequence = 1;

    db.prepare(
      `
            INSERT INTO immutable_chunks (id, source_url, source_hash, ingestion_timestamp, chunk_sequence, header_hierarchy, chunk_type, content, concept_tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
    ).run(
      id,
      url,
      sourceHash,
      Date.now(),
      sequence,
      JSON.stringify(['Root']),
      'prose',
      markdown,
      JSON.stringify([]),
    );

    console.log(`✅ Saved ${url} into immutable_chunks.`);
  } catch (e: any) {
    console.error(`❌ Failed to extract ${url}:`, e.message);
  }
}

async function start() {
  const sitemapsDir = join(process.cwd(), 'docs', 'temp-library', 'raw', 'sitemaps');
  if (!existsSync(sitemapsDir)) {
    console.error(`No sitemaps directory found at ${sitemapsDir}. Run discover-urls first.`);
    return;
  }

  const files = readdirSync(sitemapsDir).filter((f) => f.endsWith('.json'));
  const db = getDb();

  for (const file of files) {
    const sitemapsJson = join(sitemapsDir, file);
    const content = readFileSync(sitemapsJson, 'utf-8');
    if (!content || content === '[]' || content === '') continue;

    const sitemaps: string[] = JSON.parse(content);
    if (sitemaps.length === 0) continue;

    console.log(`\n--- Processing sitemap source: ${file} ---`);
    const allUrls: string[] = [];

    for (const sitemap of sitemaps) {
      try {
        const urls = await fetchSitemapLocs(sitemap);
        allUrls.push(...urls);
      } catch (e: any) {
        console.error(`  ⚠️ Failed to fetch sitemap ${sitemap}:`, e.message);
      }
    }

    console.log(`  🔍 Discovered ${allUrls.length} pages in ${file}.`);

    // Process a representative batch from each sitemap (e.g., first 10)
    const batch = allUrls.slice(0, 10);
    for (const url of batch) {
      await processPage(url, db);
    }
  }

  db.close();
  console.log('\n✅ Finished bulk extraction.');
}

start().catch(console.error);
