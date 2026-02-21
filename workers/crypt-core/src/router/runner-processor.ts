import { RouterConfig } from './config';
import { RouterDependencies } from './dependencies';
import { RouterStateManager } from './state';
import { Job } from '../types';

/**
 * RunnerProcessor: Coordinates execution of tasks on external runners (e.g. Fly.io).
 */
export class RunnerProcessor {
  constructor(
    private config: RouterConfig,
    private deps: RouterDependencies,
    private stateManager: RouterStateManager
  ) {}

  async executeRunnerTask(job: Job) {
    try {
      await this.checkGovernance('runner');
      await this.deps.fly.startRunner();
      const runnerUrl = 'http://bifrost-runner.flycast:8080/execute';
      const command = job.payload?.command;
      const cwd = job.payload?.cwd;

      if (!command) throw new Error('Missing command in runner task payload');

      const response = await fetch(runnerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.runnerSecret || ''}`,
        },
        body: JSON.stringify({ command, cwd }),
      });

      if (!response.ok) {
        throw new Error(`Runner returned ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      job.status = 'completed';
      job.result = result;

      await this.deps.events.append({
        type: 'JOB_COMPLETED',
        source: 'custom-router',
        payload: { jobId: job.id, result },
      });
    } catch (e: any) {
      console.error(`[RunnerProcessor] Runner failure for job ${job.id}:`, e.message);
      await this.stateManager.logError({
        message: e.message,
        context: `RUNNER_FAILURE: ${job.id}`,
        timestamp: Date.now(),
        stack: e.stack
      });
      job.status = 'failed';
      job.error = e.message;
      await this.deps.events.append({
        type: 'JOB_FAILED',
        source: 'custom-router',
        payload: { jobId: job.id, error: e.message },
      });
    }
  }

  private async checkGovernance(agentId: string = 'global') {
    if (this.config.GOVERNANCE_DO) {
      const id = this.config.GOVERNANCE_DO.idFromName('guard-dog');
      const stub = this.config.GOVERNANCE_DO.get(id);
      const govRes = await stub.fetch(`http://governance/check?agent=${agentId}`);

      if (govRes.status === 429) {
        const body = (await govRes.json()) as any;
        throw new Error(`Governance Blocked: ${body.reason}`);
      }
    }
  }
}
