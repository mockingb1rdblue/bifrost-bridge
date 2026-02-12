#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { PerplexityClient } from './perplexity-client';
import { LinearClient } from './linear-client';
import { PERPLEXITY_MODELS } from './models';
import {
  PerplexityResponse,
  ValidationError,
  NetworkError,
  TimeoutError,
  AuthenticationError,
} from './types/perplexity';
import { LinearError, LinearAuthenticationError } from './types/linear';
import { logger } from './utils/logger';
import { Detective } from './utils/detective';
import { Slicer } from './utils/slicer';
import { WindowsUtility } from './utils/windows';
import { SetupUtility } from './utils/setup';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env from root
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

// Auto-inject corporate certs if present
const certPath = path.join(__dirname, '../.certs/corporate_bundle.pem');
if (fs.existsSync(certPath)) {
  process.env.NODE_EXTRA_CA_CERTS = certPath;
}

// Constants
const MAX_QUERY_LENGTH = 5000;
const MIN_QUERY_LENGTH = 3;

const program = new Command();

program
  .name('bifrost')
  .description('Bifrost Bridge CLI Tool')
  .version('1.0.0')
  .option('-d, --direct', 'Bypass proxies and connect to APIs directly', false);

// Helper to get Perplexity client with validation
function getPerplexityClient(): PerplexityClient {
  const options = program.opts();
  let apiKey = process.env.PERPLEXITY_API_KEY;
  let baseUrl = process.env.PERPLEXITY_BASE_URL;

  if (options.direct) {
    baseUrl = 'https://api.perplexity.ai';
  } else {
    // Smart Key Logic: if using proxy, use PROXY_API_KEY
    if (baseUrl && baseUrl.includes('workers.dev')) {
      apiKey = process.env.PROXY_API_KEY;
    }
  }

  if (!apiKey) {
    console.error(chalk.red('Error:'), 'No Perplexity API Key found. Check your .env file.');
    console.error(chalk.dim('Required: PERPLEXITY_API_KEY or PROXY_API_KEY'));
    process.exit(2);
  }

  try {
    return new PerplexityClient(apiKey, baseUrl);
  } catch (error) {
    console.error(
      chalk.red('Error:'),
      'Failed to initialize Perplexity client:',
      (error as Error).message,
    );
    process.exit(2);
  }
}

// Helper to get Linear client
function getLinearClient(): LinearClient {
  const options = program.opts();
  let apiKey = process.env.LINEAR_API_KEY;
  let baseUrl = process.env.LINEAR_WEBHOOK_URL;

  if (options.direct) {
    baseUrl = 'https://api.linear.app/graphql';
  } else {
    // Smart Key Logic: if using proxy, use PROXY_API_KEY
    if (baseUrl && baseUrl.includes('workers.dev')) {
      apiKey = process.env.PROXY_API_KEY;
    }
  }

  if (!apiKey) {
    console.error(chalk.red('Error:'), 'No Linear API Key found. Check your .env file.');
    console.error(chalk.dim('Required: LINEAR_API_KEY or PROXY_API_KEY'));
    process.exit(2);
  }

  try {
    return new LinearClient(apiKey, baseUrl);
  } catch (error) {
    console.error(
      chalk.red('Error:'),
      'Failed to initialize Linear client:',
      (error as Error).message,
    );
    process.exit(2);
  }
}

/**
 * Validate query input
 */
function validateQuery(query: string): void {
  if (!query || query.trim().length < MIN_QUERY_LENGTH) {
    console.error(chalk.red('Error:'), `Query must be at least ${MIN_QUERY_LENGTH} characters`);
    process.exit(1); // User error
  }

  if (query.length > MAX_QUERY_LENGTH) {
    console.error(
      chalk.red('Error:'),
      `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters`,
    );
    process.exit(1);
  }
}

/**
 * Handle errors with user-friendly messages
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleError(error: Error, spinner?: any): void {
  if (spinner) {
    spinner.fail('Request failed');
  }

  if (error instanceof ValidationError) {
    console.error(chalk.red('Validation Error:'), error.message);
    process.exit(1);
  } else if (error instanceof AuthenticationError || error instanceof LinearAuthenticationError) {
    console.error(chalk.red('Authentication Error:'), 'Invalid API key');
    console.error(chalk.dim('Check your .env file and ensure keys are correct'));
    process.exit(2);
  } else if (error instanceof NetworkError) {
    console.error(chalk.red('Network Error:'), 'Could not connect to API');
    console.error(chalk.dim('Check your internet connection and proxy settings'));
    process.exit(2);
  } else if (error instanceof TimeoutError) {
    console.error(chalk.red('Timeout Error:'), 'Request took too long');
    console.error(chalk.dim('Try again or use a simpler query'));
    process.exit(2);
  } else if (error instanceof LinearError) {
    console.error(chalk.red('Linear Error:'), error.message);
    process.exit(2);
  } else {
    console.error(chalk.red('Unexpected Error:'), error.message);
    logger.error('CLI error', error);
    process.exit(2);
  }
}

/**
 * Display response with citations
 */
function displayResponse(response: PerplexityResponse): void {
  console.log(chalk.bold.green('\nAnswer:'));
  console.log(response.choices[0].message.content);

  // Citations
  if (response.citations && response.citations.length > 0) {
    console.log(chalk.dim('\nSources:'));
    response.citations.forEach((c, i) => console.log(chalk.dim(`[${i + 1}] ${c}`)));
  }

  // Usage stats
  if (response.usage) {
    console.log(
      chalk.dim(
        `\nTokens: ${response.usage.total_tokens} (prompt: ${response.usage.prompt_tokens}, completion: ${response.usage.completion_tokens})`,
      ),
    );
  }
}

// Perplexity Commands
program
  .command('ask')
  .description('Quickly ask a question (Standard Sonar Model)')
  .argument('<query>', 'The question to ask')
  .action(async (query: string) => {
    validateQuery(query);

    const spinner = ora('Thinking...').start();

    try {
      const client = getPerplexityClient();
      const response = await client.chat([{ role: 'user', content: query }], {
        model: PERPLEXITY_MODELS.SONAR,
      });

      spinner.succeed('Complete');
      displayResponse(response);
      process.exit(0);
    } catch (error) {
      handleError(error as Error, spinner);
    }
  });

program
  .command('research')
  .description('Deep research with reasoning (Sonar Reasoning Pro)')
  .argument('<query>', 'The research topic')
  .action(async (query: string) => {
    validateQuery(query);

    console.log(chalk.blue(chalk.bold('Initiating Research Task: ') + query));
    const spinner = ora('Reasoning (this may take a minute)...').start();

    try {
      const client = getPerplexityClient();
      const response = await client.research(query);

      spinner.succeed('Research Complete');
      displayResponse(response);
      process.exit(0);
    } catch (error) {
      handleError(error as Error, spinner);
    }
  });

// Linear Commands
const linear = program.command('linear').description('Linear project management commands');

linear
  .command('projects')
  .description('List all Linear projects')
  .action(async () => {
    const spinner = ora('Fetching projects...').start();

    try {
      const client = getLinearClient();
      const projects = await client.listProjects();

      spinner.succeed(`Found ${projects.length} projects:`);

      projects.forEach((p) => {
        console.log(chalk.bold(`\n${p.name} `) + chalk.dim(`(${p.id})`));
        console.log(
          chalk.dim(
            `Status: ${p.status.name} (${p.status.type}) | Progress: ${Math.round(p.progress * 100)}%`,
          ),
        );
        if (p.description) console.log(chalk.italic(`"${p.description}"`));
      });

      process.exit(0);
    } catch (error) {
      handleError(error as Error, spinner);
    }
  });

linear
  .command('issues')
  .description('List issues for a Linear project')
  .argument('<projectId>', 'The ID of the project to list issues for')
  .action(async (projectId: string) => {
    const spinner = ora('Fetching issues...').start();

    try {
      const client = getLinearClient();
      const issues = await client.listIssues(projectId);

      spinner.succeed(`Found ${issues.length} issues:`);

      issues.forEach((issue) => {
        const priority = issue.priority ? `P${issue.priority}` : 'No Priority';
        console.log(
          chalk.bold(`\n[${issue.identifier}] ${issue.title} `) + chalk.dim(`(${issue.id})`),
        );
        console.log(chalk.dim(`Status: ${issue.status.name} | Priority: ${priority}`));
        if (issue.assignee) console.log(chalk.dim(`Assignee: ${issue.assignee.name}`));
        if (issue.description) {
          const preview =
            issue.description.length > 100
              ? issue.description.substring(0, 100) + '...'
              : issue.description;
          console.log(chalk.italic(`"${preview}"`));
        }
      });

      process.exit(0);
    } catch (error) {
      handleError(error as Error, spinner);
    }
  });

linear
  .command('statuses')
  .description('List all available project statuses')
  .action(async () => {
    const spinner = ora('Fetching statuses...').start();

    try {
      const client = getLinearClient();
      const statuses = await client.listProjectStatuses();

      spinner.succeed(`Found ${statuses.length} statuses:`);

      statuses.forEach((s) => {
        console.log(
          chalk.bold(`${s.name} `) + chalk.dim(`(Type: ${s.type})`) + chalk.dim(` ID: ${s.id}`),
        );
      });

      process.exit(0);
    } catch (error) {
      handleError(error as Error, spinner);
    }
  });

linear
  .command('workflow-states')
  .description('List all available workflow states for issues')
  .option('-t, --team <teamId>', 'Filter by team ID')
  .action(async (options) => {
    const spinner = ora('Fetching workflow states...').start();

    try {
      const client = getLinearClient();
      const states = await client.getWorkflowStates(options.team || process.env.LINEAR_TEAM_ID);

      spinner.succeed(`Found ${states.length} workflow states:`);

      states.forEach((s) => {
        console.log(
          chalk.bold(`${s.name} `) + chalk.dim(`(Type: ${s.type})`) + chalk.dim(` ID: ${s.id}`),
        );
      });

      process.exit(0);
    } catch (error) {
      handleError(error as Error, spinner);
    }
  });

linear
  .command('complete-project')
  .description('Mark a project as completed')
  .argument('<projectId>', 'The ID of the project to mark as completed')
  .argument('<statusId>', 'The ID of the completed status')
  .action(async (projectId: string, statusId: string) => {
    const spinner = ora('Updating project status...').start();

    try {
      const client = getLinearClient();
      const success = await client.updateProjectStatus(projectId, statusId);

      if (success) {
        spinner.succeed(`Project ${projectId} marked as completed!`);
      } else {
        spinner.fail('Failed to update project status.');
      }

      process.exit(0);
    } catch (error) {
      handleError(error as Error, spinner);
    }
  });

linear
  .command('update-issue')
  .description('Update an issue status or description')
  .argument('<issueId>', 'The ID or identifier of the issue')
  .option('-s, --status <statusId>', 'The ID of the new status')
  .option('-d, --description <text>', 'New description')
  .action(async (issueId: string, options) => {
    const spinner = ora('Updating issue...').start();

    try {
      const client = getLinearClient();
      const success = await client.updateIssue(issueId, {
        stateId: options.status,
        description: options.description,
      });

      if (success) {
        spinner.succeed(`Issue ${issueId} updated!`);
      } else {
        spinner.fail('Failed to update issue.');
      }

      process.exit(0);
    } catch (error) {
      handleError(error as Error, spinner);
    }
  });

linear
  .command('create-issue')
  .description('Create a new Linear issue')
  .argument('<title>', 'Issue title')
  .option('-p, --project <projectId>', 'Project ID')
  .option('-d, --description <text>', 'Issue description')
  .option('-t, --team <teamId>', 'Team ID (defaults to LINEAR_TEAM_ID env)')
  .action(async (title: string, options) => {
    const spinner = ora('Creating issue...').start();

    try {
      const client = getLinearClient();
      const teamId = options.team || process.env.LINEAR_TEAM_ID;

      if (!teamId) {
        spinner.fail('Missing Team ID. Provide --team or set LINEAR_TEAM_ID in .env');
        process.exit(1);
      }

      const issue = await client.createIssue({
        title,
        description: options.description,
        projectId: options.project || process.env.LINEAR_PROJECT_ID,
        teamId,
      });

      spinner.succeed(`Issue created: [${issue.identifier}] ${issue.title}`);
      console.log(chalk.dim(`ID: ${issue.id}`));
      process.exit(0);
    } catch (error) {
      handleError(error as Error, spinner);
    }
  });

// Infrastructure & Utility Commands
program
  .command('detect')
  .description('Run network connectivity diagnostics')
  .action(async () => {
    const detective = new Detective();
    await detective.runReport();
    process.exit(0);
  });

program
  .command('slice')
  .description('Slice a markdown file into backlog items')
  .argument('<file>', 'Source markdown file')
  .option('-o, --output <dir>', 'Output directory', 'docs/backlog')
  .action(async (file, options) => {
    const slicer = new Slicer();
    const baseDir = path.join(__dirname, '..');
    const sourcePath = path.isAbsolute(file) ? file : path.join(baseDir, file);
    const outputDir = path.isAbsolute(options.output)
      ? options.output
      : path.join(baseDir, options.output);

    await slicer.slice(sourcePath, outputDir);
    process.exit(0);
  });

program
  .command('win-dominance')
  .description('Prioritize local tools in Windows User PATH (Registry)')
  .action(async () => {
    const win = new WindowsUtility();
    const toolsDir = path.join(__dirname, '..', '.tools');
    await win.recordGlobalPaths(toolsDir);
    process.exit(0);
  });

program
  .command('setup-tools')
  .description('Download and setup portable Node.js and PowerShell Core')
  .action(async () => {
    const setup = new SetupUtility(path.join(__dirname, '..'));
    await setup.setupAll();
    process.exit(0);
  });

program
  .command('shell')
  .description('Launch portable bypass shell')
  .action(async () => {
    if (process.platform !== 'win32') {
      console.log(chalk.yellow('[!] Shell command is currently only supported on Windows.'));
      process.exit(1);
    }
    const launcher = path.join(__dirname, '..', 'scripts', 'pwsh.bat');
    if (!fs.existsSync(launcher)) {
      console.log(chalk.red('[!] Shell launcher not found. Running setup...'));
      const setup = new SetupUtility(path.join(__dirname, '..'));
      await setup.setupAll();
    }

    console.log(chalk.cyan('[*] Launching Bifrost Shell...'));
    const { spawn } = require('child_process');
    spawn('cmd.exe', ['/c', launcher], { stdio: 'inherit', detached: true });
    process.exit(0);
  });

// Handle uncaught errors
process.on('unhandledRejection', (error: Error) => {
  logger.error('Unhandled rejection', error);
  console.error(chalk.red('Fatal Error:'), error.message);
  process.exit(2);
});

program.parse();
