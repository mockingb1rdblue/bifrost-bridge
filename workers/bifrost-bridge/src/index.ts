import { Hono } from 'hono';

const app = new Hono();

app.get('/', (c) => c.text('Bifrost Bridge Control Plane'));

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

export default app;
