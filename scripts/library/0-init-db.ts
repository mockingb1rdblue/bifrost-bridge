import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const DB_PATH = join(process.cwd(), '.data', 'library.sqlite');

function initDb() {
  const dataDir = join(process.cwd(), '.data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  const db = new Database(DB_PATH);

  // Load sqlite-vec extension
  sqliteVec.load(db);

  // Performance Pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    -- Table 1: Core documentation chunks (syncs to D1)
    CREATE TABLE IF NOT EXISTS immutable_chunks (
      id TEXT PRIMARY KEY,
      source_url TEXT NOT NULL,
      source_hash TEXT NOT NULL,  -- Hash of original HTML; detect doc changes
      ingestion_timestamp INTEGER NOT NULL,  -- Unix timestamp
      chunk_sequence INTEGER NOT NULL,  -- Order within the document
      
      -- Content
      header_hierarchy TEXT NOT NULL,  -- JSON array of headers for breadcrumb
      chunk_type TEXT NOT NULL CHECK(chunk_type IN ('prose', 'code', 'table', 'list')),
      content TEXT NOT NULL,
      
      -- Metadata for Vectorize filtering
      language TEXT,  -- 'javascript', 'python', etc. for code blocks
      api_entity TEXT,  -- 'Cloudflare.Vectorize.upsert' -> filterable in Vectorize
      concept_tags TEXT,  -- JSON array for semantic filtering
      
      UNIQUE(source_url, source_hash, chunk_sequence)
    );

    -- Table 2: Embeddings (maps to Vectorize, stores embedding metadata)
    CREATE TABLE IF NOT EXISTS embeddings (
      id TEXT PRIMARY KEY,  -- This becomes the Vector ID in Vectorize
      chunk_id TEXT NOT NULL REFERENCES immutable_chunks(id),
      
      -- The actual embedding (store as BLOB for sqlite-vec)
      embedding BLOB NOT NULL,
      
      -- Vectorize metadata (stored as JSON, sent with upsert)
      vectorize_metadata TEXT NOT NULL,  -- {"source_url": "...", "chunk_type": "..."}
      
      embedding_model TEXT NOT NULL,  -- 'openai-3-small' | 'workers-ai-bge'
      created_at INTEGER NOT NULL,
      
      -- Migration tracking
      vectorize_mutation_id TEXT,  -- Set after successful Vectorize upsert
      vectorize_synced_at INTEGER,  -- Timestamp of last sync to Vectorize
      
      UNIQUE(chunk_id, embedding_model)
    );

    -- Table 3: Ingestion mutations (audit trail + recovery)
    CREATE TABLE IF NOT EXISTS mutations (
      mutation_id TEXT PRIMARY KEY,
      batch_size INTEGER NOT NULL,
      inserted_chunk_ids TEXT NOT NULL,  -- JSON array
      vectorize_response TEXT,  -- Full response from Vectorize upsert
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'committed', 'failed'))
    );

    -- Indexes for fast local queries
    CREATE INDEX IF NOT EXISTS idx_immutable_chunks_source_url ON immutable_chunks(source_url);
    CREATE INDEX IF NOT EXISTS idx_immutable_chunks_ingestion ON immutable_chunks(ingestion_timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_embeddings_chunk_id ON embeddings(chunk_id);
    CREATE INDEX IF NOT EXISTS idx_embeddings_vectorize_synced ON embeddings(vectorize_synced_at);
  `);

  console.log(
    '✅ SQLite database initialized successfully at .data/library.sqlite with sqlite-vec extension.',
  );
  db.close();
}

initDb();
