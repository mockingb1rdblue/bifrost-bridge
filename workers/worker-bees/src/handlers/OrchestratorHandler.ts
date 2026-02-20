import { Job, JobHandler, JobResult } from '../agent';

/**
 * @description Lightweight sequential process abstraction for Sluagh Swarm.
 */
class SequentialProcess {
  constructor(
    private handlers: Record<string, JobHandler>,
    private notify: (issueId: string, success: boolean, body: string) => Promise<void>,
  ) {}

  async kickoff(job: Job): Promise<JobResult> {
    const { steps, linearIssueId } = job.payload;
    const results = [];
    let globalContext = { ...job.payload.context };

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepNum = i + 1;
      const handler = this.handlers[step.type];

      if (!handler) {
        const error = `No handler for type ${step.type}`;
        if (linearIssueId)
          await this.notify(linearIssueId, false, `❌ Step ${stepNum} failed: ${error}`);
        return { success: false, error, data: { status: 'failed', stepNum, results } };
      }

      console.log(`[Crew][Step ${stepNum}/${steps.length}] Executing ${step.type}...`);

      // 🧠 Context Ingestion: Merge global context into step payload
      const stepPayload = { ...step.payload, context: { ...globalContext } };
      const stepJob: Job = {
        ...job,
        id: `${job.id}-step-${stepNum}`,
        type: step.type,
        payload: stepPayload,
      };

      try {
        const result = await handler.execute(stepJob);
        if (!result.success) {
          const error = result.error || 'Step failure';
          if (linearIssueId)
            await this.notify(linearIssueId, false, `❌ Step ${stepNum} failed:\n${error}`);
          return { success: false, error, data: { status: 'failed', stepNum, results } };
        }

        // 🧠 Context Accumulation: Merge result back into global context
        if (result.data) {
          globalContext = { ...globalContext, [`step_${stepNum}`]: result.data };
          if (result.data.engineeringLog) {
            globalContext = {
              ...globalContext,
              engineeringLog:
                (globalContext as any).engineeringLog + '\n' + result.data.engineeringLog,
            };
          }
        }

        results.push({
          task_id: stepJob.id,
          agent: step.type,
          output: JSON.stringify(result.data),
          execution_time: Date.now(), // Approximate
        });
      } catch (e: any) {
        if (linearIssueId)
          await this.notify(linearIssueId, false, `❌ Step ${stepNum} crash: ${e.message}`);
        return { success: false, error: e.message, data: { status: 'failed', stepNum, results } };
      }
    }

    if (linearIssueId) await this.notify(linearIssueId, true, `✅ Sequential Process Complete.`);

    return {
      success: true,
      data: {
        output: `Sequential process completed successfully with ${steps.length} steps.`,
        tasks: results,
        finalContext: globalContext,
      },
    };
  }
}

/**
 *
 */
export class OrchestratorHandler implements JobHandler {
  type = 'orchestration';
  private registry: Record<string, JobHandler>;

  /**
   *
   */
  constructor(registry: Record<string, JobHandler>) {
    this.registry = registry;
  }

  /**
   *
   */
  async execute(job: Job): Promise<JobResult> {
    const { title } = job.payload;
    console.log(`[Orchestrator] Kickoff: ${title || job.id}`);

    if (!Array.isArray(job.payload.steps) || job.payload.steps.length === 0) {
      return { success: false, error: 'Empty steps in orchestration' };
    }

    const process = new SequentialProcess(this.registry, (id, s, b) => this.notifyLinear(id, s, b));
    return process.kickoff(job);
  }

  private async notifyLinear(issueId: string, success: boolean, body: string) {
    const linearHandler = this.registry['linear'];
    if (linearHandler) {
      try {
        await linearHandler.execute({
          id: `notify-${issueId}`,
          type: 'linear',
          payload: { action: 'create_comment', issueId, body },
        });
      } catch (e) {
        console.error(`[Orchestrator] Linear notify failed:`, e);
      }
    }
  }
}
