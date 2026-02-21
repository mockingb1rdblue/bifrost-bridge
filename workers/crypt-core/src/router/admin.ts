import { Job } from '../types';
import { JobPayloadSchema, JobUpdateSchema } from '../schemas';
import { RouterConfig } from './config';
import { RouterDependencies } from './dependencies';
import { RouterStateManager } from './state';
import { RouterJobProcessor } from './processor';

/**
 * RouterAdminHandler: Manages administrative tasks, metrics, and project reporting.
 */
export class RouterAdminHandler {
  constructor(
    private config: RouterConfig,
    private deps: RouterDependencies,
    private stateManager: RouterStateManager,
    private processor: RouterJobProcessor
  ) {}

  /**
   * Triggers a manual batch process.
   */
  async handleBatchTrigger(request: Request): Promise<Response> {
    const body = (await request.json()) as any;
    const limit = body.batchSize || 10;
    const processed = await this.processor.processBatch(limit);
    return new Response(JSON.stringify({ processedCount: processed.length, jobs: processed }));
  }

  /**
   * Seeds test issues in Linear for validation.
   */
  async seedTestIssues(): Promise<Response> {
    const linear = this.deps.linear;
    const labelId = await linear.getLabelIdByName(this.config.linear.teamId, 'swarm:ready');
    if (!labelId) return new Response('Label missing', { status: 503 });

    const issue = await linear.createIssue({
      title: 'Manual Test Scan',
      description: 'Test issue for swarm verification.',
      teamId: this.config.linear.teamId
    });
    await linear.updateIssue(issue.id, { labelIds: [labelId] });
    return new Response(JSON.stringify({ success: true, identifier: issue.identifier }));
  }

  /**
   * Reports success metrics to Linear project updates.
   */
  async postProjectHealth(): Promise<Response> {
    const m = this.stateManager.metrics;
    const rate = m.totalTasks > 0 ? Math.round((m.successCount / m.totalTasks) * 100) : 100;
    const health = rate > 90 ? 'onTrack' : 'atRisk';
    
    await this.deps.linear.postProjectUpdate(this.config.linear.projectId, {
      health,
      body: `Swarm Health: ${rate}% success over ${m.totalTasks} tasks.`
    });
    return new Response(JSON.stringify({ health, rate }));
  }

  /**
   * Manages job updates and state transitions.
   */
  async handleJobUpdate(jobId: string, request: Request): Promise<Response> {
    const job = this.stateManager.jobs[jobId];
    if (!job) return new Response('Not Found', { status: 404 });

    if (request.method === 'GET') return new Response(JSON.stringify(job));
    if (request.method === 'PATCH') {
      const body = await request.json();
      const result = JobUpdateSchema.safeParse(body);
      if (!result.success) return new Response('Invalid', { status: 400 });
      const updated = { ...job, ...result.data, updatedAt: Date.now() };
      await this.stateManager.saveJob(updated);
      return new Response(JSON.stringify(updated));
    }
    return new Response('Method Not Allowed', { status: 405 });
  }

  /**
   * Creates a manual job via API.
   */
  async createJob(request: Request): Promise<Response> {
    const body = await request.json();
    const result = JobPayloadSchema.safeParse(body);
    if (!result.success) return new Response('Invalid', { status: 400 });
    
    const jobId = crypto.randomUUID();
    const job: Job = {
      id: jobId,
      ...result.data,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now()
    } as any;

    await this.stateManager.saveJob(job);
    return new Response(JSON.stringify(job), { status: 201 });
  }

  /**
   * Approves a job and resets its status to pending.
   */
  async approveJob(jobId: string): Promise<Response> {
    const job = this.stateManager.jobs[jobId];
    if (!job) return new Response('Not Found', { status: 404 });
    await this.stateManager.saveJob({ ...job, status: 'pending', updatedAt: Date.now() });
    return new Response(JSON.stringify({ message: 'Approved' }));
  }
}
