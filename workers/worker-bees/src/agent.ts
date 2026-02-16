
import { randomUUID } from 'crypto';
import { AuthManager } from './auth';
import { NetworkDriver } from './network';

interface Job {
    id: string;
    type: string;
    payload: any;
    topic?: string;
    correlationId?: string;
}

interface JobResult {
    success: boolean;
    data?: any;
    error?: string;
}

interface JobHandler {
    type: string;
    execute(job: Job): Promise<JobResult>;
}

// Configuration
const ROUTER_URL = process.env.ROUTER_URL || 'http://localhost:8787';
const API_KEY = AuthManager.getApiKey();
const EVENTS_URL = process.env.EVENTS_URL || 'http://localhost:8889';
const EVENTS_SECRET = process.env.EVENTS_SECRET || 'dev-secret';
const WORKER_ID = `bee-${randomUUID().slice(0, 8)}`;
const BASE_POLL_INTERVAL = 5000;
const MAX_AUTH_FAILURES = 3;

const network = new NetworkDriver(WORKER_ID, API_KEY);

let consecutiveAuthFailures = 0;
let consecutiveEmptyPolls = 0;
const MAX_EMPTY_POLLS = 3; // Shut down after 3 empty polls (15s idle)
let currentPollInterval = BASE_POLL_INTERVAL;
let isPollingActive = true;

async function appendEvent(type: string, payload: any, topic?: string, correlationId?: string) {
    try {
        await network.robustFetch(`${EVENTS_URL}/append`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${EVENTS_SECRET}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type,
                source: WORKER_ID,
                topic: topic || 'global',
                correlation_id: correlationId,
                payload
            })
        });
    } catch (e: any) {
        console.error(`[${WORKER_ID}] Failed to report event:`, e.message);
    }
}

async function queryHistory(params: { topic?: string; limit?: number; type?: string }) {
    try {
        const query = new URLSearchParams();
        if (params.topic) query.set('topic', params.topic);
        if (params.limit) query.set('limit', params.limit.toString());
        if (params.type) query.set('type', params.type);

        const res = await network.robustFetch(`${ROUTER_URL}/admin/history?${query.toString()}`);
        if (res.ok) {
            return await res.json();
        }
    } catch (e) {
        console.error(`[${WORKER_ID}] Failed to query history:`, e);
    }
    return [];
}

const DEFAULT_SYSTEM_PROMPT = `You are a Sluagh Swarm Worker Bee, an autonomous agent in the Bifrost Bridge swarm.
Your goal is to execute technical tasks with precision and resilience.

SHARED MEMORY: You have access to the "Annals of Ankou" event store. Use it to check for:
1. Previous attempts at this task (check same topic).
2. Patterns of success or failure in similar tasks.
3. Lessons learned from earlier execution steps.

PEER REVIEW: All your code changes will be reviewed by another agent or a human. Ensure your work is well-commented and verifiable.`;

// --- Handlers ---

class EchoJobHandler implements JobHandler {
    type = 'echo';

    async execute(job: Job): Promise<JobResult> {
        console.log(`[EchoHandler] Echoing payload:`, job.payload);
        return {
            success: true,
            data: {
                message: job.payload.message || 'No message provided',
                timestamp: new Date().toISOString(),
                workerId: WORKER_ID
            }
        };
    }
}

import { promises as fs } from 'fs';
import path from 'path';

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class SwarmTaskHandler implements JobHandler {
    type = 'runner_task';

    async execute(job: Job): Promise<JobResult> {
        const { action, filePath, content, pattern, searchDir } = job.payload;
        console.log(`[JulesHandler] Action: ${action} on ${filePath || searchDir}`);

        try {
            switch (action) {
                case 'run_command': {
                    const { command, cwd } = job.payload;
                    console.log(`[SwarmHandler] Running: ${command} in ${cwd || '.'}`);
                    const { stdout, stderr } = await execAsync(command, { cwd: cwd || '.' });
                    return { success: true, data: { stdout, stderr } };
                }
                case 'swarm_task': {
                    console.log(`[SwarmHandler] Executing autonomous swarm task: ${job.payload.identifier}`);

                    // 1. Get Context
                    const history = await queryHistory({ topic: job.topic, limit: 10 });
                    const historyContext = history.length > 0
                        ? `\n\nRecent context from Annals of Ankou:\n${JSON.stringify(history, null, 2)}`
                        : '';

                    // 2. Planning Phase
                    const planResponse = await network.robustFetch(`${ROUTER_URL}/v2/chat`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-topic': job.topic || 'global',
                            'x-correlation-id': job.correlationId || job.id
                        },
                        body: JSON.stringify({
                            taskType: 'planning',
                            messages: [
                                { role: 'system', content: DEFAULT_SYSTEM_PROMPT + '\n\nTask: Autonomous Problem Solving. You must solve the issue by providing a sequence of shell commands.' },
                                { role: 'user', content: `Issue: ${job.payload.title}\nDescription: ${job.payload.description}${historyContext}\n\nProvide a JSON array of shell commands to solve this issue. Example: ["ls", "cat file.ts", "sed -i ..."]. Only return the JSON array.` }
                            ]
                        })
                    });

                    if (!planResponse.ok) throw new Error(`Planning failed: ${planResponse.status}`);
                    const planResult = await planResponse.json() as any;

                    let commands: string[] = [];
                    try {
                        const content = planResult.content.trim();
                        const jsonMatch = content.match(/\[.*\]/s);
                        commands = JSON.parse(jsonMatch ? jsonMatch[0] : content);
                    } catch (e) {
                        console.error('[SwarmHandler] Failed to parse plan:', planResult.content);
                        throw new Error('Failed to parse autonomous plan');
                    }

                    // 3. Execution Phase
                    const executionResults = [];
                    for (const cmd of commands) {
                        console.log(`[SwarmHandler] Executing: ${cmd}`);
                        try {
                            const { stdout, stderr } = await execAsync(cmd);
                            executionResults.push({ command: cmd, success: true, stdout, stderr });
                        } catch (e: any) {
                            executionResults.push({ command: cmd, success: false, error: e.message });
                            // Stop on failure? For now, yes.
                            break;
                        }
                    }

                    return {
                        success: executionResults.every(r => r.success),
                        data: { executionResults, summary: `Executed ${executionResults.length} commands.` }
                    };
                }
                default:
                    return { success: false, error: `Unsupported action: ${action}` };
            }
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
}

class OrchestrationJobHandler implements JobHandler {
    type = 'orchestration';

    async execute(job: Job): Promise<JobResult> {
        console.log(`[OrchestrationHandler] Delegating orchestration for ${job.payload.identifier}...`);

        try {
            const response = await network.robustFetch(`${ROUTER_URL}/orchestrate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(job)
            });

            if (!response.ok) {
                const errorText = await response.text();
                return { success: false, error: `Orchestration failed: ${response.status} ${errorText}` };
            }

            const data = await response.json();
            return { success: true, data };
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }
}

// Registry
const handlers: Record<string, JobHandler> = {};

function registerHandler(handler: JobHandler) {
    handlers[handler.type] = handler;
    console.log(`[${WORKER_ID}] Registered handler for job type: ${handler.type}`);
}

// Register default handlers
registerHandler(new EchoJobHandler());
registerHandler(new SwarmTaskHandler());
registerHandler(new OrchestrationJobHandler());

// --- Core Loop ---

async function pollForJob() {
    if (!isPollingActive) return;

    try {
        const response = await network.robustFetch(`${ROUTER_URL}/v1/queue/poll`, {
            method: 'POST',
            body: JSON.stringify({ workerId: WORKER_ID })
        });

        if (response.status === 401) {
            consecutiveAuthFailures++;
            const expectedHash = response.headers.get('X-Auth-Key-Hash') || 'unknown';
            const actualHash = AuthManager.getKeyHash(API_KEY);

            console.error(`[${WORKER_ID}] ❌ Auth Failure (${consecutiveAuthFailures}/${MAX_AUTH_FAILURES})`);

            if (consecutiveAuthFailures >= MAX_AUTH_FAILURES) {
                isPollingActive = false;
                AuthManager.printDeathBanner('Maximum authentication failures exceeded.', {
                    workerId: WORKER_ID,
                    routerUrl: ROUTER_URL,
                    expectedKeyHash: expectedHash,
                    actualKeyHash: actualHash,
                    consecutiveFailures: consecutiveAuthFailures
                });
                return;
            }

            // Auth failures use deterministic exponential backoff
            currentPollInterval = network.getNextDelay();
            return;
        }

        // Reset on any non-401 success/404
        consecutiveAuthFailures = 0;
        currentPollInterval = BASE_POLL_INTERVAL;

        if (response.status === 404) {
            return; // No jobs
        }

        if (!response.ok) {
            console.error(`[${WORKER_ID}] Error polling: ${response.status} ${response.statusText}`);
            return;
        }

        const data = await response.json() as any;
        if (!data.job) {
            consecutiveEmptyPolls++;
            console.log(`[${WORKER_ID}] No jobs available (${consecutiveEmptyPolls}/${MAX_EMPTY_POLLS})`);

            if (consecutiveEmptyPolls >= MAX_EMPTY_POLLS) {
                console.warn(`[${WORKER_ID}] Swarm is idle. Self-terminating to save resources.`);
                process.exit(0);
            }
            return; // No jobs
        }

        // Reset on job found
        consecutiveEmptyPolls = 0;
        const job = data.job as Job;
        console.log(`[${WORKER_ID}] 🍯 Found job: ${job.id} (${job.type})`);

        await processJob(job);

    } catch (error: any) {
        // network.robustFetch already logs detailed diagnostics
        currentPollInterval = network.getNextDelay();
    } finally {
        if (isPollingActive) {
            setTimeout(pollForJob, currentPollInterval);
        }
    }
}

async function processJob(job: Job) {
    const handler = handlers[job.type];

    if (!handler) {
        console.warn(`[${WORKER_ID}] No handler for job type: ${job.type}`);
        await completeJob(job, { success: false, error: `No handler for type ${job.type}` });
        return;
    }

    try {
        console.log(`[${WORKER_ID}] ⚙️ Executing job ${job.id}...`);

        await appendEvent('AGENT_JOB_STARTED', {
            jobId: job.id,
            type: job.type,
            handler: handler.constructor.name
        }, job.topic, job.correlationId);

        const result = await handler.execute(job);
        await completeJob(job, result);
    } catch (e: any) {
        console.error(`[${WORKER_ID}] Job execution failed:`, e);
        await completeJob(job, { success: false, error: e.message });
    }
}

async function completeJob(job: Job, result: JobResult) {
    try {
        await network.robustFetch(`${ROUTER_URL}/v1/queue/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jobId: job.id,
                workerId: WORKER_ID,
                result: result.data,
                error: result.error
            })
        });

        await appendEvent('AGENT_JOB_COMPLETED', {
            jobId: job.id,
            success: result.success,
            error: result.error
        }, job.topic, job.correlationId);

        console.log(`[${WORKER_ID}] ✅ Job ${job.id} completed.`);
    } catch (e: any) {
        console.error(`[${WORKER_ID}] Failed to complete job ${job.id}`, e.message);
    }
}

// Start
console.log(`[${WORKER_ID}] 🐝 Worker Bee Swarm Agent starting...`);
console.log(`[${WORKER_ID}] Connecting to Router at: ${ROUTER_URL}`);
console.log(`[${WORKER_ID}] Key Hash: ${AuthManager.getKeyHash(API_KEY)}`);

/**
 * HANDSHAKE PROTOCOL
 * Verifies server alignment before starting work.
 * Prevents loops of death and provides diagnostic evidence.
 */
async function performHandshake(): Promise<boolean> {
    console.log(`[${WORKER_ID}] 🤝 Initiating Pre-Flight Handshake...`);

    try {
        const diagUrl = `${ROUTER_URL}/debug/auth-diag`;
        const res = await fetch(diagUrl);

        if (!res.ok) {
            console.error(`[${WORKER_ID}] ❌ Handshake Failed: Router returned ${res.status}`);
            return false;
        }

        const serverDiag = await res.json() as any;
        const myKeyHash = AuthManager.getKeyHash(API_KEY);
        const hashesMatch = myKeyHash === serverDiag.keyHash;

        console.log(`[${WORKER_ID}] 🔍 Diagnostic Report:`);
        console.log(`    - Router URL: ${ROUTER_URL}`);
        console.log(`    - Server Has Key: ${serverDiag.hasKey}`);
        console.log(`    - Server Key Hash: ${serverDiag.keyHash}`);
        console.log(`    - My Key Hash:     ${myKeyHash}`);
        console.log(`    - Match:           ${hashesMatch ? '✅ YES' : '❌ NO'}`);

        if (!hashesMatch) {
            console.error(`[${WORKER_ID}] 🚨 FATAL KEY MISMATCH DETECTED.`);
            return false;
        }

        console.log(`[${WORKER_ID}] ✅ Handshake Successful. Swarm alignment verified.`);
        return true;

    } catch (e: any) {
        console.error(`[${WORKER_ID}] ❌ Handshake Exception:`, e.message);
        return false;
    }
}

/**
 * HOVER MODE
 * Keeps process alive for log inspection without performing work.
 */
async function enterHoverMode(reason: string) {
    console.warn(`\n[${WORKER_ID}] 🚁 ENTERING HOVER MODE: ${reason}`);
    console.warn(`[${WORKER_ID}] Polling DISABLED. App will remain alive for logs.`);

    while (true) {
        await new Promise(resolve => setTimeout(resolve, 30000));
        console.log(`[${WORKER_ID}] 🚁 Still hovering... (Reason: ${reason})`);
    }
}

// --- Start Sequence ---
(async () => {
    const isAligned = await performHandshake();

    if (isAligned) {
        pollForJob();
    } else {
        await enterHoverMode("Auth Alignment Failed during Handshake");
    }
})();
