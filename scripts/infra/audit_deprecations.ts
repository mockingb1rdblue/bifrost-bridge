import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ANSI colors
const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const BOLD = '\x1b[1m';

function log(msg: string) {
    console.log(msg);
}

function error(msg: string) {
    console.log(`${RED}❌ ${msg}${RESET}`);
}

function warn(msg: string) {
    console.log(`${YELLOW}⚠️  ${msg}${RESET}`);
}

function success(msg: string) {
    console.log(`${GREEN}✅ ${msg}${RESET}`);
}

function checkNpmDependencies() {
    log(`\n${BOLD}🔍 Checking NPM Dependencies...${RESET}`);
    try {
        // Check for deprecated packages using npm audit
        log('Running npm audit...');
        // We ignore exit code because audit returns non-zero on findings
        try {
            execSync('npm audit --json', { stdio: 'pipe' });
            success('No vulnerabilities found.');
        } catch (e: any) {
            const auditOutput = JSON.parse(e.stdout.toString());
            const vulns = auditOutput.vulnerabilities || {};
            const count = Object.keys(vulns).length;
            if (count > 0) {
                warn(`Found ${count} vulnerabilities. Run 'npm audit' for details.`);
            } else {
                success('Audit passed (dependencies might be outdated but secure).');
            }
        }

        // Check for outdated packages
        log('Checking for outdated packages...');
        try {
            const outdated = execSync('npm outdated --json', { stdio: 'pipe' }).toString();
            const outdatedJson = JSON.parse(outdated);
            const count = Object.keys(outdatedJson).length;
            if (count > 0) {
                warn(`Found ${count} outdated packages:`);
                Object.keys(outdatedJson).forEach(pkg => {
                    const info = outdatedJson[pkg];
                    console.log(`   - ${pkg}: ${info.current} -> ${info.latest} (${info.type})`);
                });
            } else {
                success('All packages are up to date.');
            }
        } catch (e: any) {
            // npm outdated returns 1 if there are outdated packages
            if (e.stdout) {
                const outdatedJson = JSON.parse(e.stdout.toString());
                const count = Object.keys(outdatedJson).length;
                warn(`Found ${count} outdated packages. Run 'npm outdated' for details.`);
            }
        }

    } catch (err: any) {
        error(`Failed to check npm dependencies: ${err.message}`);
    }
}

function checkCloudflareCompatibility() {
    log(`\n${BOLD}☁️  Checking Cloudflare Compatibility Dates...${RESET}`);

    // Find all wrangler.toml files
    const findTomls = (dir: string): string[] => {
        let results: string[] = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
                if (file !== 'node_modules' && file !== '.git') {
                    results = results.concat(findTomls(filePath));
                }
            } else {
                if (file === 'wrangler.toml') {
                    results.push(filePath);
                }
            }
        });
        return results;
    };

    const tomls = findTomls(process.cwd());

    tomls.forEach(tomlPath => {
        const content = fs.readFileSync(tomlPath, 'utf-8');
        const match = content.match(/compatibility_date\s*=\s*["'](\d{4}-\d{2}-\d{2})["']/);

        const relPath = path.relative(process.cwd(), tomlPath);

        if (match) {
            const dateStr = match[1];
            const date = new Date(dateStr);
            const today = new Date();
            const diffTime = Math.abs(today.getTime() - date.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 90) {
                warn(`${relPath}: Compatibility date ${dateStr} is ${diffDays} days old.`);
            } else {
                success(`${relPath}: Compatibility date ${dateStr} is recent.`);
            }
        } else {
            warn(`${relPath}: No compatibility_date found.`);
        }
    });
}

function checkGithubActions() {
    log(`\n${BOLD}🐙 Checking GitHub Actions Runners...${RESET}`);
    const workflowsDir = path.join(process.cwd(), '.github', 'workflows');

    if (!fs.existsSync(workflowsDir)) {
        log('No .github/workflows directory found.');
        return;
    }

    const files = fs.readdirSync(workflowsDir);
    let issuesFound = false;

    files.forEach(file => {
        if (!file.endsWith('.yml') && !file.endsWith('.yaml')) return;

        const content = fs.readFileSync(path.join(workflowsDir, file), 'utf-8');

        // Check for deprecated node versions
        const nodeMatch = content.match(/node-version:\s*['"]?(12|14|16)['"]?/);
        if (nodeMatch) {
            warn(`${file}: Uses deprecated Node.js version ${nodeMatch[1]}. Upgrade to 18 or 20.`);
            issuesFound = true;
        }

        // Check for deprecated runs-on images
        const runnerMatch = content.match(/runs-on:\s*['"]?(ubuntu-18\.04|macos-11)['"]?/);
        if (runnerMatch) {
            warn(`${file}: Uses deprecated runner ${runnerMatch[1]}. Upgrade to ubuntu-latest or check availability.`);
            issuesFound = true;
        }
    });

    if (!issuesFound) {
        success('GitHub Actions workflows appear to use modern runners.');
    }
}

async function main() {
    console.log(`${BOLD}🏰 The Watchtower: Deprecation Audit System${RESET}`);
    console.log('==============================================');

    checkNpmDependencies();
    checkCloudflareCompatibility();
    checkGithubActions();

    console.log(`\n${BOLD}Audit Complete.${RESET}`);
}

main().catch(console.error);
