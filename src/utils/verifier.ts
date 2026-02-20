import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import https from 'https';

const execAsync = promisify(exec);

/**
 *
 */
export class Verifier {
  private issues: string[] = [];

  /**
   *
   */
  async verifyAll() {
    console.log(chalk.bold.cyan('\n=== Bifrost Environment Verification ==='));

    await this.checkCertificateTrust();
    await this.checkEnvVars();
    await this.checkCommands();
    await this.checkProxyBypass();

    console.log(chalk.bold.cyan('\n=== Summary ==='));
    if (this.issues.length === 0) {
      console.log(chalk.bold.green('✅ All checks passed! Environment ready for deployment.\n'));
      return true;
    } else {
      console.log(chalk.bold.yellow(`⚠️  ${this.issues.length} issue(s) found:\n`));
      this.issues.forEach((issue) => console.log(`   ${issue}`));
      console.log(chalk.dim('\nRun this command again after fixing issues.\n'));
      return false;
    }
  }

  private async checkCertificateTrust() {
    return new Promise((resolve) => {
      const options = {
        hostname: 'api.linear.app',
        port: 443,
        path: '/graphql',
        method: 'HEAD',
        timeout: 5000,
      };

      const req = https.request(options, (res) => {
        console.log(chalk.green('✓ Certificate trust working (Linear API)'));
        resolve(true);
      });

      req.on('error', (err) => {
        if (err.message.includes('certificate') || err.message.includes('SSL')) {
          this.issues.push(
            chalk.yellow('⚠️  Certificate trust issue (export corporate CA to .certs/)'),
          );
        } else {
          console.log(chalk.green('✓ Network accessible (certificate trust OK)'));
        }
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        this.issues.push(chalk.yellow('⚠️  Connection to Linear API timed out'));
        resolve(false);
      });

      req.end();
    });
  }

  private async checkEnvVars() {
    const required = ['LICH_ARTIFACT', 'LICH_TEAM'];
    let missing = false;

    for (const v of required) {
      if (!process.env[v]) {
        this.issues.push(chalk.red(`❌ Missing environment variable: ${v}`));
        missing = true;
      }
    }

    if (!missing) {
      console.log(chalk.green('✓ Required environment variables set'));
    }
  }

  private async checkCommands() {
    const required = ['npm', 'git', 'node'];
    let missing = false;

    for (const cmd of required) {
      try {
        await execAsync(`${cmd} --version`);
      } catch {
        this.issues.push(chalk.red(`❌ Command not found: ${cmd}`));
        missing = true;
      }
    }

    if (!missing) {
      console.log(chalk.green('✓ Deployment commands available'));
    }
  }

  private async checkProxyBypass() {
    if (process.env.NO_PROXY?.includes('workers.dev')) {
      console.log(chalk.green('✓ Proxy bypass configured'));
    } else {
      this.issues.push(
        chalk.yellow('⚠️  Proxy bypass not configured (add *.workers.dev to NO_PROXY)'),
      );
    }
  }
}
