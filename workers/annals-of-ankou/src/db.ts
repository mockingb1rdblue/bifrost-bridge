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
  console.log('--- Database Initialization Starting ---');
  try {
    // 1. Ensure the events table exists (basic version)
    db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        source TEXT NOT NULL,
        payload TEXT NOT NULL,
        meta TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Base table verified.');

    // 2. Safely add columns if they are missing
    const columns = db.prepare('PRAGMA table_info(events)').all() as any[];
    const columnNames = columns.map((c) => c.name.toLowerCase());

    if (!columnNames.includes('topic')) {
      try {
        db.exec('ALTER TABLE events ADD COLUMN topic TEXT');
        console.log("Migration: Added 'topic' column.");
      } catch (e: any) {
        console.warn('Migration warning (topic):', e.message);
      }
    }

    if (!columnNames.includes('correlation_id')) {
      try {
        db.exec('ALTER TABLE events ADD COLUMN correlation_id TEXT');
        console.log("Migration: Added 'correlation_id' column.");
      } catch (e: any) {
        console.warn('Migration warning (correlation_id):', e.message);
      }
    }

    // 3. Apply schema.sql for any additional indices or tables, but wrap in try/catch
    // to prevent crashing on duplicate indices or missing columns in indices
    const schemaPath = path.join(__dirname, '..', 'schema.sql');
    const localSchema = path.join(process.cwd(), 'schema.sql');
    const finalSchemaPath = fs.existsSync(schemaPath)
      ? schemaPath
      : fs.existsSync(localSchema)
        ? localSchema
        : null;

    if (finalSchemaPath) {
      console.log('Reading full schema from:', finalSchemaPath);
      const schema = fs.readFileSync(finalSchemaPath, 'utf8');

      // Split schema into individual statements to handle errors gracefully
      const statements = schema
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        try {
          db.exec(statement);
        } catch (e: any) {
          if (e.message.includes('already exists') || e.message.includes('duplicate column')) {
            // Safe to ignore duplicate migrations
          } else {
            console.warn(`Migration statement failed: ${statement.substring(0, 50)}...`, e.message);
          }
        }
      }
      console.log('Schema processing complete.');
    } else {
      console.warn('⚠️  CRITICAL: Schema file not found. Database may be empty.');
    }
    console.log('--- Database Initialization Complete ---');
  } catch (e: any) {
    console.error('🛑 DATABASE INITIALIZATION FAILED:', e.message);
    if (e.stack) console.error(e.stack);
    throw e; // Bubble up to crash the process so Fly restarts
  }
}
