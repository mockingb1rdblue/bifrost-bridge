import { Hono, Context } from 'hono';

const app = new Hono();

app.get('/', (c: Context) => c.text('Bifrost Bridge Control Plane'));

app.get('/health', (c: Context) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

export default app;
