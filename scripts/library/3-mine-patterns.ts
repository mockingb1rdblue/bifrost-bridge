import { join } from 'path';
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
    'GEMINI_API_KEY is not set. Run this with: npm run secure:exec npx tsx scripts/library/3-mine-patterns.ts',
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

function extractCodeBlocks(markdown: string): Array<{ language: string; code: string }> {
  const regex = /```([a-z0-9_-]*)\n([\s\S]*?)```/g;
  const blocks = [];
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    blocks.push({
      language: match[1] || 'plaintext',
      code: match[2].trim(),
    });
  }
  return blocks;
}

async function start() {
  const db = getDb();

  console.log('🔍 Scanning repository for unprocessed prose chunks...');

  // Find chunks that haven't been pattern matched. We process in larger batches now.
  const chunks = db
    .prepare(
      `SELECT id, source_url, source_hash, content FROM immutable_chunks WHERE chunk_type = 'prose' LIMIT 100`,
    )
    .all() as any[];

  let blocksExtracted = 0;

  for (const chunk of chunks) {
    // Embed the main prose chunk if it hasn't been embedded yet!
    const existingProseEmbed = db
      .prepare(`SELECT count(*) as c FROM embeddings WHERE chunk_id = ?`)
      .get(chunk.id) as any;
    if (existingProseEmbed.c === 0 && chunk.content.length > 0) {
      console.log(`Embedding prose for ${chunk.source_url}...`);
      const proseVector = await embedText(chunk.content.substring(0, 9000)); // Safely chunk to text-embedding-004 context limits
      db.prepare(
        `
                INSERT INTO embeddings (id, chunk_id, embedding, vectorize_metadata, embedding_model, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `,
      ).run(
        crypto.randomUUID(),
        chunk.id,
        new Uint8Array(proseVector.buffer),
        JSON.stringify({ source_url: chunk.source_url, chunk_type: 'prose' }),
        'gemini-embedding-001',
        Date.now(),
      );
      blocksExtracted++;
    }

    const existingCodes = db
      .prepare(
        `SELECT count(*) as c FROM immutable_chunks WHERE source_url = ? AND chunk_type = 'code' AND source_hash = ?`,
      )
      .get(chunk.source_url, chunk.source_hash) as any;
    if (existingCodes.c > 0) {
      console.log(`Skipping ${chunk.source_url} - code already extracted.`);
      continue;
    }

    const codeBlocks = extractCodeBlocks(chunk.content);
    if (codeBlocks.length === 0) {
      console.log(`No code blocks found in ${chunk.source_url}.`);
      continue;
    }

    console.log(
      `Discovered ${codeBlocks.length} code patterns in ${chunk.source_url}. Embedding...`,
    );
    let sequence = 100; // Offset sequence for code blocks

    for (const block of codeBlocks) {
      const codeChunkId = crypto.randomUUID();
      sequence++;

      // 1. Insert into immutable_chunks as 'code'
      db.prepare(
        `
                INSERT INTO immutable_chunks (id, source_url, source_hash, ingestion_timestamp, chunk_sequence, header_hierarchy, chunk_type, content, language, concept_tags)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
      ).run(
        codeChunkId,
        chunk.source_url,
        chunk.source_hash,
        Date.now(),
        sequence,
        JSON.stringify(['Extracted Code Block']),
        'code',
        block.code,
        block.language,
        JSON.stringify([]),
      );

      // 2. Generate Embedding
      const embeddingVector = await embedText(block.code);

      // 3. Store in sqlite-vec table
      const embeddingId = crypto.randomUUID();
      db.prepare(
        `
                INSERT INTO embeddings (id, chunk_id, embedding, vectorize_metadata, embedding_model, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `,
      ).run(
        embeddingId,
        codeChunkId,
        new Uint8Array(embeddingVector.buffer), // Store as BLOB
        JSON.stringify({
          source_url: chunk.source_url,
          chunk_type: 'code',
          language: block.language,
        }),
        'gemini-embedding-001',
        Date.now(),
      );
      blocksExtracted++;
    }
  }

  // Attempt a Vector Search just to prove the DB works
  if (blocksExtracted > 0) {
    console.log('✅ Testing sqlite-vec search with random query "How to configure domains"...');
    try {
      const queryVector = await embedText('How to configure domains');
      const results = db
        .prepare(
          `
                 SELECT chunk_id, vec_distance_cosine(embedding, ?) as distance
                 FROM embeddings
                 WHERE embedding_model = 'gemini-embedding-001'
                 ORDER BY distance ASC
                 LIMIT 3
             `,
        )
        .all(new Uint8Array(queryVector.buffer)) as any[];
      console.log('🔍 Top matches from local vector database:', results);
    } catch (e: any) {
      console.error('Vector search test failed:', e.message);
    }
  }

  console.log(`Extracted and embedded ${blocksExtracted} pure code patterns.`);
  db.close();
}

start().catch(console.error);
