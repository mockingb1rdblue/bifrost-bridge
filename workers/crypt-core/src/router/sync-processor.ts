import { RouterConfig } from './config';
import { RouterDependencies } from './dependencies';
import { RouterStateManager } from './state';
import { Job } from '../types';

/**
 * SyncProcessor: Handles syncing tasks from external systems like Linear.
 */
export class SyncProcessor {
  constructor(
    private config: RouterConfig,
    private deps: RouterDependencies,
    private stateManager: RouterStateManager
  ) {}

  async syncLinearTasks() {
    try {
      if (this.stateManager.isCircuitOpen('linear')) {
        console.warn('[SyncProcessor] Linear circuit is OPEN — skipping sync.');
        return;
      }

      if (!this.config.linear.apiKey || !this.config.linear.teamId) {
        return;
      }

      console.log('[SyncProcessor] Syncing from Linear...');
      const linear = this.deps.linear;
      
      const labels = await linear.listLabels(this.config.linear.teamId);
      const readyLabel = labels.find((l: any) => l.name === 'sluagh:ready');
      const activeLabel = labels.find((l: any) => l.name === 'sluagh:active');

      if (!readyLabel || !activeLabel) {
        console.warn('[SyncProcessor] Linear labels sluagh:ready or sluagh:active missing.');
        return;
      }

      const issues = await linear.listIssuesByLabel('sluagh:ready');
      console.log(`[SyncProcessor] Found ${issues.length} issues labeled sluagh:ready`);

      for (const issue of issues) {
        const metadata = this.parseMetadata(issue.description || '');
        const priority = parseInt(metadata.Priority || '10', 10);

        const existingJob = Object.values(this.stateManager.jobs).find(
          (j) => j.linearIssueId === issue.id && j.status !== 'failed' && j.status !== 'completed',
        );
        const alreadyIngested = this.stateManager.ingestedIssueIds.includes(issue.id);
        if (existingJob || alreadyIngested) continue;

        const isRunCommand = issue.title.includes('[run_command]');
        const jobType = isRunCommand ? 'runner_task' : 'orchestration';

        let commandPayload: string | undefined;
        if (isRunCommand) {
          try {
            const match = issue.description?.match(/```json\n([\s\S]*?)\n```/);
            commandPayload = match ? JSON.parse(match[1]).command : undefined;
          } catch {
            commandPayload = undefined;
          }
        }

        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newJob: Job = {
          id: jobId,
          type: jobType as Job['type'],
          status: 'pending',
          priority: priority,
          payload: {
            action: isRunCommand ? 'run_command' : 'initialize_and_plan',
            command: commandPayload,
            issueId: issue.id,
            issueIdentifier: issue.identifier,
            issueTitle: issue.title,
            description: issue.description,
            metadata: metadata,
          },
          linearIssueId: issue.id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await this.stateManager.saveJob(newJob);
        await this.stateManager.addIngestedIssueId(issue.id);

        try {
          if (activeLabel) {
            await linear.updateIssue(issue.id, { labelIds: [activeLabel.id] });
            console.log(`[SyncProcessor] ✅ Label swapped to sluagh:active for ${issue.identifier}`);
          }
        } catch (labelErr: any) {
          console.warn(`[SyncProcessor] ⚠️ Could not swap label for ${issue.identifier}: ${labelErr.message}`);
        }

        console.log(`[SyncProcessor] Queued job ${jobId} type=${jobType} for ${issue.identifier}`);

        await this.deps.events.append({
          type: 'TASK_SYNCED',
          source: 'custom-router',
          payload: { jobId, issueIdentifier: issue.identifier, jobType },
        });
      }

      await this.stateManager.recordCircuitSuccess('linear');
    } catch (e: any) {
      console.error('[SyncProcessor] Linear sync failed:', e.message);
      await this.stateManager.recordCircuitFailure('linear', 2, e.message);
    }
  }

  private parseMetadata(description: string = ''): Record<string, string> {
    const metadata: Record<string, string> = {};
    const lines = description.split('\n');
    let inMetadata = false;

    for (const line of lines) {
      if (line.trim().toLowerCase().startsWith('metadata:')) {
        inMetadata = true;
        continue;
      }
      if (inMetadata) {
        if (line.trim() === '' || !line.includes(':')) {
          if (line.trim() !== '') continue;
          inMetadata = false;
          continue;
        }
        const [key, ...valueParts] = line.split(':');
        if (key) {
          metadata[key.trim()] = valueParts.join(':').trim();
        }
      }
    }
    return metadata;
  }
}
