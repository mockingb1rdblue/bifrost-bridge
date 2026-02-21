import { RouterConfig } from './config';
import { RouterDependencies } from './dependencies';
import { RouterStateManager } from './state';
import { Job, SluaghSwarmTask } from '../types';
import { RoutingRequest } from '../llm/router';
import { LLMResponse } from '../llm/types';
import { SyncProcessor } from './sync-processor';
import { RunnerProcessor } from './runner-processor';
import { OrchestrationProcessor } from './orchestration-processor';
import { TaskCompletionProcessor } from './task-processor';

/**
 * RouterJobProcessor: Coordinates job execution by delegating to specialized processors.
 */
export class RouterJobProcessor {
  private sync: SyncProcessor;
  private runner: RunnerProcessor;
  private orchestration: OrchestrationProcessor;
  private tasks: TaskCompletionProcessor;

  constructor(
    private config: RouterConfig,
    private deps: RouterDependencies,
    private stateManager: RouterStateManager,
    private routeLLM: (params: RoutingRequest) => Promise<LLMResponse>
  ) {
    this.sync = new SyncProcessor(config, deps, stateManager);
    this.runner = new RunnerProcessor(config, deps, stateManager);
    this.orchestration = new OrchestrationProcessor(config, deps, stateManager, routeLLM);
    this.tasks = new TaskCompletionProcessor(deps);
  }

  /**
   * Processes a batch of pending jobs.
   */
  async processBatch(limit: number = 10): Promise<Job[]> {
    const pendingJobs = Object.values(this.stateManager.jobs)
      .filter((j) => j.status === 'pending')
      .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)
      .slice(0, limit);

    if (pendingJobs.length === 0) return [];

    for (const job of pendingJobs) {
      try {
        if (job.type === 'ingestion' && !job.linearIssueId) {
          await this.handleIngestionJob(job);
        } else if (job.type === 'orchestration') {
          await this.orchestration.processOrchestrationJob(job);
        } else if (job.type === 'runner_task') {
          await this.runner.executeRunnerTask(job);
        }

        job.updatedAt = Date.now();
        await this.stateManager.saveJob(job);
      } catch (e: any) {
        await this.stateManager.logError({
          message: e.message,
          context: `JOB_PROCESS_ERROR: ${job.id}`,
          timestamp: Date.now(),
          stack: e.stack
        });
      }
    }
    return pendingJobs;
  }

  private async handleIngestionJob(job: Job) {
    if (this.stateManager.isCircuitOpen('linear')) {
      job.status = 'failed';
      job.error = 'LINEAR_CIRCUIT_OPEN';
      return;
    }
    job.status = 'awaiting_hitl';
    try {
      const issue = await this.deps.linear.createIssue({
        title: `[HITL] Ingestion Approval Required: ${job.id}`,
        description: `Job ID: ${job.id}\nPayload: ${JSON.stringify(job.payload, null, 2)}`,
        teamId: this.config.linear.teamId || '',
        projectId: this.config.linear.projectId,
      });
      job.linearIssueId = issue.id;
      job.linearIdentifier = issue.identifier;
      await this.stateManager.recordCircuitSuccess('linear');
    } catch (e: any) {
      await this.stateManager.recordCircuitFailure('linear', 2, e.message);
      job.status = 'failed';
      job.error = e.message;
    }
  }

  // Delegated methods
  async syncLinearTasks() { return this.sync.syncLinearTasks(); }
  async completeAndMergeTask(task: SluaghSwarmTask) { return this.tasks.completeAndMergeTask(task); }
  async triggerMaintenance() {
    await this.stateManager.saveLastMaintenance(Date.now());
    await this.stateManager.cleanupOldRecords();
    await this.stateManager.attemptCircuitRecovery('linear');
    await this.stateManager.attemptCircuitRecovery('llm');
  }

  async maybeTriggerOptimization() {
    if (this.stateManager.metrics.successCount > 0 && this.stateManager.metrics.successCount % 50 === 0) {
      await this.stateManager.saveJob({
        id: `opt_${Date.now()}`,
        type: 'orchestration',
        status: 'pending',
        priority: 10,
        payload: {
          action: 'optimization_review',
          metrics: this.stateManager.metrics,
          recentErrors: this.stateManager.recentErrors,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }
}
