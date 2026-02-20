
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { PerplexityClient } from '../../src/perplexity-client';
import { logger } from '../../src/utils/logger';

// Load .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const apiKey = process.env.PERPLEXITY_API_KEY;
const isOffline = !apiKey;

if (isOffline) {
    console.log('⚠️  No PERPLEXITY_API_KEY found. Running in Offline Secret Scan Mode.');
}

const client = apiKey ? new PerplexityClient(apiKey) : null;

// Directories to audit
const TARGETS = [
    { name: 'Root Configs', path: '.', files: ['package.json', 'tsconfig.json', 'wrangler.toml', '.gitignore', 'README.md', 'LICENSE', 'eslint.config.js'] },
    { name: 'Scripts', path: 'scripts', recursive: true },
    { name: 'Workers', path: 'workers', recursive: true, depth: 2 }, // Audit each worker
    { name: 'Docs', path: 'docs', recursive: false, files: ['OPERATIONAL_MANUAL.md', 'SYSTEM_ARCHITECTURE.md'] }
];

async function getFileContent(filePath: string): Promise<string> {
    try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const content = fs.readFileSync(filePath, 'utf-8');
            // Limit content to 1000 chars to avoid massive context
            return content.slice(0, 1000) + (content.length > 1000 ? '\n...(truncated)...' : '');
        }
        return '';
    } catch (e) {
        return '';
    }
}

// Simple regex for secrets
const SECRET_PATTERNS = [
    /FALLBACK_KEY\s*=\s*['"][^'"]+['"]/,
    /API_KEY\s*=\s*['"][^'"]+['"]/,
    /SECRET\s*=\s*['"][^'"]+['"]/,
    /password\s*=\s*['"][^'"]+['"]/,
    /private_key\s*=\s*['"][^'"]+['"]/i,
    /Authorization:\s*['"]Bearer\s+[a-zA-Z0-9_\-\.]+['"]/
];

function scanContentForSecrets(content: string, filePath: string): string[] {
    const findings: string[] = [];
    SECRET_PATTERNS.forEach(regex => {
        if (regex.test(content)) {
            findings.push(`Potential Secret in ${filePath}: ${regex.source}`);
        }
    });
    return findings;
}

async function scanDirectory(dirPath: string, depth: number = 1, checkSecrets = false): Promise<{ context: string, secrets: string[] }> {
    let output = `Directory: ${dirPath}\n`;
    let allSecrets: string[] = [];

    try {
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            if (item === 'node_modules' || item.startsWith('.') || item === 'dist' || item === 'logs') continue;

            if (fs.statSync(fullPath).isDirectory()) {
                if (depth > 0) {
                    const result = await scanDirectory(fullPath, depth - 1, checkSecrets);
                    output += result.context;
                    allSecrets.push(...result.secrets);
                } else {
                    output += `[Dir] ${item}\n`;
                }
            } else {
                output += `[File] ${item}\n`;
                // Add content for key files only
                if (item.endsWith('.ts') || item.endsWith('.js') || item.endsWith('.toml') || item.endsWith('.md')) {
                    const content = await getFileContent(fullPath);
                    output += `--- Start ${item} ---\n${content}\n--- End ${item} ---\n`;

                    if (checkSecrets) {
                        const fileSecrets = scanContentForSecrets(fs.readFileSync(fullPath, 'utf-8'), fullPath);
                        allSecrets.push(...fileSecrets);
                    }
                }
            }
        }
    } catch (e) {
        // ignore
    }
    return { context: output, secrets: allSecrets };
}

async function auditTarget(target: any) {
    console.log(`Auditing: ${target.name}...`);
    let context = '';
    let secrets: string[] = [];

    if (target.files) {
        for (const file of target.files) {
            const fullPath = path.join(process.cwd(), target.path, file);
            if (fs.existsSync(fullPath)) {
                const fileContent = await getFileContent(fullPath);
                context += `File: ${file}\n` + fileContent + '\n';
                if (isOffline) {
                    secrets.push(...scanContentForSecrets(fs.readFileSync(fullPath, 'utf-8'), fullPath));
                }
            }
        }
    } else {
        const result = await scanDirectory(path.join(process.cwd(), target.path), target.recursive ? 2 : 1, isOffline);
        context = result.context;
        secrets = result.secrets;
    }

    if (secrets.length > 0) {
        console.error(`🚨 SECRETS FOUND IN ${target.name}:`);
        secrets.forEach(s => console.error(`  - ${s}`));
        process.exit(1);
    } else if (isOffline) {
        console.log(`✅ No secrets found in ${target.name}`);
    }

    if (isOffline) return;

    // Strict 9000 char limit to leave room for prompt wrapper
    const MAX_CONTEXT_LENGTH = 9000;
    if (context.length > MAX_CONTEXT_LENGTH) {
        context = context.slice(0, MAX_CONTEXT_LENGTH) + '\n...[System Truncated due to API Limits]...';
    }

    const prompt = `
    You are a Senior Principal Engineer auditing a codebase.
    Analyze the following code context for:
    1. Technical Debt (Legacy patterns, poor practices).
    2. Hardening (Security, error handling, strict types).
    3. Efficiency (Performance, logical simplifications).
    4. Compliance (Adherence to "Zero Secrets", strict TS config).

    Context for component "${target.name}":
    ${context}
    
    Output a Markdown report with sections: "Critical Issues", "Improvements", "Refactoring Plan".
    `;

    try {
        if (!client) return;
        const response = await client.research(prompt);
        // Ensure directory exists
        const reportDir = path.join(process.cwd(), 'docs', 'audit');
        if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

        const reportPath = path.join(reportDir, `${target.name.replace(/\s+/g, '_')}.md`);
        fs.writeFileSync(reportPath, response.choices[0].message.content);
        console.log(`Report saved to ${reportPath}`);
    } catch (e) {
        console.error(`Failed to audit ${target.name}`, e);
    }
}

async function main() {
    // Audit Root
    await auditTarget(TARGETS[0]);

    // Audit Scripts
    await auditTarget(TARGETS[1]);

    // Audit Workers (Iterate each subfolder)
    const workersDir = path.join(process.cwd(), 'workers');
    if (fs.existsSync(workersDir)) {
        const workers = fs.readdirSync(workersDir).filter(f => fs.statSync(path.join(workersDir, f)).isDirectory());
        for (const worker of workers) {
            await auditTarget({ name: `Worker-${worker}`, path: `workers/${worker}`, recursive: true });
        }
    }

    // Audit Docs (High level)
    await auditTarget(TARGETS[3]);
}

main();
