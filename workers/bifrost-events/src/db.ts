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
export function initDB() {
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schema);
    console.log('Database initialized with schema from', schemaPath);
  } else {
    // If running from src (dev), schema is one level up. If from dist (prod), it might be different.
    // Let's try explicit path relative to CWD if __dirname fails
    const localSchema = path.join(process.cwd(), 'schema.sql');
    if (fs.existsSync(localSchema)) {
      const schema = fs.readFileSync(localSchema, 'utf8');
      db.exec(schema);
      console.log('Database initialized with schema from', localSchema);
    } else {
      console.warn('Schema file not found, skipping migration');
    }
  }
}
