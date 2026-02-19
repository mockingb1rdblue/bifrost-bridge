import dotenv from 'dotenv';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const ROUTER_URL = process.env.ROUTER_URL || 'https://crypt-core.fly.dev'; // Default to Fly/Cloudflare
const PROXY_API_KEY = process.env.PROXY_API_KEY;

async function checkGitStatus(allowDirty: boolean, noPush: boolean) {
    console.log('🔍 Running Git Pre-flight Checks...');

    try {
        // 1. Check for uncommitted changes
        const { stdout: status } = await execAsync('git status --porcelain');
        if (status.trim() && !allowDirty) {
            console.error('❌ Error: Local git repository has uncommitted changes.');
            console.error('   Please commit or stash your changes before triggering the swarm.');
            console.error('   Or use --dirty to bypass (NOT RECOMMENDED).');
            process.exit(1);
        }

        // 2. Check current branch
        const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD');
        const currentBranch = branch.trim();

        if (!noPush) {
            console.log(`🚀 Pushing ${currentBranch} to origin...`);
            await execAsync(`git push origin ${currentBranch}`);
            console.log('✅ Changes pushed to remote.');
        } else {
            console.log('⚠️  Skipping push (--no-push). Swarm might see stale code.');
        }

    } catch (e: any) {
        console.error('❌ Git check failed:', e.message);
        process.exit(1);
    }
}

async function triggerBatch() {
    if (!PROXY_API_KEY) {
        console.error('❌ Error: PROXY_API_KEY not found in .env');
        process.exit(1);
    }

    const args = process.argv.slice(2);
    const batchSizeArg = args.find(arg => !arg.startsWith('--'));
    const batchSize = batchSizeArg ? parseInt(batchSizeArg) : 10;
    const forceSync = args.includes('--sync');
    const allowDirty = args.includes('--dirty');
    const noPush = args.includes('--no-push');

    // Run Pre-flight Checks
    await checkGitStatus(allowDirty, noPush);

    console.log(`--------------------------------`);
    console.log(`🚀 Triggering Swarm Batch (Size: ${batchSize}, Sync: ${forceSync})...`);
    console.log(`Target: ${ROUTER_URL}/v1/admin/batch`);

    try {
        const response = await fetch(`${ROUTER_URL}/v1/admin/batch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PROXY_API_KEY}`
            },
            body: JSON.stringify({
                batchSize,
                forceSync
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const data = await response.json() as any;
        console.log('✅ Batch Triggered Successfully');
        console.log('--------------------------------');
        console.log(`Processed Count: ${data.processedCount}`);

        if (data.jobs && data.jobs.length > 0) {
            console.log('\nJobs Queued:');
            data.jobs.forEach((job: any) => {
                console.log(`- [${job.id}] ${job.payload?.issueTitle || job.type} (Priority: ${job.priority})`);
            });
        } else {
            console.log('\nNo pending jobs found.');
        }

    } catch (error: any) {
        console.error('❌ Failed to trigger batch:', error.message);
        process.exit(1);
    }
}

triggerBatch();
