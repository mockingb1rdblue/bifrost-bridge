import { Job, JobHandler, JobResult } from '../agent';

export class OrchestratorHandler implements JobHandler {
    type = 'orchestration';
    private registry: Record<string, JobHandler>;

    constructor(registry: Record<string, JobHandler>) {
        this.registry = registry;
    }

    async execute(job: Job): Promise<JobResult> {
        const { title, steps, linearIssueId } = job.payload;
        console.log(`[Orchestrator] Starting orchestration: ${title || job.id}`);

        if (!Array.isArray(steps) || steps.length === 0) {
            return { success: false, error: 'No steps provided in orchestration payload' };
        }

        const results = [];
        let stepCount = 0;

        for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            stepCount++;
            console.log(`[Orchestrator][step ${stepCount}/${steps.length}] Executing type: ${step.type}`);

            const handler = this.registry[step.type];
            if (!handler) {
                const errorMsg = `No handler registered for step type: ${step.type}`;
                console.error(`[Orchestrator][step ${stepCount}/${steps.length}] ❌ failed: ${errorMsg}`);

                if (linearIssueId) {
                    await this.notifyLinear(linearIssueId, false, `❌ **Step ${stepCount} Failed**\n${errorMsg}`);
                }

                return {
                    success: false,
                    error: `Step ${stepCount} failed: ${errorMsg}`,
                    data: { firstFailedStep: stepCount, results }
                };
            }

            try {
                // Construct a mock job for the sub-step
                const stepJob: Job = {
                    id: `${job.id}-step-${stepCount}`,
                    type: step.type,
                    payload: step.payload
                };

                const stepResult = await handler.execute(stepJob);

                if (!stepResult.success) {
                    const errorMsg = stepResult.error || 'Unknown error during step execution';
                    console.error(`[Orchestrator][step ${stepCount}/${steps.length}] ❌ failed: ${errorMsg}`);

                    if (linearIssueId) {
                        await this.notifyLinear(linearIssueId, false, `❌ **Step ${stepCount} Failed**\n${errorMsg}`);
                    }

                    return {
                        success: false,
                        error: `Step ${stepCount} failed: ${errorMsg}`,
                        data: { firstFailedStep: stepCount, results }
                    };
                }

                console.log(`[Orchestrator][step ${stepCount}/${steps.length}] ✅ success`);
                results.push({ step: stepCount, type: step.type, data: stepResult.data });

            } catch (error: any) {
                console.error(`[Orchestrator][step ${stepCount}/${steps.length}] ❌ failed: ${error.message}`);

                if (linearIssueId) {
                    await this.notifyLinear(linearIssueId, false, `❌ **Step ${stepCount} Failed**\n${error.message}`);
                }

                return {
                    success: false,
                    error: `Step ${stepCount} failed: ${error.message}`,
                    data: { firstFailedStep: stepCount, results }
                };
            }
        }

        console.log(`[Orchestrator] ✅ Orchestration complete: ${title || job.id}`);

        if (linearIssueId) {
            await this.notifyLinear(linearIssueId, true, `✅ **Orchestration Complete**\nAll ${stepCount} steps executed successfully.`);
        }

        return {
            success: true,
            data: { stepsCompleted: stepCount, results }
        };
    }

    private async notifyLinear(issueId: string, success: boolean, body: string) {
        // Find LinearHandler in registry to reuse its logic if possible, 
        // otherwise we can just use the Linear API client if we refactor it, 
        // but for now the unfuck plan says: via LinearHandler's create_comment action.

        const linearHandler = this.registry['linear'];
        if (linearHandler) {
            try {
                await linearHandler.execute({
                    id: `notify-${issueId}`,
                    type: 'linear',
                    payload: {
                        action: 'create_comment',
                        issueId: issueId,
                        body: body
                    }
                });
            } catch (e) {
                console.error(`[Orchestrator] Failed to notify Linear:`, e);
            }
        } else {
            console.warn(`[Orchestrator] Cannot notify Linear - LinearHandler not found in registry`);
        }
    }
}
