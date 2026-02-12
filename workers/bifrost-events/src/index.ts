import { initSchema } from './db';
import Fastify from 'fastify';

const server = Fastify({ logger: true });

// Initialize DB
initSchema();

server.get('/health', async () => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '8080');
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Bifrost Events running on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
