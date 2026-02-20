import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { GoogleGenAI } from '@google/genai';

const DB_PATH = join(process.cwd(), '.data', 'library.sqlite');

function getDb() {
  const db = new Database(DB_PATH);
  sqliteVec.load(db);
  return db;
}

const geminiApiKey = process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  throw new Error(
    'GEMINI_API_KEY is not set. Run this with: npm run secure:exec npx tsx scripts/library/4-synthesize-knowledge.ts',
  );
}
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

async function embedText(text: string): Promise<Float32Array> {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
  });
  return new Float32Array(response.embeddings![0].values!);
}

async function start() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/library/4-synthesize-knowledge.ts "<Query>"');
    process.exit(1);
  }
  const query = args.join(' ');

  console.log(`\n🔍 Performing RAG Search for: "${query}"\n`);

  // 1. Embed Query
  const queryVector = await embedText(query);

  const db = getDb();

  // 2. Vector Search (Top 5)
  // We join the embeddings table back to immutable_chunks to get the actual markdown content!
  const results = db
    .prepare(
      `
        SELECT 
            c.source_url,
            c.content,
            c.chunk_type,
            vec_distance_cosine(e.embedding, ?) as distance
        FROM embeddings e
        JOIN immutable_chunks c ON c.id = e.chunk_id
        WHERE e.embedding_model = 'gemini-embedding-001'
        ORDER BY distance ASC
        LIMIT 5
    `,
    )
    .all(new Uint8Array(queryVector.buffer)) as any[];

  if (results.length === 0) {
    console.log(
      '❌ No matching knowledge chunks found in the database. Have you run the extract/mine scripts?',
    );
    process.exit(0);
  }

  console.log(`✅ Retrieved ${results.length} contextual chunks. Generating synthesis report...`);

  // 3. Construct LLM Context
  let contextStr =
    'Here is the raw documentation knowledge retrieved from the local Vector Database:\n\n';
  results.forEach((r, i) => {
    contextStr += `--- [Source ${i + 1}: ${r.source_url}] [Type: ${r.chunk_type}] ---\n${r.content}\n\n`;
  });

  const prompt = `Synthesize a comprehensive engineering answer to the user query based ONLY on the provided Context. 
Output your answer as a clean MarkDown report. Do not invent details outside of the context.
If the context contains code, use it to form concrete examples.

Query: ${query}

${contextStr}`;

  // 4. Generate Synthesis
  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: prompt,
    config: {
      temperature: 0.2,
    },
  });

  const reportText = response.text || 'No report generated.';
  console.log('\n================ KNOWLEDGE SYNTHESIS ================\n');
  console.log(reportText);
  console.log('\n======================================================\n');

  const outDir = join(process.cwd(), 'docs', 'temp-library', 'synthesized');
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  const filename = query.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_report.md';
  const filepath = join(outDir, filename);
  writeFileSync(filepath, reportText);

  console.log(`💾 Synthesis locally cached at: ${filepath}`);
  db.close();
}

start().catch(console.error);
