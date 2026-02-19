#!/usr/bin/env node
import 'dotenv/config';

const ROUTER_URL = process.env.ROUTER_URL || 'http://localhost:8787';
const API_KEY = process.env.PROXY_API_KEY || 'test-key-default';

async function fetchWithAuth(path: string, options: RequestInit = {}) {
    const url = `${ROUTER_URL}${path}`;
    const headers = {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    } as any;

    try {
        const response = await fetch(url, { ...options, headers });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }
        return response;
    } catch (error: any) {
        console.error(`❌ Request failed: ${error.message}`);
        process.exit(1);
    }
}

async function audit() {
    console.log(`🔍 Auditing Swarm at ${ROUTER_URL}...\n`);

    // 1. Metrics
    const metricsRes = await fetchWithAuth('/metrics');
    const metrics = await metricsRes.json();
    console.log('📊 Metrics:');
    console.table(metrics);

    // 2. Active Jobs
    const jobsRes = await fetchWithAuth('/jobs');
    const jobs: any[] = await jobsRes.json();
    const activeJobs = jobs.filter((j: any) => j.status !== 'completed' && j.status !== 'failed');

    console.log(`\n⚙️  Active Jobs (${activeJobs.length}):`);
    if (activeJobs.length === 0) {
        console.log('   (No active jobs)');
    } else {
        activeJobs.forEach((j) => {
            console.log(`   - [${j.status.toUpperCase()}] ${j.type} (ID: ${j.id}) P:${j.priority}`);
        });
    }

    // 3. Swarm Tasks
    const tasksRes = await fetchWithAuth('/v1/swarm/tasks');
    const tasks: any[] = await tasksRes.json();
    const pendingTasks = tasks.filter((t: any) => t.status === 'pending');

    console.log(`\n🐝 Pending Swarm Tasks (${pendingTasks.length}):`);
    if (pendingTasks.length === 0) {
        console.log('   (No pending tasks)');
    } else {
        pendingTasks.forEach((t) => {
            console.log(`   - [${t.type}] ${t.title} (ID: ${t.id})`);
        });
    }
}

async function sync() {
    console.log(`🔄 Triggering Swarm Synchronization...`);
    await fetchWithAuth('/v1/swarm/sync', { method: 'POST' });
    console.log('✅ Sync triggered successfully.');
}

async function trigger(issueId: string, title: string) {
    if (!issueId || !title) {
        console.error('❌ Missing required arguments: --id <issueId> --title <title>');
        process.exit(1);
    }

    console.log(`🚀 Triggering new task for ${issueId}...`);
    const payload = {
        issueIdentifier: issueId,
        issueTitle: title,
        issueId: 'manual-' + Date.now(),
        description: 'Manually triggered via swarm-control',
    };

    const res = await fetchWithAuth('/v1/swarm/trigger', {
        method: 'POST',
        body: JSON.stringify(payload),
    });

    const job = await res.json();
    console.log('✅ Task triggered:', job);
}

// Main CLI Logic
const args = process.argv.slice(2);
const command = args[0];

switch (command) {
    case 'audit':
        audit();
        break;
    case 'sync':
        sync();
        break;
    case 'trigger':
        const idIdx = args.indexOf('--id');
        const titleIdx = args.indexOf('--title');
        const id = idIdx !== -1 ? args[idIdx + 1] : '';
        const title = titleIdx !== -1 ? args[titleIdx + 1] : '';
        trigger(id, title);
        break;
    default:
        console.log(`
Usage:
  npx tsx scripts/ops/swarm-control.ts <command> [options]

Commands:
  audit       View metrics and active tasks
  sync        Force Swarm to process pending queue
  trigger     Create a new task manually
    --id      Issue Identifier (e.g., TEAM-123)
    --title   Issue Title
`);
        break;
}
