import { execSync } from 'child_process';
import path from 'path';

// ZER0 LOCAL SECRETS: Secure Deployment Script
// Usage: npx tsx scripts/infra/secure-connect.ts scripts/infra/deploy-swarm.ts

const WORKER_DIR = path.resolve(__dirname, '../../workers/worker-bees');
const APP_NAME = 'sluagh-swarm';

function step(msg: string) {
  console.log(`\n🔹 \x1b[36m${msg}\x1b[0m`);
}

function main() {
  console.log('🚀 \x1b[33mInitialize Secure Deployment: Sluagh Swarm\x1b[0m');

  // 1. Validate Secret Availability (Injected by secure-connect)
  const linearKey = process.env.LINEAR_API_KEY;
  if (!linearKey) {
    console.error('❌ FATAL: LINEAR_API_KEY not found in secure context.');
    console.error(
      '   Please run this script via: npx tsx scripts/infra/secure-connect.ts scripts/infra/deploy-swarm.ts',
    );
    process.exit(1);
  }

  // 2. Inject Secrets directly to Fly.io
  step('Injecting Ephemeral Secrets to Fly.io...');
  try {
    // We use piping to avoid the secret appearing in process list
    // Note: 'fly secrets set' accepts KEY=VALUE args. We need to be careful with shell escaping.
    // Safer approach: use stdin if possible, but fly secrets set expects args.
    // Valid approach: execSync with env vars passed to it? No, command line logging is the risk.
    // Construct command with values? DANGEROUS.

    // BETTER APPROACH: Use 'fly secrets import' which reads from stdin
    // Format: KEY=VALUE per line
    const secretPayload = `LINEAR_API_KEY=${linearKey}`;
    execSync(`fly secrets import -a ${APP_NAME}`, {
      input: secretPayload,
      stdio: ['pipe', 'inherit', 'inherit'], // Pipe stdin, inherit stdout/err
      cwd: WORKER_DIR,
    });
    console.log('✅ Secrets injected successfully.');
  } catch (e) {
    console.error('❌ Failed to set secrets:', e);
    process.exit(1);
  }

  // 3. Deploy
  step('Deploying to Fly.io...');
  try {
    execSync('fly deploy', {
      cwd: WORKER_DIR,
      stdio: 'inherit',
    });
    console.log('✅ Deployment Complete!');
  } catch (e) {
    console.error('❌ Deployment Failed:', e);
    process.exit(1);
  }
}

main();
