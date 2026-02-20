import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'events.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Simple migration runner
/**
 *
 */
export function initDB() {
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const localSchema = path.join(process.cwd(), 'schema.sql');
  const finalSchemaPath = fs.existsSync(schemaPath)
    ? schemaPath
    : fs.existsSync(localSchema)
      ? localSchema
      : null;

  if (finalSchemaPath) {
    const schema = fs.readFileSync(finalSchemaPath, 'utf8');
    db.exec(schema);
    console.log('Database initialized with schema from', finalSchemaPath);

    // Explicit Migrations for Phase 4
    try {
      const columns = db.prepare('PRAGMA table_info(events)').all() as any[];
      const hasTopic = columns.some((c) => c.name === 'topic');
      const hasCorrelationId = columns.some((c) => c.name === 'correlation_id');

      if (!hasTopic) {
        db.exec('ALTER TABLE events ADD COLUMN topic TEXT');
        db.exec('CREATE INDEX IF NOT EXISTS idx_events_topic ON events(topic)');
        console.log("Migration: Added 'topic' column to events table.");
      }
      if (!hasCorrelationId) {
        db.exec('ALTER TABLE events ADD COLUMN correlation_id TEXT');
        db.exec('CREATE INDEX IF NOT EXISTS idx_events_correlation_id ON events(correlation_id)');
        console.log("Migration: Added 'correlation_id' column to events table.");
      }
    } catch (e: any) {
      console.error('Migration Error:', e.message);
    }
  } else {
    console.warn('Schema file not found, skipping migration');
  }
}
