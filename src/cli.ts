import { Command } from 'commander';
import chalk from 'chalk';
import { logger } from './utils/logger';
import { Detective } from './utils/detective';
import { Slicer } from './utils/slicer';
import { WindowsUtility } from './utils/windows';
import { RelicRepository } from './utils/setup';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { registerSeedCommand } from './commands/seed';
import { registerVerifyCommand } from './commands/verify';
import { registerBenchCommand } from './commands/bench';
import { registerLinearCommands } from './commands/linear';
import { registerPerplexityCommands } from './commands/perplexity';

// Load .env from root
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

// Auto-inject corporate certs if present
const certPath = path.join(__dirname, '../.certs/corporate_bundle.pem');
if (fs.existsSync(certPath)) {
  process.env.NODE_EXTRA_CA_CERTS = certPath;
}

const program = new Command();

program
  .name('bifrost')
  .description('Bifrost Bridge CLI Tool')
  .version('1.0.0')
  .option('-d, --direct', 'Bypass proxies and connect to APIs directly', false);

// Register grouped commands
registerPerplexityCommands(program);
registerLinearCommands(program);
registerSeedCommand(program);
registerVerifyCommand(program);
registerBenchCommand(program);

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
    const repository = new RelicRepository(path.join(__dirname, '..'));
    await repository.setupAll();
    process.exit(0);
  });

program
  .command('heal')
  .description('Self-heal the portable environment')
  .action(async () => {
    const repository = new RelicRepository(path.join(__dirname, '..'));
    await repository.heal();
    process.exit(0);
  });

program
  .command('verify-env')
  .description('Verify environment readiness (certs, env vars, tools)')
  .action(async () => {
    const { Verifier } = require('./utils/verifier');
    const verifier = new Verifier();
    const success = await verifier.verifyAll();
    process.exit(success ? 0 : 1);
  });

program
  .command('shell')
  .description('Launch portable bypass shell')
  .action(async () => {
    const isWin = process.platform === 'win32';
    const launcher = isWin 
      ? path.join(__dirname, '..', 'scripts', 'launchers', 'pwsh.bat')
      : path.join(__dirname, '..', 'scripts', 'launchers', 'crypt-shell.sh');

    if (!fs.existsSync(launcher)) {
      console.log(chalk.red('[!] Shell launcher not found. Running setup...'));
      const repository = new RelicRepository(path.join(__dirname, '..'));
      await repository.setupAll();
    }

    console.log(chalk.cyan('[*] Launching Crypt Shell...'));
    const { spawn } = require('child_process');
    if (isWin) {
      spawn('cmd.exe', ['/c', launcher], { stdio: 'inherit', detached: true });
    } else {
      spawn('sh', [launcher], { stdio: 'inherit' });
    }
    process.exit(0);
  });

// Handle uncaught errors
process.on('unhandledRejection', (error: Error) => {
  logger.error('Unhandled rejection', error);
  console.error(chalk.red('Fatal Error:'), error.message);
  process.exit(2);
});

program.parse();
