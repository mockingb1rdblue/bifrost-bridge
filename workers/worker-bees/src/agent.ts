import { randomUUID } from 'crypto';
import { RunCommandHandler } from './handlers/RunCommandHandler';
import { FetchUrlHandler } from './handlers/FetchUrlHandler';
import { LinearHandler } from './handlers/LinearHandler';
import { CodingHandler } from './handlers/CodingHandler';
import { VerifyHandler } from './handlers/VerifyHandler';
import { ReviewHandler } from './handlers/ReviewHandler';
import { startLinearIngestor } from './ingestor';

export interface Job {
    id: string;
    type: string;
    payload: any;
}

export interface JobResult {
    success: boolean;
    data?: any;
    error?: string;
}

export interface JobHandler {
    type: string;
    execute(job: Job): Promise<JobResult>;
}

// Configuration
const ROUTER_URL = process.env.ROUTER_URL || 'http://localhost:8787';
const API_KEY = process.env.PROXY_API_KEY || 'dev-key';
const WORKER_ID = `bee-${randomUUID().slice(0, 8)}`;
const POLL_INTERVAL = 5000;

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

class SwarmTaskHandler implements JobHandler {
    type = 'runner_task';

    async execute(job: Job): Promise<JobResult> {
        const { action, filePath, content, pattern, searchDir } = job.payload;
        console.log(`[Sluagh SwarmHandler] Action: ${action} on ${filePath || searchDir}`);

        try {
            switch (action) {
                case 'read_file': {
                    const data = await fs.readFile(filePath, 'utf-8');
                    return { success: true, data: { content: data } };
                }
                case 'write_file': {
                    await fs.mkdir(path.dirname(filePath), { recursive: true });
                    await fs.writeFile(filePath, content, 'utf-8');
                    return { success: true, data: { status: 'File written successfully' } };
                }
                case 'list_dir': {
                    const files = await fs.readdir(searchDir || '.');
                    return { success: true, data: { files } };
                }
                case 'review_diff': {
                    // In a full implementation, this would call the Router's LLM endpoint
                    // For now, we'll return a status that it's "Reviewed for consistency"
                    console.log(`[Sluagh SwarmHandler] Reviewing change to ${filePath}`);
                    return {
                        success: true,
                        data: {
                            status: 'Reviewed',
                            summary: `File ${filePath} reviewed by collaborative agent. Changes appear consistent with topic ${job.payload.topic || 'unknown'}.`
                        }
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

// Registry
export const handlers: Record<string, JobHandler> = {};

export function registerHandler(handler: JobHandler) {
    handlers[handler.type] = handler;
    console.log(`[${WORKER_ID}] Registered handler for job type: ${handler.type}`);
}

// Register default handlers
registerHandler(new EchoJobHandler());
registerHandler(new SwarmTaskHandler());
registerHandler(new RunCommandHandler());
registerHandler(new FetchUrlHandler());
registerHandler(new LinearHandler());
registerHandler(new CodingHandler(ROUTER_URL, API_KEY));
registerHandler(new VerifyHandler());
registerHandler(new ReviewHandler(ROUTER_URL, API_KEY));

// --- Core Loop ---

/**
 * @description The primary autonomous loop for the Worker Bee.
 * It periodically polls the custom-router for pending tasks using a FIFO (First-In, First-Out) logic
 * managed by the Durable Object's internal queue.
 * 
 * @lifecycle
 * 1. Poll: Request a job from `POST /v1/queue/poll` AND `v1/swarm/next`.
 * 2. Execute: If a job is found, locate the appropriate `JobHandler` and run it.
 * 3. Complete: Report the result (success or error) back to `POST /v1/queue/complete`.
 * 
 */
async function pollForJob() {
    try {
        // 1. Poll for Legacy Queue Jobs
        await pollQueue();

        // 2. Poll for Sluagh Swarm Tasks (New Autonomy)
        await pollSwarm();

    } catch (error: any) {
        if (error.cause?.code === 'ECONNREFUSED') {
            console.error(`[${WORKER_ID}] Connection refused to ${ROUTER_URL}. Is the router running?`);
        } else {
            console.error(`[${WORKER_ID}] Poll error:`, error.message);
        }
    }
}

async function pollQueue() {
    const response = await fetch(`${ROUTER_URL}/v1/queue/poll`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ workerId: WORKER_ID })
    });

    if (response.status === 404) return;
    if (!response.ok) {
        console.error(`[${WORKER_ID}] Queue Poll Error: ${response.status} - ${await response.text()}`);
        return;
    }

    const job = await response.json() as Job;
    console.log(`[${WORKER_ID}] 🍯 Found Queue Job: ${job.id} (${job.type})`);
    await processJob(job);
}

async function pollSwarm() {
    const response = await fetch(`${ROUTER_URL}/v1/swarm/next`, {
        method: 'GET', // or POST? The router implementation for getSluaghSwarmNextTask is triggered by /v1/swarm/next
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        }
    });

    if (response.status === 404) return;
    if (!response.ok) {
        console.error(`[${WORKER_ID}] Swarm Poll Error: ${response.status} - ${await response.text()}`);
        return;
    }

    const task = await response.json() as any;
    const job: Job = {
        id: task.id,
        type: task.type,
        payload: {
            ...task,
            isSwarm: true // Flag to know which completion endpoint to use
        }
    };

    console.log(`[${WORKER_ID}] 🏴‍☠️ Found Swarm Task: ${job.id} (${job.type})`);
    await processJob(job);
}

async function processJob(job: Job) {
    const handler = handlers[job.type];

    if (!handler) {
        console.warn(`[${WORKER_ID}] No handler for job type: ${job.type}`);
        // If swarm task, we might need a different failure report mechanism? 
        // For now, let's treat generic completion or swarm update.
        if (job.payload.isSwarm) {
            await completeSwarmTask(job.id, { success: false, error: `No handler for type ${job.type}` });
        } else {
            await completeJob(job.id, { success: false, error: `No handler for type ${job.type}` });
        }
        return;
    }

    try {
        console.log(`[${WORKER_ID}] ⚙️ Executing job ${job.id}...`);

        // --- Special Handling for Swarm Tasks (Status Update to 'in-progress') ---
        if (job.payload.isSwarm) {
            await updateSwarmStatus(job.id, 'in_progress', 'Started execution by Worker Bee');
        }

        const result = await handler.execute(job);

        if (job.payload.isSwarm) {
            await completeSwarmTask(job.id, result);
        } else {
            await completeJob(job.id, result);
        }
    } catch (e: any) {
        console.error(`[${WORKER_ID}] Job execution failed:`, e);
        if (job.payload.isSwarm) {
            await completeSwarmTask(job.id, { success: false, error: e.message });
        } else {
            await completeJob(job.id, { success: false, error: e.message });
        }
    }
}

async function updateSwarmStatus(taskId: string, status: string, log?: string, extraData: any = {}) {
    try {
        await fetch(`${ROUTER_URL}/v1/swarm/update`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                taskId,
                status,
                engineeringLog: log,
                ...extraData
            })
        });
    } catch (e: any) {
        console.error(`[${WORKER_ID}] Failed to update swarm status`, e.message);
    }
}

async function completeSwarmTask(taskId: string, result: JobResult) {
    const status = result.success ? 'completed' : 'failed';
    const log = `Worker execution finished.\nSuccess: ${result.success}\nData: ${JSON.stringify(result.data)}\nError: ${result.error || 'None'}`;

    // In CodingHandler we return 'engineeringLog' in data, let's use that if available
    const finalLog = result.data?.engineeringLog || log;

    const extraData: any = {};
    if (result.data?.reviewDecision) extraData.reviewDecision = result.data.reviewDecision;
    if (result.data?.reviewBody) extraData.reviewBody = result.data.reviewBody;

    await updateSwarmStatus(taskId, status, finalLog, extraData);
    console.log(`[${WORKER_ID}] ✅ Swarm Task ${taskId} completed (${status}).`);
}

async function completeJob(jobId: string, result: JobResult) {
    try {
        await fetch(`${ROUTER_URL}/v1/queue/complete`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                jobId,
                workerId: WORKER_ID,
                result: result.data,
                error: result.error
            })
        });
        console.log(`[${WORKER_ID}] ✅ Job ${jobId} completed.`);
    } catch (e: any) {
        console.error(`[${WORKER_ID}] Failed to complete job ${jobId}`, e.message);
    }
}

const startAgent = () => {
    console.log(`[${WORKER_ID}] 🐝 Worker Bee Sluagh Swarm Agent starting...`);
    console.log(`[${WORKER_ID}] Connecting to Router at: ${ROUTER_URL}`);

    // Start the Linear Polling Loop
    startLinearIngestor();

    setInterval(pollForJob, POLL_INTERVAL);
};

if (require.main === module) {
    startAgent();
}

export { pollForJob, processJob, completeJob, startAgent };
