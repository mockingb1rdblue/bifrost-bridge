console.log('🚀 BOOTSTRAP: Annals of Ankou starting up...');
console.log('Environment PORT:', process.env.PORT);
console.log('Environment DB_PATH:', process.env.DB_PATH);

import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import { db, initDB } from './db';

const fastify = Fastify({
  logger: true,
});

// Middleware for Auth
fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
  const authHeader = request.headers.authorization;
  const secret = process.env.EVENTS_SECRET;

  if (!secret) return; // Open if no secret configured (Development)

  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

// Init DB
initDB();

// Schema for Event
interface EventBody {
  type: string;
  source: string;
  topic?: string;
  correlation_id?: string;
  payload: Record<string, unknown>; // Safer than any
  meta?: Record<string, unknown>;
}

// Routes
fastify.post<{ Body: EventBody }>('/events', async (request, reply) => {
  const { type, source, topic, correlation_id, payload, meta } = request.body;

  if (!type || !source || !payload) {
    return reply
      .code(400)
      .send({ error: 'Missing required fields: type, source, and payload are required' });
  }

  // BIF-165: Correlation ID Validation
  if (
    correlation_id &&
    (typeof correlation_id !== 'string' || correlation_id.trim().length === 0)
  ) {
    return reply.code(400).send({ error: 'correlation_id must be a non-empty string' });
  }

  const stmt = db.prepare(
    'INSERT INTO events (type, source, topic, correlation_id, payload, meta) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const info = stmt.run(
    type,
    source,
    topic || null,
    correlation_id || null,
    JSON.stringify(payload),
    meta ? JSON.stringify(meta) : null,
  );

  return { id: info.lastInsertRowid, status: 'ok' };
});

// Replay state for a topic
fastify.get<{ Params: { topic: string } }>('/state/:topic', async (request, reply) => {
  const { topic } = request.params;

  const stmt = db.prepare('SELECT * FROM events WHERE topic = ? ORDER BY id ASC');
  const events = stmt.all(topic) as { payload: string }[];

  // Naive state reconstruction: merge payloads
  const state = events.reduce((acc: Record<string, unknown>, e) => {
    const payload = JSON.parse(e.payload);
    return { ...acc, ...payload };
  }, {});

  return { topic, state, eventCount: events.length };
});

// BIF-164/167: Advanced Filtering for History
interface EventsQuery {
  limit?: number;
  type?: string | string[];
  topic?: string;
  startDate?: string;
  endDate?: string;
}

fastify.get<{ Querystring: EventsQuery }>('/events', async (request, reply) => {
  const { limit = 100, type, topic, startDate, endDate } = request.query;

  let query = 'SELECT * FROM events WHERE 1=1';
  const params: (string | number)[] = [];

  if (type) {
    if (Array.isArray(type)) {
      query += ` AND type IN (${type.map(() => '?').join(',')})`;
      params.push(...type);
    } else {
      query += ' AND type = ?';
      params.push(type);
    }
  }

  if (topic) {
    query += ' AND topic = ?';
    params.push(topic);
  }

  if (startDate) {
    query += ' AND timestamp >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND timestamp <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY id DESC LIMIT ?';
  params.push(Number(limit));

  const stmt = db.prepare(query);
  const events = stmt.all(...params) as any[]; // DB returns untyped rows, checking specific fields below

  return events.map((e) => ({
    ...e,
    payload: JSON.parse(e.payload),
    meta: e.meta ? JSON.parse(e.meta) : null,
  }));
});

// BIF-166: List Unique Topics
fastify.get('/events/topics', async () => {
  const stmt = db.prepare('SELECT DISTINCT topic FROM events WHERE topic IS NOT NULL');
  const result = stmt.all() as { topic: string }[];
  return { topics: result.map((r) => r.topic) };
});

// Count total events
fastify.get('/events/count', async () => {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM events');
  const result = stmt.get() as { count: number };
  return { count: result.count };
});

// Health Check
fastify.get('/health', async () => {
  return { status: 'ok' };
});

export const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '8080');
    const host = '0.0.0.0'; // Listen on all interfaces (for Fly)
    await fastify.listen({ port, host });
    console.log(`Server listening on ${host}:${port}`);
    console.log(`DB Path: ${process.env.DB_PATH || 'default'}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

export const app = fastify;

// Auto-start for Fly.io/Production
start().catch((err) => {
  console.error('🔥 FATAL STARTUP ERROR:', err);
  process.exit(1);
});
