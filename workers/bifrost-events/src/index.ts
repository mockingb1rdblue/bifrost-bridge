import Fastify from 'fastify';
import { db, initDB } from './db';

const fastify = Fastify({
  logger: true,
});

// Middleware for Auth
fastify.addHook('onRequest', async (request, reply) => {
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
  payload: any;
  meta?: any;
}

// Routes
fastify.post<{ Body: EventBody }>('/events', async (request, reply) => {
  const { type, source, topic, correlation_id, payload, meta } = request.body;

  if (!type || !source || !payload) {
    return reply.code(400).send({ error: 'Missing required fields' });
  }

  const stmt = db.prepare('INSERT INTO events (type, source, topic, correlation_id, payload, meta) VALUES (?, ?, ?, ?, ?, ?)');
  const info = stmt.run(
    type, 
    source, 
    topic || null, 
    correlation_id || null, 
    JSON.stringify(payload), 
    meta ? JSON.stringify(meta) : null
  );

  return { id: info.lastInsertRowid, status: 'ok' };
});

// Replay state for a topic
fastify.get<{ Params: { topic: string } }>('/state/:topic', async (request, reply) => {
  const { topic } = request.params;
  
  const stmt = db.prepare('SELECT * FROM events WHERE topic = ? ORDER BY id ASC');
  const events = stmt.all(topic);

  // Naive state reconstruction: merge payloads
  const state = events.reduce((acc: any, e: any) => {
    const payload = JSON.parse(e.payload);
    return { ...acc, ...payload };
  }, {});

  return { topic, state, eventCount: events.length };
});

fastify.get<{ Querystring: { limit?: number; type?: string } }>(
  '/events',
  async (request, reply) => {
    const { limit = 100, type } = request.query;

    let query = 'SELECT * FROM events';
    const params: any[] = [];

    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }

    query += ' ORDER BY id DESC LIMIT ?';
    params.push(limit);

    const stmt = db.prepare(query);
    const events = stmt.all(...params);

    return events.map((e: any) => ({
      ...e,
      payload: JSON.parse(e.payload),
      meta: e.meta ? JSON.parse(e.meta) : null,
    }));
  },
);

// Health Check
fastify.get('/health', async () => {
  return { status: 'ok' };
});

const start = async () => {
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

start();
