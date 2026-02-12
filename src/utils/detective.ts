import https from 'https';
import http from 'http';
import tls from 'tls';
import { URL } from 'url';
import chalk from 'chalk';

export interface DiagnosticResult {
  url: string;
  description: string;
  status: 'OK' | 'FAIL' | 'TIMEOUT' | 'ERROR';
  code?: number;
  duration?: number;
  error?: string;
}

export class Detective {
  private timeout = 5000;

  async checkUrl(url: string, description: string): Promise<DiagnosticResult> {
    const start = Date.now();
    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    return new Promise((resolve) => {
      const req = protocol.request(
        url,
        {
          method: 'HEAD',
          timeout: this.timeout,
          headers: {
            'User-Agent': 'Bifrost-Bridge-Detective/1.0',
          },
        },
        (res) => {
          resolve({
            url,
            description,
            status: 'OK',
            code: res.statusCode,
            duration: Date.now() - start,
          });
        },
      );

      req.on('error', (e: any) => {
        resolve({
          url,
          description,
          status: 'FAIL',
          error: e.message,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          url,
          description,
          status: 'TIMEOUT',
        });
      });

      req.end();
    });
  }

  async inspectSsl(
    hostname: string,
  ): Promise<{ organization?: string; commonName?: string; intercepted: boolean }> {
    return new Promise((resolve) => {
      const socket = tls.connect(443, hostname, { servername: hostname }, () => {
        const cert = socket.getPeerCertificate();
        socket.destroy();

        if (!cert || !cert.issuer) {
          resolve({ intercepted: false });
          return;
        }

        const org = cert.issuer.O;
        const cn = cert.issuer.CN;
        const isIntercepted =
          !!org &&
          !org.includes('Google') &&
          !org.includes('DigiCert') &&
          !org.includes("Let's Encrypt");

        resolve({
          organization: org,
          commonName: cn,
          intercepted: isIntercepted,
        });
      });

      socket.on('error', () => {
        resolve({ intercepted: false });
      });

      socket.setTimeout(this.timeout, () => {
        socket.destroy();
        resolve({ intercepted: false });
      });
    });
  }

  async runReport() {
    console.log(chalk.bold.magenta('\n=== Network Detective Report (TS) ==='));

    console.log(chalk.bold('\n[1] Proxy Configuration:'));
    console.log(`  HTTP_PROXY:  ${process.env.HTTP_PROXY || 'None'}`);
    console.log(`  HTTPS_PROXY: ${process.env.HTTPS_PROXY || 'None'}`);

    const services = [
      { url: 'https://www.google.com', desc: 'Internet' },
      { url: 'https://github.com', desc: 'GitHub' },
      { url: 'https://registry.npmjs.org', desc: 'NPM Registry' },
      { url: 'https://api.perplexity.ai', desc: 'Perplexity API' },
      { url: 'https://api.linear.app/graphql', desc: 'Linear API' },
      { url: 'https://workers.dev', desc: 'Workers.dev' },
    ];

    console.log(chalk.bold('\n[2] Connectivity:'));
    for (const service of services) {
      process.stdout.write(`  > Testing ${service.desc.padEnd(15)} (${service.url})... `);
      const result = await this.checkUrl(service.url, service.desc);

      if (result.status === 'OK') {
        console.log(chalk.green(`OK (${result.code}) - ${result.duration}ms`));
      } else {
        console.log(chalk.red(`${result.status}${result.error ? ` (${result.error})` : ''}`));
      }
    }

    console.log(chalk.bold('\n[3] SSL Inspection Check:'));
    process.stdout.write(`  > Inspecting SSL Issuer for google.com... `);
    const ssl = await this.inspectSsl('google.com');
    if (ssl.intercepted) {
      console.log(
        chalk.yellow(
          `INTERCEPTED (${ssl.organization || ssl.commonName}) - Corporate Proxy Detected`,
        ),
      );
    } else {
      console.log(
        chalk.cyan(`Standard (${ssl.organization || 'Unknown'}) - No visible interception`),
      );
    }

    console.log('\n' + '='.repeat(40) + '\n');
  }
}
