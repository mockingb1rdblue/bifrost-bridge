
import { LinearClient } from '@linear/sdk';

// Configuration
const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const ROUTER_URL = process.env.ROUTER_URL || 'http://localhost:8787';
const WORKER_API_KEY = process.env.WORKER_API_KEY || 'dev-key';
const POLL_INTERVAL = 10000; // 10 seconds

let linear: LinearClient;

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
        // 1. Find "In Progress" issues assigned to "Sluagh" (or designated bot user)
        // For V1, we'll just look for issues with a specific label "Swarm" in "In Progress"
        // to avoid spamming everyone.

        // Note: In a real prod env, we'd query for the specific user ID of the bot.
        // For now, let's filter client-side or use a simple query.

        const me = await linear.viewer;
        const myId = me.id;

        const issues = await linear.issues({
            filter: {
                state: { name: { eq: "In Progress" } },
                assignee: { id: { eq: myId } },
                // Only pick up issues that haven't been picked up yet?
                // We need a way to mark them as "Processing". 
                // We'll use a comment "🐝 Swarm Processing..." as a lock.
            }
        });

        if (issues.nodes.length === 0) return;

        for (const issue of issues.nodes) {
            // Check if we already commented
            const comments = await issue.comments();
            const hasProcessingComment = comments.nodes.some(c => c.body?.includes('🐝 Swarm Processing'));

            if (hasProcessingComment) continue;

            console.log(`[LinearIngestor] Picked up issue: ${issue.title}`);

            // 2. Parse payload
            // Expected format: "[SWARM] <Action>: <Payload>" or JSON block in description
            // Simple parsing for V1:
            // Title: [SWARM] run_command
            // Description: ```json { ... } ```

            let jobType = 'unknown';
            let payload = {};

            if (issue.title.includes('[SWARM]')) {
                if (issue.title.includes('run_command')) jobType = 'run_command';
                if (issue.title.includes('fetch_url')) jobType = 'fetch_url';
            }

            // Extract JSON from description
            const jsonMatch = issue.description?.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch) {
                try {
                    payload = JSON.parse(jsonMatch[1]);
                } catch (e) {
                    console.error(`[LinearIngestor] Failed to parse JSON for issue ${issue.id}`);
                    await linear.createComment({ issueId: issue.id, body: "❌ **Error**: Invalid JSON payload in description." });
                    continue;
                }
            } else {
                // Fallback for simple echo tests
                if (issue.title.includes('echo')) {
                    jobType = 'run_command';
                    payload = { command: 'echo', args: ['Hello from Linear'] };
                }
            }

            if (jobType === 'unknown') {
                console.log(`[LinearIngestor] Skipping non-swarm issue: ${issue.title}`);
                continue;
            }

            // 3. Mark as Processing
            await linear.createComment({ issueId: issue.id, body: "🐝 **Swarm Processing**\n\nTask dispatched to Router Queue." });

            // 4. Dispatch to Router
            const response = await fetch(`${ROUTER_URL}/v1/queue/add`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${WORKER_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: jobType,
                    payload: { ...payload, linearIssueId: issue.id } // Pass ID for reporting back
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                await linear.createComment({ issueId: issue.id, body: `❌ **Dispatch Failed**: ${response.status} ${errText}` });
            }
        }

    } catch (e: any) {
        console.error('[LinearIngestor] Error:', e.message);
    }
}
