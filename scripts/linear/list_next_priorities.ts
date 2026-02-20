import { LinearClient } from '../../src/linear-client';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';

// Load .env
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

// Certs
const certPath = path.join(__dirname, '../.certs/corporate_bundle.pem');
if (fs.existsSync(certPath)) {
  process.env.NODE_EXTRA_CA_CERTS = certPath;
}

async function main() {
  let apiKey = process.env.LINEAR_API_KEY;
  const baseUrl = process.env.LINEAR_WEBHOOK_URL;

  const useDirect = process.argv.includes('--direct');

  // Smart Key Logic: if using proxy, use PROXY_API_KEY
  if (baseUrl && baseUrl.includes('workers.dev') && !useDirect) {
    console.log(chalk.blue('🌐 Using Proxy Configuration'));
    apiKey = process.env.PROXY_API_KEY;
  } else {
    console.log(chalk.blue('🔌 Using Direct Connection'));
    apiKey = process.env.LINEAR_API_KEY;
  }

  if (!apiKey) {
    console.error(chalk.red('❌ LINEAR_API_KEY or PROXY_API_KEY is missing in .env'));
    process.exit(1);
  }

  // If direct, we should use the standard Linear API URL
  const finalBaseUrl = useDirect ? 'https://api.linear.app/graphql' : baseUrl;

  const client = new LinearClient(apiKey, finalBaseUrl);
  console.log(chalk.green('✅ Authenticated with Linear'));

  // Remove lockfile if it exists before proceeding (since we might have triggered it in a previous run)
  if (fs.existsSync('.auth.lock')) {
    fs.unlinkSync('.auth.lock');
  }

  console.log(chalk.yellow('\n📊 Fetching Projects...'));
  const projects = await client.listProjects();

  if (projects.length === 0) {
    console.log('No projects found.');
    return;
  }

  const allIssues = [];

  for (const project of projects) {
    console.log(chalk.cyan(`   Checking project: ${project.name} (${project.id})`));
    const issues = await client.listIssues(project.id);
    allIssues.push(...issues.map((i) => ({ ...i, projectName: project.name })));
  }

  // Filter and Sort
  // Priority: 1=Urgent, 2=High, 3=Medium, 4=Low, 0=No Priority
  const priorityMap = {
    1: { label: 'Urgent', color: chalk.red },
    2: { label: 'High', color: chalk.yellow },
    3: { label: 'Medium', color: chalk.blue },
    4: { label: 'Low', color: chalk.white },
    0: { label: 'No Priority', color: chalk.gray },
  };

  const activeIssues = allIssues.filter(
    (issue) => issue.status.type !== 'completed' && issue.status.type !== 'canceled',
  );

  activeIssues.sort((a, b) => {
    // First by state (Started first)
    if (a.status.type === 'started' && b.status.type !== 'started') return -1;
    if (a.status.type !== 'started' && b.status.type === 'started') return 1;

    // Then by priority (1 is highest, 0 is lowest but treated as 5 for sorting)
    const pA = a.priority === 0 ? 5 : a.priority;
    const pB = b.priority === 0 ? 5 : b.priority;
    if (pA !== pB) return pA - pB;

    return a.identifier.localeCompare(b.identifier);
  });

  console.log(chalk.bold(`\n🚀 Next Priorities (${activeIssues.length} active issues):\n`));

  activeIssues.forEach((issue) => {
    const pInfo = priorityMap[issue.priority as keyof typeof priorityMap] || priorityMap[0];
    const priorityLabel = pInfo.color(`[${pInfo.label}]`);
    const statusLabel =
      issue.status.type === 'started'
        ? chalk.bgGreen.black(` ${issue.status.name} `)
        : chalk.bgBlue.white(` ${issue.status.name} `);

    console.log(
      `${chalk.bold(issue.identifier)} ${statusLabel} ${priorityLabel} ${chalk.white(issue.title)} ${chalk.gray(`(${issue.projectName})`)}`,
    );
    if (issue.assignee) {
      console.log(`   👤 ${chalk.gray('Assignee:')} ${issue.assignee.name}`);
    }
  });

  if (activeIssues.length === 0) {
    console.log(chalk.gray('No active issues found. Enjoy the silence!'));
  }
}

main().catch((err) => {
  console.error(chalk.red('\n💥 Fatal Error:'));
  console.error(err);
  process.exit(1);
});
