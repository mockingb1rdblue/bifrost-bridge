import { RouterDependencies } from './dependencies';
import { SluaghSwarmTask } from '../types';

/**
 * TaskCompletionProcessor: Handles the final stages of a task, including PR merging and Linear issue closure.
 */
export class TaskCompletionProcessor {
  constructor(private deps: RouterDependencies) {}

  async completeAndMergeTask(task: SluaghSwarmTask) {
    if (!task.prNumber || !task.repository) {
      console.warn(`[TaskCompletionProcessor] Task ${task.id} missing PR info. Cannot merge.`);
      return;
    }

    try {
      const github = this.deps.github;
      const linear = this.deps.linear;

      console.log(`[TaskCompletionProcessor] Approving and merging PR #${task.prNumber} for task ${task.id}`);

      // 1. Approve PR
      await github.createReviewComment(
        task.repository.owner,
        task.repository.name,
        task.prNumber,
        '🤖 **Autonomous Approval**: Sluagh Swarm verification successful. All tests passed. Merging...',
        'APPROVE',
      );

      // 2. Squash and Merge
      await github.mergePullRequest(
        task.repository.owner,
        task.repository.name,
        task.prNumber,
        'squash',
      );

      // 3. Move Linear Issue to Done
      const doneStateId = await linear.getStateIdByName('Done');
      if (doneStateId) {
        await linear.updateIssue(task.issueId, { stateId: doneStateId });
        await linear.addComment(
          task.issueId,
          `🏁 **Autonomous Merge & Close**\n\nPR #${task.prNumber} merged. Issue moved to **Done**.`,
        );
        await linear.removeLabel(task.issueId, 'swarm:review');
      } else {
        console.warn('[TaskCompletionProcessor] Done state not found in Linear.');
      }
    } catch (e: any) {
      console.error(`[TaskCompletionProcessor] Failed to merge/close: ${e.message}`);
    }
  }
}
