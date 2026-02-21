import { LinearClient } from '@linear/sdk';
import { config } from './config';

// Configuration
const LINEAR_API_KEY = config.LINEAR_API_KEY;
const ROUTER_URL = config.ROUTER_URL;
const PROXY_API_KEY = config.PROXY_API_KEY;
const POLL_INTERVAL = 10000; // 10 seconds

let linear: LinearClient;

// Loop Prevention State
const processedIssueIds = new Set<string>();
const issueAttemptCounts: Record<string, number> = {};

/**
 *
 */
export async function startLinearIngestor() {
  if (!LINEAR_API_KEY) {
    console.error('[LinearIngestor] Missing LINEAR_API_KEY. Ingestion disabled.');
    return;
  }

  try {
    linear = new LinearClient({ apiKey: LINEAR_API_KEY });
    console.log('[LinearIngestor] 👁️  Watching for Swarm tasks...');
    setInterval(pollLinear, POLL_INTERVAL);
  } catch (e: any) {
    console.error(`[LinearIngestor] Failed to initialize client: ${e.message}`);
  }
}

async function pollLinear() {
  try {
    const me = await linear.viewer;
    const myId = me.id;

    const issues = await linear.issues({
      filter: {
        state: { name: { eq: 'In Progress' } },
        assignee: { id: { eq: myId } },
      },
    });

    if (issues.nodes.length === 0) return;

    for (const issue of issues.nodes) {
      // Layer 1: Local cache check (fastest guard)
      if (processedIssueIds.has(issue.id)) continue;

      // Track attempts
      issueAttemptCounts[issue.id] = (issueAttemptCounts[issue.id] || 0) + 1;
      const attempt = issueAttemptCounts[issue.id];

      // Layer 3: Cap retries per issue
      if (attempt > 3) {
        processedIssueIds.add(issue.id);
        console.error(
          `[LinearIngestor][pick_up] ❌ Issue ${issue.id} failed 3 dispatch attempts — permanently skipping`,
        );
        continue;
      }

      // Check if we already commented
      const comments = await issue.comments();
      const hasProcessingComment = comments.nodes.some((c) =>
        c.body?.includes('🐝 Swarm Processing'),
      );

      if (hasProcessingComment) {
        processedIssueIds.add(issue.id); // Sync local state
        continue;
      }

      console.log(
        `[LinearIngestor][pick_up] ✅ Picked up issue: ${issue.title} (Attempt ${attempt}/3) | issueId=${issue.id}`,
      );

      // Parse payload
      let jobType = 'unknown';
      let payload = {};

      if (issue.title.includes('[SWARM]')) {
        if (issue.title.includes('run_command')) jobType = 'run_command';
        if (issue.title.includes('fetch_url')) jobType = 'fetch_url';
        if (issue.title.includes('orchestration')) jobType = 'orchestration';
      }

      // Extract JSON from description
      const jsonMatch = issue.description?.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        try {
          payload = JSON.parse(jsonMatch[1]);
        } catch (e) {
          console.error(
            `[LinearIngestor][parse_json] ❌ Failed to parse JSON for issue | issueId=${issue.id}`,
          );
          await linear.createComment({
            issueId: issue.id,
            body: '❌ **Error**: Invalid JSON payload in description.',
          });
          processedIssueIds.add(issue.id);
          continue;
        }
      } else {
        if (issue.title.includes('echo')) {
          jobType = 'run_command';
          payload = { command: 'echo', args: ['Hello from Linear'] };
        }
      }

      if (jobType === 'unknown') {
        console.log(
          `[LinearIngestor][parse_job] ❌ Skipping non-swarm issue | issueId=${issue.id}`,
        );
        processedIssueIds.add(issue.id); // Don't check again this session
        continue;
      }

      // Layer 2: Verify comment POST succeeded before dispatching
      processedIssueIds.add(issue.id); // Optimistically lock
      const commentRes = await linear.createComment({
        issueId: issue.id,
        body: '🐝 **Swarm Processing**\n\nTask dispatched to Router Queue.',
      });

      if (!commentRes.success) {
        processedIssueIds.delete(issue.id); // Rollback lock
        console.error(
          `[LinearIngestor][lock] ❌ Could not lock issue — skipping dispatch to avoid duplicate | issueId=${issue.id}`,
        );
        continue;
      }

      // 4. Dispatch to Router
      const startTime = Date.now();
      const response = await fetch(`${ROUTER_URL}/v1/queue/add`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PROXY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: jobType,
          payload: { ...payload, linearIssueId: issue.id },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        processedIssueIds.delete(issue.id); // Rollback to try again
        await linear.createComment({
          issueId: issue.id,
          body: `❌ **Dispatch Failed**: ${response.status} ${errText}`,
        });
        console.error(
          `[LinearIngestor][dispatch] ❌ Dispatch failed: ${response.status} | issueId=${issue.id} elapsed=${Date.now() - startTime}ms`,
        );
      } else {
        const result = (await response.json()) as any;
        console.log(
          `[LinearIngestor][dispatch] ✅ Dispatched to router | issueId=${issue.id} jobId=${result.id} elapsed=${Date.now() - startTime}ms`,
        );
      }
    }
  } catch (e: any) {
    console.error(`[LinearIngestor][poll] ❌ Unknown Error: ${e.message}`);
  }
}
