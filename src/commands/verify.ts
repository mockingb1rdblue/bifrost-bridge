import chalk from 'chalk';
import ora from 'ora';
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const EVENTS_URL = process.env.EULOGY_URL || 'https://eulogy-engine.fly.dev';
const EVENTS_SECRET = process.env.EULOGY_SECRET;
const ROUTER_URL = process.env.REGISTRY_URL || 'https://crypt-core.mock1ng.workers.dev';
const PROXY_API_KEY = process.env.ABYSSAL_ARTIFACT;

/**
 *
 */
export function registerVerifyCommand(program: Command) {
  const verify = program.command('verify').description('Verify system health and configuration');

  verify
    .command('telemetry')
    .description('Verify Event Store and Telemetry pipeline')
    .action(async () => {
      console.log(chalk.blue('🔍 Starting Telemetry Verification...'));
      console.log(`📡 Event Store: ${chalk.bold(EVENTS_URL)}`);
      console.log(`🧠 Orchestrator: ${chalk.bold(ROUTER_URL)}`);

      // 1. Unauthenticated Health
      const spinner = ora('Testing Unauthenticated Health Check...').start();
      try {
        const healthRes = await fetch(`${EVENTS_URL}/health`);
        if (healthRes.status === 401) {
          spinner.succeed('Auth Check: OK (Correctly rejected without token)');
        } else {
          spinner.fail(`Auth Check: FAILED (Expected 401, got ${healthRes.status})`);
        }
      } catch (e) {
        spinner.fail(`Auth Check: ERROR (${(e as Error).message})`);
      }

      // 2. Authenticated Health
      spinner.start('Testing Authenticated Health Check...');
      try {
        const authHealthRes = await fetch(`${EVENTS_URL}/health`, {
          headers: { Authorization: `Bearer ${EVENTS_SECRET}` },
        });
        if (authHealthRes.ok) {
          spinner.succeed('Health Check: OK (200)');
        } else {
          spinner.fail(
            `Health Check: FAILED (${authHealthRes.status} ${await authHealthRes.text()})`,
          );
        }
      } catch (e) {
        spinner.fail(`Health Check: ERROR (${(e as Error).message})`);
      }

      // 3. Write Event
      spinner.start('Testing Event Write...');
      let eventId: string | undefined;
      try {
        const writeRes = await fetch(`${EVENTS_URL}/events`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${EVENTS_SECRET}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'HEARTBEAT',
            source: 'bifrost-cli-verify',
            topic: 'system-check',
            payload: { message: 'Telemetry is alive', timestamp: Date.now() },
          }),
        });

        if (writeRes.ok) {
          const data = (await writeRes.json()) as any;
          eventId = data.id;
          spinner.succeed(`Write Event: OK (ID: ${data.id})`);
        } else {
          spinner.fail(`Write Event: FAILED (${writeRes.status} ${await writeRes.text()})`);
        }
      } catch (e) {
        spinner.fail(`Write Event: ERROR (${(e as Error).message})`);
      }

      // 4. Read Event (if write succeeded)
      if (eventId) {
        spinner.start('Testing Event Read...');
        try {
          const readRes = await fetch(`${EVENTS_URL}/state/system-check`, {
            headers: { Authorization: `Bearer ${EVENTS_SECRET}` },
          });
          if (readRes.ok) {
            const state = (await readRes.json()) as any;
            if (state.state.message === 'Telemetry is alive') {
              spinner.succeed('Read Event: OK (Data match confirmed)');
            } else {
              spinner.warn('Read Event: FAILED (Data mismatch or old data)');
            }
          } else {
            spinner.fail(`Read Event: FAILED (${readRes.status})`);
          }
        } catch (e) {
          spinner.fail(`Read Event: ERROR (${(e as Error).message})`);
        }
      }

      // 5. Orchestrator Sync
      spinner.start('Triggering Orchestrator Sync...');
      try {
        const syncRes = await fetch(`${ROUTER_URL}/admin/sync-linear`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${PROXY_API_KEY}` },
        });
        if (syncRes.ok) {
          spinner.succeed('Orchestrator Sync: OK');
        } else {
          spinner.fail(`Orchestrator Sync: FAILED (${syncRes.status} ${await syncRes.text()})`);
        }
      } catch (e) {
        spinner.fail(`Orchestrator Sync: ERROR (${(e as Error).message})`);
      }

      console.log(chalk.green('\n🏁 Verification Complete.'));
      process.exit(0);
    });
}
