import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const ROUTER_URL = process.env.ROUTER_URL || 'http://127.0.0.1:8787';
const PROXY_API_KEY = process.env.PROXY_API_KEY;
const BACKLOG_PATH = path.join(process.cwd(), 'docs', 'SWARM_BACKLOG.md');

interface OverseerTask {
  id: string;
  description: string;
  lineIndex: number;
}

async function startOverseer() {
  console.log('👁️ Awakening the Sluagh Overseer...');

  // 1. Read the Backlog
  let backlogContent = '';
  try {
    backlogContent = readFileSync(BACKLOG_PATH, 'utf-8');
  } catch (e: any) {
    console.error(`❌ Failed to read backlog at ${BACKLOG_PATH}:`, e.message);
    process.exit(1);
  }

  const lines = backlogContent.split('\n');
  let nextTask: OverseerTask | null = null;

  // 2. Find the next pending task [ ]
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // We only care about pending tasks
    const match = line.match(/^\s*-\s*\[\s\]\s*(.*)$/);

    if (match) {
      const fullDesc = match[1];

      // Extract the [ID] if present, e.g., "[CC-01] Schema Design: ..."
      const idMatch = fullDesc.match(/^(\[[A-Z0-9-]+\])?\s*(.*)$/);
      const taskId =
        idMatch && idMatch[1]
          ? idMatch[1].replace(/[\[\]]/g, '')
          : `AUTO-${crypto.randomUUID().slice(0, 5)}`;
      const taskText = idMatch && idMatch[2] ? idMatch[2] : fullDesc;

      nextTask = {
        id: taskId,
        description: taskText,
        lineIndex: i,
      };
      break;
    }
  }

  if (!nextTask) {
    console.log('✅ Backlog is empty or all tasks are active/completed.');
    process.exit(0);
  }

  console.log(`🎯 Identified next task: [${nextTask.id}] ${nextTask.description}`);

  // 3. Dispatch to Router
  try {
    console.log(`🚀 Dispatching task to Router (${ROUTER_URL})...`);

    const payload = {
      id: `task_${nextTask.id}_${Date.now()}`,
      type: 'coding',
      title: `Autonomous Issue: [${nextTask.id}]`,
      description: `This is an autonomous task assigned by the Sluagh Overseer from the SWARM_BACKLOG.md.\n\nTask Description:\n${nextTask.description}`,
      priority: 10,
      isHighRisk: false,
      issueId: nextTask.id,
      // For now, no specific issue tracking, or could integrate with Linear if preferred
    };

    const response = await fetch(`${ROUTER_URL}/v1/swarm/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${PROXY_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Router returned ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { id: string };
    console.log(`✅ Task accepted by Router. ID: ${data.id}`);
  } catch (e: any) {
    console.error('❌ Failed to dispatch task to router:', e.message);
    process.exit(1);
  }

  // 4. Update the Markdown File (Mark as In Progress)
  console.log(`📝 Updating SWARM_BACKLOG.md...`);
  const lineToUpdate = lines[nextTask.lineIndex];
  lines[nextTask.lineIndex] = lineToUpdate.replace('- [ ]', '- [/]');

  writeFileSync(BACKLOG_PATH, lines.join('\n'), 'utf-8');
  console.log(`✅ Backlog updated.`);

  console.log('👁️ Overseer cycle complete. Returning to slumber.');
}

if (require.main === module) {
  startOverseer().catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  });
}
