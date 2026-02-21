import { RouterConfig } from './config';
import { RouterDependencies } from './dependencies';
import { RouterStateManager } from './state';
import { Job, EngineeringLog } from '../types';
import { GitHubClient } from '../github';
import { RoutingRequest } from '../llm/router';
import { LLMResponse } from '../llm/types';

/**
 * OrchestrationProcessor: Handles complex multi-step jobs like planning and optimization.
 */
export class OrchestrationProcessor {
  constructor(
    private config: RouterConfig,
    private deps: RouterDependencies,
    private stateManager: RouterStateManager,
    private routeLLM: (params: RoutingRequest) => Promise<LLMResponse>
  ) {}

  async processOrchestrationJob(job: Job) {
    try {
      await this.checkGovernance('orchestrator');

      let github: GitHubClient | null = null;
      if (this.config.github.appId && this.config.github.privateKey && this.config.github.installationId) {
        github = this.deps.github;
      }

      if (job.payload.action === 'initialize_and_plan' || job.payload.action === 'initialize_workspace') {
        await this.handleWorkspaceInitialization(job, github);
      } else if (job.payload.action === 'optimization_review') {
        await this.handleOptimizationReview(job);
      } else {
        job.status = 'failed';
        job.error = 'Unknown orchestration action';
      }
    } catch (e: any) {
      console.error(`[OrchestrationProcessor] Failure for job ${job.id}:`, e.message);
      await this.stateManager.logError({
        message: e.message,
        context: `ORCHESTRATION_FAILURE: ${job.id}`,
        timestamp: Date.now(),
        stack: e.stack
      });
      job.status = 'failed';
      job.error = e.message;
    }
  }

  private async handleWorkspaceInitialization(job: Job, github: GitHubClient | null) {
    const { issueIdentifier, issueTitle, issueId, description } = job.payload;
    const slug = issueTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const branchName = `feat/${issueIdentifier}-${slug}`;
    const repo = 'bifrost-bridge';
    const owner = 'mockingb1rdblue';

    let branchResult = 'Skipped (no GitHub creds)';
    if (github) {
      try {
        await github.createBranch(owner, repo, 'master', branchName);
        branchResult = 'Created';
      } catch (e: any) {
        if (e.message.includes('Reference already exists')) branchResult = 'Existing';
        else throw e;
      }
    }

    let plan = '';
    if (job.payload.action === 'initialize_and_plan') {
      const prompt = `Task: ${issueTitle}\nDescription: ${description}\n\nGenerate a technical implementation plan for this task. Focus on files to modify and the logic changes. Keep it concise.`;
      const planRes = await this.routeLLM({
        messages: [{ role: 'user', content: prompt }],
        taskType: 'planning',
      });
      plan = planRes.content;
    }

    const engineeringLog: EngineeringLog = {
      taskId: job.id,
      whatWasDone: `Initialized workspace (\`${branchResult}\`) and generated initial implementation plan.`,
      diff: `+ Refs: refs/heads/${branchName}\n+ Base: refs/heads/master`,
      whatWorked: [`Created/Verified GitHub branch ${branchName}`, `Generated technical plan`],
      whatDidntWork: [],
      lessonsLearned: ['Parallelized workspace and planning speeds up agent onboarding.'],
    };

    await this.deps.linear.addComment(issueId, `🚀 **Workspace Initialized**\n\n${this.formatEngineeringLog(engineeringLog)}${plan ? `\n\n### 📋 Implementation Plan\n${plan}` : ''}`);

    if (job.payload.action === 'initialize_and_plan') {
      const token = github ? await github.getAccessToken() : undefined;
      await this.stateManager.saveTask({
        id: `task_${Date.now()}`,
        type: 'coding',
        title: issueTitle,
        description: `Generated Plan:\n${plan}\n\nObjective: Execute the plan on branch ${branchName}.`,
        files: [],
        status: 'pending',
        priority: job.priority,
        isHighRisk: job.payload.metadata?.RiskProfile === 'high',
        issueId: issueId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        repository: { owner, name: repo, token },
      });
    }

    job.status = 'completed';
    job.result = { branch: branchName, plan };
  }

  private async handleOptimizationReview(job: Job) {
    const { metrics, recentErrors } = job.payload;
    const prompt = `Task: Self-Optimization Review\nPerformance Metrics: ${JSON.stringify(metrics)}\nRecent Errors: ${JSON.stringify(recentErrors)}\n\nAnalyze the data and suggest 3 concrete improvements.`;

    const analysisRes = await this.routeLLM({
      messages: [
        { role: 'system', content: 'You are the Sluagh Swarm Optimization Engine.' },
        { role: 'user', content: prompt + '\n\nPlease provide a section titled "OPTIMIZED_PROMPT" containing a refined system prompt.' },
      ],
      taskType: 'planning',
    });

    const optimizedPromptMatch = analysisRes.content.match(/OPTIMIZED_PROMPT\n+([\s\S]+)$|^OPTIMIZED_PROMPT[:\s]+([\s\S]+)$|OPTIMIZED_PROMPT[:]\s*([\s\S]+)/i);
    const optimizedPrompt = (optimizedPromptMatch?.[1] || optimizedPromptMatch?.[2] || optimizedPromptMatch?.[3] || '').trim();

    if (optimizedPrompt) {
      await this.deps.events.append({
        type: 'PROMPT_OPTIMIZED',
        source: 'custom-router',
        topic: 'global-optimization',
        payload: { optimizedPrompt_planning: optimizedPrompt },
      });
    }

    job.status = 'completed';
    job.result = { analysis: analysisRes.content };
  }

  private formatEngineeringLog(log: EngineeringLog): string {
    return `### What Was Done\n${log.whatWasDone}\n\n### Diff\n\`\`\`diff\n${log.diff}\n\`\`\`\n\n### ✅ What Worked\n${log.whatWorked.map((w) => `- ${w}`).join('\n')}\n\n### ❌ What Didn't Work\n${log.whatDidntWork.map((w) => `- ${w}`).join('\n')}\n\n### 💡 Lessons Learned\n${log.lessonsLearned.map((l) => `- ${l}`).join('\n')}`.trim();
  }

  private async checkGovernance(agentId: string = 'global') {
    if (this.config.GOVERNANCE_DO) {
      const id = this.config.GOVERNANCE_DO.idFromName('guard-dog');
      const stub = this.config.GOVERNANCE_DO.get(id);
      const govRes = await stub.fetch(`http://governance/check?agent=${agentId}`);
      if (govRes.status === 429) {
        const body = (await govRes.json()) as any;
        throw new Error(`Governance Blocked: ${body.reason}`);
      }
    }
  }
}
