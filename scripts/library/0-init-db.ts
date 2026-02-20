import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import path from 'path';

const dbPath = path.resolve(__dirname, '../../.data/library.sqlite');
const db = new Database(dbPath);

console.log('Loading sqlite-vec extension...');
sqliteVec.load(db);

console.log('Configuring high-performance PRAGMAs...');
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

console.log('Initializing schema...');
db.exec(`
  CREATE TABLE IF NOT EXISTS scraped_urls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT UNIQUE,
    status TEXT DEFAULT 'pending',
    last_crawled DATETIME
  );
  
  CREATE TABLE IF NOT EXISTS raw_markdown (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url_id INTEGER,
    content TEXT,
    FOREIGN KEY(url_id) REFERENCES scraped_urls(id)
  );
  
  -- Create virtual table for embeddings (768 dimensions for standard models)
  CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
    embedding float[768]
  );
  
  CREATE TABLE IF NOT EXISTS code_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    markdown_id INTEGER,
    pattern_type TEXT,
    code_snippet TEXT,
    embedding_rowid INTEGER,
    FOREIGN KEY(markdown_id) REFERENCES raw_markdown(id)
  );
`);

console.log('✅ SQLite DB successfully initialized at', dbPath);
