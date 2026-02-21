import { SluaghSwarmTask, EngineeringLog } from '../types';
import { SluaghSwarmTaskCreateSchema, SluaghSwarmTaskUpdateSchema } from '../schemas';
import { RouterConfig } from './config';
import { RouterDependencies } from './dependencies';
import { RouterStateManager } from './state';
import { RouterJobProcessor } from './processor';

/**
 * RouterSwarmManager: Orchestrates sluagh swarm task lifecycle and self-healing loops.
 */
export class RouterSwarmManager {
  constructor(
    private config: RouterConfig,
    private deps: RouterDependencies,
    private stateManager: RouterStateManager,
    private processor: RouterJobProcessor
  ) {}

  /**
   * Formats execution logs for Linear comments.
   */
  private formatEngineeringLog(log: EngineeringLog): string {
    return `
### What Was Done
${log.whatWasDone}

### Diff
\`\`\`diff
${log.diff}
\`\`\`

### ✅ What Worked
${log.whatWorked.map((w) => `- ${w}`).join('\n')}

### ❌ What Didn't Work
${log.whatDidntWork.map((w) => `- ${w}`).join('\n')}

### 💡 Lessons Learned
${log.lessonsLearned.map((l) => `- ${l}`).join('\n')}
        `.trim();
  }

  /**
   * Dispatches a self-healing task when a circuit breaker trips.
   */
  async dispatchSelfHealingTask(service: string, reason: string): Promise<void> {
    const taskId = `task_heal_${service}_${Date.now()}`;
    const task: SluaghSwarmTask = {
      id: taskId,
      issueId: taskId,
      type: 'chore' as any,
      title: `[SELF-HEAL] Circuit breaker tripped: ${service}`,
      description: [
        `The circuit breaker for external service "${service}" has tripped.`,
        ``,
        `**Last failure reason:** ${reason}`,
        `**Tripped at:** ${new Date().toISOString()}`,
        ``,
        `## Your job`,
        `1. Run a **sandbox probe** to confirm recovery.`,
        `2. If fixed, call POST /admin/circuit-reset?service=${service}`,
      ].join('\n'),
      files: [],
      status: 'pending',
      priority: 100,
      isHighRisk: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await this.stateManager.saveTask(task);
  }

  /**
   * Handles task updates from worker bees, including chaining and self-healing loops.
   */
  async handleTaskUpdate(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const result = SluaghSwarmTaskUpdateSchema.safeParse(body);
      if (!result.success) {
        return new Response('Invalid payload: ' + result.error.message, { status: 400 });
      }

      const { taskId, status, engineeringLog } = result.data;
      const task = this.stateManager.swarmTasks[taskId];
      if (!task) return new Response('Task not found', { status: 404 });

      const updates: any = { status, updatedAt: Date.now() };
      if (engineeringLog) updates.engineeringLog = engineeringLog;
      if (result.data.reviewDecision) updates.reviewDecision = result.data.reviewDecision;
      if (result.data.prNumber) updates.prNumber = result.data.prNumber;
      if (result.data.prUrl) updates.prUrl = result.data.prUrl;

      await this.stateManager.saveTask({ ...task, ...updates });

      // Notify Linear
      if (status === 'completed' || status === 'failed') {
        const header = status === 'completed' ? `🤖 **Task Complete**` : `⚠️ **Task Failed**`;
        const log = engineeringLog ? this.formatEngineeringLog(engineeringLog) : '(No output)';
        await this.deps.linear.addComment(task.issueId, `${header}\n\n${log}`);
      }

      // Chain logic (Coding -> Verify -> Review)
      if (status === 'completed') {
        const now = Date.now();
        if (task.type === 'coding') {
          await this.stateManager.saveTask({
            ...task,
            id: `task_verify_${now}`,
            type: 'verify',
            title: `Verify: ${task.title}`,
            status: 'pending',
            createdAt: now,
            updatedAt: now,
          });
        }
        // ... more chaining if needed ...
      }

      if (task.type === 'review' && result.data.reviewDecision === 'APPROVE') {
        await this.processor.completeAndMergeTask(task);
      }

      await this.processor.processBatch();
      return new Response('OK');
    } catch (e: any) {
      return new Response('Error: ' + e.message, { status: 400 });
    }
  }

  /**
   * Checks out the next available task for a worker.
   */
  async checkoutNextTask(): Promise<Response> {
    const nextTask = Object.values(this.stateManager.swarmTasks)
      .filter((t) => t.status === 'pending')
      .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)[0];

    if (!nextTask) return new Response('No tasks', { status: 404 });

    const updatedTask = { ...nextTask, status: 'active', updatedAt: Date.now() };
    await this.stateManager.saveTask(updatedTask as SluaghSwarmTask);
    return new Response(JSON.stringify(updatedTask));
  }

  /**
   * Logic for manually creating tasks.
   */
  async createTask(request: Request): Promise<Response> {
    const body = await request.json();
    const result = SluaghSwarmTaskCreateSchema.safeParse(body);
    if (!result.success) return new Response('Invalid payload', { status: 400 });

    const newTask: SluaghSwarmTask = {
      ...result.data,
      id: (body as any).id || crypto.randomUUID(),
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    } as SluaghSwarmTask;

    await this.stateManager.saveTask(newTask);
    return new Response(JSON.stringify(newTask), { status: 201 });
  }

  /**
   * Worker polling for both jobs and swarm tasks.
   */
  async handleWorkerPoll(request: Request): Promise<Response> {
    const { workerId } = (await request.json()) as any;
    
    // Simplification: Try to find a swarm task first
    const swarmTask = Object.values(this.stateManager.swarmTasks)
      .find(t => t.status === 'pending');
      
    if (swarmTask) {
      swarmTask.status = 'in_progress' as any;
      swarmTask.assignedTo = workerId;
      swarmTask.startedAt = Date.now();
      await this.stateManager.saveTask(swarmTask);
      
      if (swarmTask.type === 'coding' && swarmTask.issueId) {
        await this.deps.linear.addLabel(swarmTask.issueId, 'swarm:active');
      }
    }

    return new Response(JSON.stringify({ swarmTask }));
  }
}
