import { Job, RouterState, SluaghSwarmTask, ErrorLog, RouterMetrics, CircuitBreakerState } from '../types';
import { StateUtils } from './state-utils';

export class RouterStateManager {
  private state: any;
  private storage: RouterState = {
    jobs: {}, swarmTasks: {}, rateLimits: {}, ingestedIssueIds: [], lastMaintenance: Date.now(), circuitBreakers: {}, recentErrors: [],
    metrics: { totalRequests: 0, totalTasks: 0, tokensConsumed: 0, errorCount: 0, successCount: 0, startTime: Date.now(), providerStats: {} },
  };

  constructor(state: any) { this.state = state; }

  async initialize() {
    await this.state.blockConcurrencyWhile(async () => {
      await (this.state.storage as any).delete('router_state').catch(() => {});
      const meta = (await (this.state.storage as any).get('router_meta')) || {};
      const jobsMap = await (this.state.storage as any).list({ prefix: 'job_' });
      const tasksMap = await (this.state.storage as any).list({ prefix: 'task_' });
      
      const jobs: Record<string, Job> = {};
      for (const [_, job] of jobsMap) jobs[job.id] = job as Job;
      const swarmTasks: Record<string, SluaghSwarmTask> = {};
      for (const [_, task] of tasksMap) swarmTasks[task.id] = task as SluaghSwarmTask;

      this.storage = {
        jobs, swarmTasks,
        rateLimits: meta.rateLimits || {},
        metrics: { ...this.storage.metrics, ...(meta.metrics || {}) },
        recentErrors: meta.recentErrors || [],
        lastMaintenance: meta.lastMaintenance || Date.now(),
        circuitBreakers: meta.circuitBreakers || {},
        ingestedIssueIds: meta.ingestedIssueIds || [],
      };
    });
  }

  // Getters
  get jobs(): Record<string, Job> { return this.storage.jobs; }
  get swarmTasks(): Record<string, SluaghSwarmTask> { return this.storage.swarmTasks; }
  get metrics(): RouterMetrics { return this.storage.metrics; }
  get recentErrors(): ErrorLog[] { return this.storage.recentErrors; }
  get ingestedIssueIds(): string[] { return this.storage.ingestedIssueIds; }
  get circuitBreakers(): Record<string, CircuitBreakerState> { return this.storage.circuitBreakers; }

  private async saveMeta() {
    await (this.state.storage as any).put('router_meta', {
      metrics: this.storage.metrics, rateLimits: this.storage.rateLimits, recentErrors: this.storage.recentErrors,
      lastMaintenance: this.storage.lastMaintenance, circuitBreakers: this.storage.circuitBreakers, ingestedIssueIds: this.storage.ingestedIssueIds,
    });
  }

  async saveJob(job: Job) {
    this.storage.jobs[job.id] = job;
    await (this.state.storage as any).put(`job_${job.id}`, job);
  }

  async deleteJob(id: string) {
    delete this.storage.jobs[id];
    await (this.state.storage as any).delete(`job_${id}`);
  }

  async saveTask(task: SluaghSwarmTask) {
    this.storage.swarmTasks[task.id] = task;
    await (this.state.storage as any).put(`task_${task.id}`, task);
  }

  async logError(errorLog: ErrorLog) {
    this.storage.metrics.errorCount++;
    this.storage.recentErrors.unshift(errorLog);
    if (this.storage.recentErrors.length > 50) this.storage.recentErrors.pop();
    await this.saveMeta();
  }

  async recordProviderMetric(provider: string, type: 'success' | 'failure', tokens: number = 0) {
    StateUtils.recordProviderMetric(this.storage.metrics, provider, type, tokens);
    await this.saveMeta();
  }

  async addIngestedIssueId(id: string) {
    if (!this.storage.ingestedIssueIds.includes(id)) {
      this.storage.ingestedIssueIds.push(id);
      await this.saveMeta();
    }
  }

  checkRateLimit(key: string, maxTokens: number, refillRate: number): boolean {
    return StateUtils.checkRateLimit(this.storage.rateLimits, this.storage.metrics, key, maxTokens, refillRate);
  }

  isCircuitOpen(service: string): boolean {
    return StateUtils.isCircuitOpen(this.storage.circuitBreakers, service);
  }

  async recordCircuitFailure(service: string, threshold: number, reason?: string) {
    StateUtils.recordCircuitFailure(this.storage.circuitBreakers, service, threshold, reason);
    await this.saveMeta();
  }

  async recordCircuitSuccess(service: string) {
    if (this.storage.circuitBreakers[service]) {
      this.storage.circuitBreakers[service] = { state: 'closed', failureCount: 0 };
      await this.saveMeta();
    }
  }

  async attemptCircuitRecovery(service: string) {
    StateUtils.attemptCircuitRecovery(this.storage.circuitBreakers, service);
    await this.saveMeta();
  }

  async recordRequest() {
    this.storage.metrics.totalRequests++;
    await this.saveMeta();
  }

  async wipe() {
    await (this.state.storage as any).deleteAll();
    this.storage = {
      jobs: {}, swarmTasks: {}, rateLimits: {}, ingestedIssueIds: [], lastMaintenance: Date.now(), circuitBreakers: {}, recentErrors: [],
      metrics: { totalRequests: 0, totalTasks: 0, tokensConsumed: 0, errorCount: 0, successCount: 0, startTime: Date.now(), providerStats: {} },
    };
  }

  async cleanupOldRecords(maxCompleted: number = 10) {
    const completedJobs = Object.values(this.storage.jobs)
      .filter((j) => j.status === 'completed' || j.status === 'failed')
      .sort((a, b) => b.updatedAt - a.updatedAt);
    
    if (completedJobs.length > maxCompleted) {
      for (const j of completedJobs.slice(maxCompleted)) await this.deleteJob(j.id);
    }

    const completedSwarm = Object.values(this.storage.swarmTasks)
      .filter((t) => t.status === 'completed' || t.status === 'failed')
      .sort((a, b) => (b.updatedAt || Date.now()) - (a.updatedAt || Date.now()));

    if (completedSwarm.length > maxCompleted) {
      for (const t of completedSwarm.slice(maxCompleted)) {
        delete this.storage.swarmTasks[t.id];
        await (this.state.storage as any).delete(`task_${t.id}`);
      }
    }
    await this.saveMeta();
  }

  async saveLastMaintenance(time: number = Date.now()) {
    this.storage.lastMaintenance = time;
    await this.saveMeta();
  }
}
