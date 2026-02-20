/**
 * Jules Agent (BIF-30) - The Hands
 *
 * This script runs locally or in a container, polling the Router (The Brain)
 * for tasks, executing them, and reporting back.
 *
 * Usage: JULES_API_KEY=... PROXY_URL=... tsx scripts/jules-agent.ts
 */



const JULES_API_KEY = process.env.JULES_API_KEY;
const PROXY_URL = process.env.PROXY_URL || 'http://localhost:8787';

if (!JULES_API_KEY) {
  console.error('Error: JULES_API_KEY is required');
  process.exit(1);
}

interface JulesTask {
  id: string;
  type: string;
  title: string;
  description: string;
  files: string[];
  status: string;
}

async function pollForTask() {
  try {
    console.log('🤖 Jules polling for tasks...');
    const response = await fetch(`${PROXY_URL}/jules/next`, {
      headers: { Authorization: `Bearer ${JULES_API_KEY}` },
    });

    if (response.status === 404) {
      console.log('💤 No tasks available. Sleeping...');
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to poll: ${response.statusText}`);
    }

    const task = (await response.json()) as JulesTask;
    return task;
  } catch (error) {
    console.error('Error polling for task:', error);
    return null;
  }
}

async function executeTask(task: JulesTask) {
  console.log(`\n🚀 Starting Task: ${task.title} (${task.id})`);
  console.log(`📝 Description: ${task.description}`);
  console.log(`Cb Files: ${task.files.join(', ')}`);

  // Simulate work
  console.log('... "Thinking" ...');
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log('... "Editing Code" ...');
  await new Promise((resolve) => setTimeout(resolve, 2000));
  console.log('... "Running Tests" ...');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Report success
  console.log('✅ Task processing complete. Reporting success...');

  await reportStatus(task.id, 'completed', {
    taskId: task.id,
    whatWasDone: 'Simulated task execution by Jules Agent.',
    diff: '+ console.log("Jules was here");',
    whatWorked: ['Agent polling', 'Task parsing', 'Simulation'],
    whatDidntWork: [],
    lessonsLearned: ['Jules is alive!'],
  });
}

async function reportStatus(taskId: string, status: string, log?: any) {
  try {
    const response = await fetch(`${PROXY_URL}/jules/update`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${JULES_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ taskId, status, engineeringLog: log }),
    });

    if (!response.ok) {
      throw new Error(`Failed to report status: ${response.statusText}`);
    }
    console.log('📬 Status reported to Router.');
  } catch (error) {
    console.error('Error reporting status:', error);
  }
}

async function main() {
  console.log(`
╔════════════════════════════════════════╗
║         JULES AGENT (BIF-30)           ║
║       "The Hands of the Agent"         ║
╚════════════════════════════════════════╝
    `);

  while (true) {
    const task = await pollForTask();
    if (task) {
      await executeTask(task);
    }

    // Wait 5 seconds before next poll
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

main().catch(console.error);
