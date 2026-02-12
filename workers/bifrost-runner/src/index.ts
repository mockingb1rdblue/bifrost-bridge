import Fastify from 'fastify';
import dotenv from 'dotenv';
import { exec } from 'child_process';
import util from 'util';

dotenv.config();

const fastify = Fastify({ logger: true });
const execAsync = util.promisify(exec);

// Auto-Shutdown Config
const IDLE_TIMEOUT_MS = parseInt(process.env.IDLE_TIMEOUT_MINS || '5') * 60 * 1000;
let shutdownTimer: NodeJS.Timeout;

function resetShutdownTimer() {
  if (shutdownTimer) clearTimeout(shutdownTimer);
  console.log(`Resetting shutdown timer. Will exit in ${IDLE_TIMEOUT_MS / 1000}s if idle.`);
  shutdownTimer = setTimeout(() => {
    console.log('Idle timeout reached. Shutting down...');
    process.exit(0); // Exit successfully, allows Fly to restart on next request if configured, or just stop.
  }, IDLE_TIMEOUT_MS);
}

// Middleware: Reset timer on request
fastify.addHook('onRequest', async (request, reply) => {
  resetShutdownTimer();
});

// Middleware: Auth (Simple Secret)
fastify.addHook('onRequest', async (request, reply) => {
  const authHeader = request.headers.authorization;
  const secret = process.env.RUNNER_SECRET;

  if (!secret) return; // Open if no secret (Dev)

  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

interface ExecuteBody {
  command: string;
  cwd?: string;
}

// Execute Arbitrary Command (Risk: High - Internal Use Only)
fastify.post<{ Body: ExecuteBody }>('/execute', async (request, reply) => {
  const { command, cwd } = request.body;

  if (!command) {
    return reply.code(400).send({ error: 'Missing command' });
  }

  try {
    const { stdout, stderr } = await execAsync(command, { cwd: cwd || process.cwd() });
    return { status: 'success', stdout, stderr };
  } catch (error: any) {
    return reply
      .code(500)
      .send({ status: 'error', error: error.message, stdout: error.stdout, stderr: error.stderr });
  }
});

fastify.get('/health', async () => {
  return { status: 'ok', uptime: process.uptime() };
});

const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '8081');
    const host = '0.0.0.0';
    await fastify.listen({ port, host });
    console.log(`Runner listening on ${host}:${port}`);
    resetShutdownTimer(); // Start timer on launch
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
