import { spawn } from 'child_process';
import { Job, JobResult, JobHandler } from '../agent';
import { config } from '../config';

interface RunCommandPayload {
  command: string;
  args: string[];
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

// Security Blocklist
const BLOCKED_COMMANDS = ['rm', 'mkfs', 'dd', '>']; // Basic sanity check, relied on args for more
const BLOCKED_ARGS = ['-rf', '/', '>', '>>', '|', '&'];

/**
 *
 */
export class RunCommandHandler implements JobHandler {
  type = 'run_command';

  /**
   *
   */
  async execute(job: Job): Promise<JobResult> {
    const payload = job.payload as RunCommandPayload;
    const { command, args, cwd, timeout = 30000, env } = payload;

    // 1. Sanity Check (Basic) - Firecracker is the real sandbox
    if (BLOCKED_COMMANDS.includes(command) && args.some((a) => BLOCKED_ARGS.includes(a))) {
      return {
        success: false,
        error: `Command blocked by safety policy: ${command} ${args.join(' ')}`,
      };
    }

    console.log(`[RunCommand] Executing: ${command} ${args.join(' ')}`);

    return new Promise((resolve) => {
      const child = spawn(command, args, {
        cwd: cwd || process.cwd(),
        env: { ...config.PROCESS_ENV, ...env }, // Inherit + Override
        timeout,
      });

      let stdout = '';
      let stderr = '';
      const start = Date.now();

      child.stdout.on('data', (data) => (stdout += data.toString()));
      child.stderr.on('data', (data) => (stderr += data.toString()));

      child.on('error', (err) => {
        resolve({
          success: false,
          error: `Spawn error: ${err.message}`,
          data: { stdout, stderr, duration: Date.now() - start },
        });
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          data: {
            stdout,
            stderr,
            exitCode: code,
            duration: Date.now() - start,
          },
          error: code !== 0 ? `Command failed with exit code ${code}` : undefined,
        });
      });
    });
  }
}
