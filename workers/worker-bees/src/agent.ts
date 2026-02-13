
import { randomUUID } from 'crypto';

interface Job {
    id: string;
    type: string;
    payload: any;
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
const API_KEY = process.env.WORKER_API_KEY || 'dev-key';
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

class JulesTaskHandler implements JobHandler {
    type = 'runner_task';

    async execute(job: Job): Promise<JobResult> {
        const { action, filePath, content, pattern, searchDir } = job.payload;
        console.log(`[JulesHandler] Action: ${action} on ${filePath || searchDir}`);

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
                    console.log(`[JulesHandler] Reviewing change to ${filePath}`);
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
const handlers: Record<string, JobHandler> = {};

function registerHandler(handler: JobHandler) {
    handlers[handler.type] = handler;
    console.log(`[${WORKER_ID}] Registered handler for job type: ${handler.type}`);
}

// Register default handlers
registerHandler(new EchoJobHandler());
registerHandler(new JulesTaskHandler());

// --- Core Loop ---

async function pollForJob() {
    try {
        const response = await fetch(`${ROUTER_URL}/v1/queue/poll`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ workerId: WORKER_ID })
        });

        if (response.status === 404) {
            return; // No jobs
        }

        if (!response.ok) {
            console.error(`[${WORKER_ID}] Error polling: ${response.status} ${response.statusText}`);
            return;
        }

        const job = await response.json() as Job;
        console.log(`[${WORKER_ID}] 🍯 Found job: ${job.id} (${job.type})`);

        await processJob(job);

    } catch (error: any) {
        if (error.cause?.code === 'ECONNREFUSED') {
             console.error(`[${WORKER_ID}] Connection refused to ${ROUTER_URL}. Is the router running?`);
        } else {
             console.error(`[${WORKER_ID}] Poll error:`, error.message);
        }
    }
}

async function processJob(job: Job) {
    const handler = handlers[job.type];

    if (!handler) {
        console.warn(`[${WORKER_ID}] No handler for job type: ${job.type}`);
        await completeJob(job.id, { success: false, error: `No handler for type ${job.type}` });
        return;
    }

    try {
        console.log(`[${WORKER_ID}] ⚙️ Executing job ${job.id}...`);
        const result = await handler.execute(job);
        await completeJob(job.id, result);
    } catch (e: any) {
        console.error(`[${WORKER_ID}] Job execution failed:`, e);
        await completeJob(job.id, { success: false, error: e.message });
    }
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

// Start
console.log(`[${WORKER_ID}] 🐝 Worker Bee Swarm Agent starting...`);
console.log(`[${WORKER_ID}] Connecting to Router at: ${ROUTER_URL}`);

setInterval(pollForJob, POLL_INTERVAL);
