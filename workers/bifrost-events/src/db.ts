import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

const DB_PATH = process.env.DB_PATH || './events.db';

// Ensure directory exists
try {
  mkdirSync(dirname(DB_PATH), { recursive: true });
} catch (e) {
  // Ignore error if directory exists
}

console.log(`Connecting to database at ${DB_PATH}`);
const db = new Database(DB_PATH);

// Enable WAL mode for concurrency
db.pragma('journal_mode = WAL');

// Initialize Schema
const initSchema = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      sprite_id TEXT,
      batch_id TEXT,
      agent_id TEXT,
      event_type TEXT NOT NULL,
      payload_json TEXT,
      parent_event_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_events_sprite ON events(sprite_id);
    CREATE INDEX IF NOT EXISTS idx_events_batch ON events(batch_id);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
  `);
  console.log('Database schema initialized');
};

export { db, initSchema };
