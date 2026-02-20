import { Job, JobHandler, JobResult } from '../agent';
import { LLMClient, LLMMessage } from '../llm-client';
import { promises as fs } from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class CodingHandler implements JobHandler {
    type = 'coding';
    private llmClient: LLMClient;

    constructor(routerUrl: string, apiKey: string) {
        this.llmClient = new LLMClient(routerUrl, apiKey);
    }

    async execute(job: Job): Promise<JobResult> {
        const { title, description, files, metadata, repository } = job.payload;
        console.log(`[CodingHandler] Processing task: ${title}`);

        let workDir = process.cwd();
        let isGitRepo = false;
        let engineeringLog = ''; // Initialize here scope-wide
        let prDetails: { number: number, url: string } | undefined;

        try {
            // 0. Git Setup (if repository provided)
            if (repository && repository.token) {
                const repoName = repository.name;
                const repoOwner = repository.owner;
                const token = repository.token;
                const branchMatch = description.match(/branch (feat\/[\w-]+)/);
                const branchName = branchMatch ? branchMatch[1] : `feat/swarm-${job.id}`;

                workDir = path.join(process.cwd(), 'workspace', repoName);
                isGitRepo = true;

                console.log(`[CodingHandler] Setting up Git workspace at ${workDir}`);

                // Cleanup existing
                let repoExists = false;
                try {
                    await fs.access(path.join(workDir, '.git'));
                    repoExists = true;
                } catch { }

                if (repoExists) {
                    console.log(`[CodingHandler] Updating existing repository at ${workDir}`);
                    // Fetch and Reset to ensure we are 1:1 with remote
                    await execAsync(`git fetch origin`, { cwd: workDir });
                    await execAsync(`git reset --hard origin/${branchName.replace('feat/', '')}`, { cwd: workDir }).catch(async () => {
                        // Fallback if branch doesn't exist remotely yet? Or maybe we are on master?
                        // Actually, we should probably fetch everything and check out the target branch.
                        // If we are creating a NEW branch, we should look for base (master/main)
                        await execAsync(`git checkout master`, { cwd: workDir }).catch(() => execAsync(`git checkout main`, { cwd: workDir }));
                        await execAsync(`git pull`, { cwd: workDir });
                    });
                } else {
                    await fs.rm(workDir, { recursive: true, force: true }).catch(() => { });
                    await fs.mkdir(workDir, { recursive: true });

                    // Clone
                    const cloneUrl = `https://x-access-token:${token}@github.com/${repoOwner}/${repoName}.git`;
                    await execAsync(`git clone ${cloneUrl} .`, { cwd: workDir });
                }

                // Config
                await execAsync(`git config user.name "Sluagh Swarm"`, { cwd: workDir });
                await execAsync(`git config user.email "swarm@bifrost.bridge"`, { cwd: workDir });

                // Checkout
                try {
                    await execAsync(`git checkout ${branchName}`, { cwd: workDir });
                } catch (e) {
                    // Create if not exists
                    await execAsync(`git checkout -b ${branchName}`, { cwd: workDir });
                }
                console.log(`[CodingHandler] Checked out ${branchName}`);
            }

            // 1. Read context files
            const fileContents: string[] = [];
            // If git repo, resolve files relative to workDir
            const filePaths = (files || []).map((f: string) => isGitRepo ? path.join(workDir, f) : f);

            for (const filePath of filePaths) {
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    fileContents.push(`File: ${isGitRepo ? path.relative(workDir, filePath) : filePath}\n\`\`\`\n${content}\n\`\`\``);
                } catch (e) {
                    console.warn(`[CodingHandler] Could not read file ${filePath}:`, e);
                }
            }

            // 2. Construct Prompt
            const systemPrompt: LLMMessage = {
                role: 'system',
                content: `You are an expert autonomous software engineer.
Your task is to implement the requested changes based on the description and provided files.
You MUST output your changes in a structured XML format:
<file path="path/to/file.ts">
... new content ...
</file>

If you are modifying a file, provide the FULL new content of the file.
Do not output any markdown code blocks wrapping the XML tags.
`
            };

            const userPrompt: LLMMessage = {
                role: 'user',
                content: `Task: ${title}
Description: ${description}

Context Files:
${fileContents.join('\n\n')}

Implement the changes now.`
            };

            // 3. Call LLM
            console.log(`[CodingHandler] Consulting Brain...`);
            const response = await this.llmClient.chat([systemPrompt, userPrompt], 'coding');

            // 4. Parse and Apply Changes
            console.log(`[CodingHandler] Applying changes...`);
            const fileMatches = response.matchAll(/<file path="([^"]+)">([\s\S]*?)<\/file>/g);
            let changesApplied = 0;

            for (const match of fileMatches) {
                const targetPathRelative = match[1];
                const targetPath = isGitRepo ? path.join(workDir, targetPathRelative) : targetPathRelative;
                const newContent = match[2].trim();

                await fs.mkdir(path.dirname(targetPath), { recursive: true });
                await fs.writeFile(targetPath, newContent, 'utf-8');
                console.log(`[CodingHandler] Wrote to ${targetPath}`);
                changesApplied++;
            }

            if (changesApplied === 0) {
                return {
                    success: false,
                    error: 'No file changes detected in LLM response. Response: ' + response.substring(0, 100) + '...'
                };
            }

            engineeringLog = `Applied changes to ${changesApplied} files using autonomous coding agent.`;

            // 5. Git Commit & Push
            if (isGitRepo) {
                console.log(`[CodingHandler] Committing changes...`);
                await execAsync(`git add .`, { cwd: workDir });
                await execAsync(`git commit -m "feat: executed swarm task ${title}"`, { cwd: workDir });
                await execAsync(`git push origin HEAD`, { cwd: workDir });
                console.log(`[CodingHandler] Pushed changes.`);
                engineeringLog += ' Pushed to GitHub.';

                // 6. Create Pull Request
                if (repository && repository.token) {
                    const branchMatch = description.match(/branch (feat\/[\w-]+)/);
                    const branchName = branchMatch ? branchMatch[1] : `feat/swarm-${job.id}`;
                    try {
                        prDetails = await this.createPullRequest(repository.owner, repository.name, repository.token, branchName, title, description);
                        console.log(`[CodingHandler] Created PR #${prDetails.number}: ${prDetails.url}`);

                        // Append PR URL to the engineering log
                        engineeringLog += `\nPull Request Created: ${prDetails.url} (#${prDetails.number})`;
                    } catch (e: any) {
                        console.error(`[CodingHandler] Failed to create PR:`, e.message);
                        if (e.message !== 'PR already exists') {
                            engineeringLog += `\nFailed to create PR: ${e.message}`;
                        }
                    }
                }
            }

            return {
                success: true,
                data: {
                    status: 'Changes applied',
                    filesChanged: changesApplied,
                    engineeringLog: engineeringLog,
                    prNumber: prDetails?.number,
                    prUrl: prDetails?.url
                }
            };

        } catch (e: any) {
            console.error('[CodingHandler] Execution failed:', e);
            return { success: false, error: e.message };
        }
    }

    private async createPullRequest(owner: string, repo: string, token: string, head: string, title: string, body: string): Promise<{ number: number, url: string }> {
        console.log(`[CodingHandler] Creating PR for ${head} on ${owner}/${repo}`);

        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'Sluagh-Swarm-Worker'
            },
            body: JSON.stringify({
                title: `[Swarm] ${title}`,
                body: `## Swarm Task Execution\n\n${body}\n\nAutomated PR created by Sluagh Swarm Worker Bee.`,
                head: head,
                base: 'hee-haw' // The one true target branch
            })
        });

        if (!response.ok) {
            const text = await response.text();
            // check if PR already exists
            if (text.includes('A pull request already exists')) {
                console.log('[CodingHandler] PR already exists.');
                // Try to find the existing PR
                // For now, just throw/return special indicator, or we could fetch it.
                // Let's just throw for now to keep it simple as the catch block handles it, 
                // but ideally we should fetch the existing PR to return its number.
                throw new Error('PR already exists');
            }
            throw new Error(`GitHub API Error (${response.status}): ${text}`);
        }

        const data = await response.json() as any;
        return { number: data.number, url: data.html_url };
    }
}
