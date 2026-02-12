/// <reference types="@cloudflare/workers-types" />

import { Job, RouterState, JulesTask, EngineeringLog } from './types';
import { LinearClient } from './linear';
import { GitHubClient } from './github';
import {
  JobPayloadSchema,
  JulesTaskSchema,
  JulesTaskUpdateSchema,
  GitHubActionSchema,
  LinearWebhookSchema,
  JobUpdateSchema,
} from './schemas';
import { LLMRouter } from './llm/router';

export class RouterDO {
  private state: DurableObjectState;
  private env: any;
  private storage: RouterState = {
    jobs: {},
    julesTasks: {},
    rateLimits: {},
    metrics: {
      totalRequests: 0,
      tokensConsumed: 0,
      errorCount: 0,
      startTime: Date.now(),
    },
    recentErrors: [],
    lastMaintenance: Date.now(),
  };
  private llm: LLMRouter;
  private readonly BATCH_SIZE = 10;

  // ... (skipping unchanged lines)

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;

    // Restore state from storage
    this.state.blockConcurrencyWhile(async () => {
      const stored = await this.state.storage.get<RouterState>('router_state');
      if (stored) {
        this.storage = {
          ...this.storage,
          ...stored,
          rateLimits: stored.rateLimits || {},
          metrics: stored.metrics || this.storage.metrics,
          recentErrors: stored.recentErrors || [],
        };
      }
    });

    this.llm = new LLMRouter({
      deepseekKey: this.env.DEEPSEEK_API_KEY,
      anthropicKey: this.env.ANTHROPIC_API_KEY,
      geminiKey: this.env.GEMINI_API_KEY,
      perplexityKey: this.env.PERPLEXITY_API_KEY,
    });
  }

  private checkConfig(): Response | null {
    const required = [
      'PROXY_API_KEY',
      'LINEAR_API_KEY',
      'LINEAR_TEAM_ID',
      'GITHUB_APP_ID',
      'GITHUB_PRIVATE_KEY',
      'GITHUB_INSTALLATION_ID',
      'DEEPSEEK_API_KEY',
      'ANTHROPIC_API_KEY',
      'GEMINI_API_KEY',
      'PERPLEXITY_API_KEY',
    ];
    const missing = required.filter((k) => !this.env[k as keyof Env]);

    if (missing.length > 0) {
      const msg = `Configuration Error: Missing secrets [${missing.join(', ')}]`;
      console.error(msg);
      return new Response(msg, { status: 503 });
    }
    return null;
  }

  private async logError(message: string, context: string, error?: any) {
    console.error(`[${context}] ${message}`, error);
    this.storage.metrics.errorCount++;
    this.storage.recentErrors.unshift({
      timestamp: Date.now(),
      message,
      context,
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Cap at 50 errors
    if (this.storage.recentErrors.length > 50) {
      this.storage.recentErrors.pop();
    }
    await this.saveState();
  }

  private calculateHealthScore(): number {
    const pendingJobs = Object.values(this.storage.jobs).filter(
      (j) => j.status === 'pending',
    ).length;
    const threshold = parseInt(this.env.RATE_LIMIT_DEGRADATION_THRESHOLD || '50');

    if (pendingJobs < threshold) return 1.0; // Healthy
    if (pendingJobs < threshold * 2) return 0.5; // Stressed
    return 0.1; // Critical
  }

  private checkRateLimit(key: string): boolean {
    const now = Date.now();
    let limitState = this.storage.rateLimits[key];

    const maxTokens = parseInt(this.env.RATE_LIMIT_MAX_TOKENS || '100');
    const baseRefillRate = parseInt(this.env.RATE_LIMIT_REFILL_RATE || '1');

    // Apply Dynamic Health Score
    const healthScore = this.calculateHealthScore();
    const effectiveRefillRate = baseRefillRate * healthScore;

    if (!limitState) {
      limitState = {
        tokens: maxTokens,
        lastRefill: now,
      };
      this.storage.rateLimits[key] = limitState;
    }

    // Refill tokens
    const timePassed = (now - limitState.lastRefill) / 1000; // seconds
    const newTokens = timePassed * effectiveRefillRate;

    limitState.tokens = Math.min(maxTokens, limitState.tokens + newTokens);
    limitState.lastRefill = now;

    // Consume token
    if (limitState.tokens >= 1) {
      limitState.tokens -= 1;
      this.storage.metrics.tokensConsumed++;
      return true;
    }

    return false;
  }

  private async handleV2Chat(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { messages, options, taskType, preferredProvider } = body as any;

      if (!messages || !Array.isArray(messages)) {
        return new Response('Missing or invalid messages', { status: 400 });
      }

      const result = await this.llm.route({
        messages,
        options,
        taskType,
        preferredProvider,
      });

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      await this.logError(e.message, 'V2_CHAT_FAILURE', e);
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  private async getJulesNextTask(): Promise<Response> {
    const nextTask = Object.values(this.storage.julesTasks)
      .filter((t) => t.status === 'pending')
      .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)[0];

    if (!nextTask) {
      return new Response(JSON.stringify({ message: 'No tasks available' }), { status: 404 });
    }

    nextTask.status = 'active';
    nextTask.updatedAt = Date.now();
    await this.saveState();

    return new Response(JSON.stringify(nextTask), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async updateJulesTask(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const result = JulesTaskUpdateSchema.safeParse(body);

      if (!result.success) {
        return new Response('Invalid task update payload: ' + result.error.message, {
          status: 400,
        });
      }

      const { taskId, status, engineeringLog } = result.data;

      const task = this.storage.julesTasks[taskId];
      if (!task) {
        return new Response('Task not found', { status: 404 });
      }

      task.status = status as JulesTask['status'];
      if (engineeringLog) {
        task.engineeringLog = engineeringLog;
      }
      task.updatedAt = Date.now();

      await this.saveState();

      // If completed or failed, post to Linear
      if (status === 'completed' || status === 'failed') {
        try {
          const linear = new LinearClient({
            apiKey: this.env.LINEAR_API_KEY,
            teamId: this.env.LINEAR_TEAM_ID,
          });
          const logBody = task.engineeringLog
            ? this.formatEngineeringLog(task.engineeringLog)
            : `Task ${status}`;
          await linear.addComment(task.issueId, `🤖 Jules: Task ${status}\n\n${logBody}`);
        } catch (e: any) {
          console.error('Failed to post comment to Linear:', e.message);
          // Don't fail the internal update
        }
      }

      return new Response('OK');
    } catch (e: any) {
      console.error('updateJulesTask error:', e);
      return new Response('Invalid JSON (updateJulesTask): ' + e.message, { status: 400 });
    }
  }

  private async handleGitHubAction(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const validation = GitHubActionSchema.safeParse(body);

      if (!validation.success) {
        return new Response('Invalid GitHub Action payload: ' + validation.error.message, {
          status: 400,
        });
      }

      const { action, owner, repo, number, content } = validation.data;

      // Initialize GitHub Client
      // Note: We need to handle cases where secrets might be missing during initial setup
      if (
        !this.env.GITHUB_APP_ID ||
        !this.env.GITHUB_PRIVATE_KEY ||
        !this.env.GITHUB_INSTALLATION_ID
      ) {
        return new Response('GitHub secrets not configured', { status: 503 });
      }

      const github = new GitHubClient({
        appId: this.env.GITHUB_APP_ID,
        privateKey: this.env.GITHUB_PRIVATE_KEY,
        installationId: this.env.GITHUB_INSTALLATION_ID,
      });

      let result;
      switch (action) {
        case 'get_pr':
          if (!number) return new Response('Missing PR number', { status: 400 });
          result = await github.getPullRequest(owner, repo, number);
          break;
        case 'review':
          if (!number || !content?.body || !content?.event)
            return new Response('Missing review content', { status: 400 });
          result = await github.createReviewComment(
            owner,
            repo,
            number,
            content.body,
            content.event,
          );
          break;
        case 'comment':
          if (!number || !content?.body)
            return new Response('Missing comment body', { status: 400 });
          result = await github.addIssueComment(owner, repo, number, content.body);
          break;
        case 'create_pr':
          if (!content?.title || !content?.body || !content?.head || !content?.base)
            return new Response('Missing PR details', { status: 400 });
          result = await github.createPullRequest(
            owner,
            repo,
            content.title,
            content.body,
            content.head,
            content.base,
          );
          break;
        case 'merge':
          if (!number || !content?.method)
            return new Response('Missing merge method', { status: 400 });
          result = await github.mergePullRequest(owner, repo, number, content.method);
          break;
        default:
          return new Response('Invalid action', { status: 400 });
      }

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
  }

  private formatEngineeringLog(log: EngineeringLog): string {
    return `
### What Was Done
${log.whatWasDone}

### Diff
\`\`\`diff
${log.diff}
\`\`\`

### ✅ What Worked
${log.whatWorked.map((w) => `- ${w}`).join('\n')}

### ❌ What Didn't Work
${log.whatDidntWork.map((w) => `- ${w}`).join('\n')}

### 💡 Lessons Learned
${log.lessonsLearned.map((l) => `- ${l}`).join('\n')}
        `.trim();
  }

  private async createJob(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const result = JobPayloadSchema.safeParse(body);
      if (!result.success) {
        return new Response('Invalid job payload: ' + result.error.message, { status: 400 });
      }
      const payload = result.data;

      const jobId = crypto.randomUUID();
      const now = Date.now();

      const newJob: Job = {
        id: jobId,
        type: payload.type as Job['type'],
        status: 'pending',
        priority: payload.priority || 0,
        payload: payload.data,
        createdAt: now,
        updatedAt: now,
      };

      this.storage.jobs[jobId] = newJob;
      await this.saveState();

      return new Response(JSON.stringify(newJob), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      await this.logError(e.message, 'CREATE_JOB', e);
      return new Response('Invalid JSON (createJob): ' + e.message, { status: 400 });
    }
  }

  private async createJulesTask(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const result = JulesTaskSchema.safeParse(body);

      if (!result.success) {
        return new Response('Invalid task payload: ' + result.error.message, { status: 400 });
      }

      const payload = result.data;
      const taskId = crypto.randomUUID();
      const now = Date.now();

      const newTask: JulesTask = {
        id: taskId,
        issueId: payload.issueId,
        type: payload.type as JulesTask['type'],
        title: payload.title,
        description: payload.description,
        files: payload.files || [],
        status: 'pending',
        priority: payload.priority || 0,
        isHighRisk: payload.isHighRisk || false,
        createdAt: now,
        updatedAt: now,
      };

      this.storage.julesTasks[taskId] = newTask;
      await this.saveState();

      return new Response(JSON.stringify(newTask), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      await this.logError(e.message, 'CREATE_JULES_TASK', e);
      return new Response('Invalid JSON (createJulesTask): ' + e.message, { status: 400 });
    }
  }

  private async handleJobUpdate(jobId: string, request: Request): Promise<Response> {
    const job = this.storage.jobs[jobId];
    if (!job) return new Response('Job Not Found', { status: 404 });

    if (request.method === 'GET') {
      return new Response(JSON.stringify(job), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'PATCH') {
      try {
        const body = await request.json();
        const result = JobUpdateSchema.safeParse(body);
        if (!result.success) {
          return new Response('Invalid job update payload: ' + result.error.message, {
            status: 400,
          });
        }
        const updates = result.data;
        this.storage.jobs[jobId] = { ...job, ...updates, updatedAt: Date.now() };
        await this.saveState();
        return new Response(JSON.stringify(this.storage.jobs[jobId]), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e: any) {
        await this.logError(e.message, 'UPDATE_JOB', e);
        return new Response('Invalid JSON: ' + e.message, { status: 400 });
      }
    }

    return new Response('Method Not Allowed', { status: 405 });
  }

  private async approveJob(jobId: string): Promise<Response> {
    const job = this.storage.jobs[jobId];
    if (!job) return new Response('Job Not Found', { status: 404 });

    job.status = 'pending'; // Re-queue for processing
    job.updatedAt = Date.now();
    await this.saveState();

    return new Response(JSON.stringify({ message: 'Job approved and re-queued', job }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async processBatch(): Promise<Response> {
    const pendingJobs = Object.values(this.storage.jobs)
      .filter((j) => j.status === 'pending')
      .sort((a, b) => b.priority - a.priority)
      .slice(0, this.BATCH_SIZE);

    const linear = new LinearClient({
      apiKey: this.env.LINEAR_API_KEY,
      teamId: this.env.LINEAR_TEAM_ID,
    });

    for (const job of pendingJobs) {
      if (job.type === 'ingestion' && !job.linearIssueId) {
        job.status = 'awaiting_hitl';
        try {
          const issue = await linear.createIssue({
            title: `[HITL] Ingestion Approval Required: ${job.id}`,
            description: `Job ID: ${job.id}\nPayload: ${JSON.stringify(job.payload, null, 2)}\n\nPlease approve this ingestion by adding a comment 'APPROVE' or updating the status.`,
            teamId: this.env.LINEAR_TEAM_ID,
            projectId: this.env.LINEAR_PROJECT_ID,
          });
          job.linearIssueId = issue.id;
          job.linearIdentifier = issue.identifier;
        } catch (e) {
          await this.logError((e as Error).message, 'LINEAR_CREATE_ISSUE', e);
          job.status = 'failed';
          job.error = (e as Error).message;
        }
      } else if (job.status !== 'awaiting_hitl') {
        job.status = 'processing';
      }
      job.updatedAt = Date.now();
    }
    await this.saveState();

    return new Response(
      JSON.stringify({
        processedCount: pendingJobs.length,
        jobs: pendingJobs,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  private async handleWebhook(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const result = LinearWebhookSchema.safeParse(body);

      if (!result.success) {
        return new Response('Invalid webhook payload', { status: 400 });
      }

      const payload = result.data;
      const action = payload.action;
      const type = payload.type;

      console.log(`Received Linear webhook: ${action} ${type}`);

      if (type === 'Issue' && action === 'update') {
        const issueId = payload.data.id;
        const stateName = payload.data.state?.name;

        if (stateName === 'Completed' || stateName === 'Approved') {
          const job = Object.values(this.storage.jobs).find((j) => j.linearIssueId === issueId);
          if (job) {
            job.status = 'pending';
            job.updatedAt = Date.now();
            await this.saveState();
            console.log(`Job ${job.id} approved via Linear issue update`);
          }
        }
      }

      if (type === 'Comment' && action === 'create') {
        const commentBody = payload.data.body || '';
        const issueId = payload.data.issueId;

        if (commentBody.toUpperCase().includes('APPROVE')) {
          const job = Object.values(this.storage.jobs).find((j) => j.linearIssueId === issueId);
          if (job) {
            job.status = 'pending';
            job.updatedAt = Date.now();
            await this.saveState();
            console.log(`Job ${job.id} approved via Linear comment`);
          }
        }
      }

      return new Response('OK');
    } catch (e: any) {
      await this.logError(e.message, 'WEBHOOK_FAILURE', e);
      return new Response(JSON.stringify({ error: e.message }), { status: 400 });
    }
  }

  async fetch(request: Request): Promise<Response> {
    this.storage.metrics.totalRequests++;
    const url = new URL(request.url);
    const path = url.pathname;
    const authKey = request.headers.get('Authorization') || 'unknown';

    // 1. Config Check
    const configError = this.checkConfig();
    if (configError) return configError;

    // 2. Rate Limit
    if (!this.checkRateLimit(authKey)) {
      await this.saveState();
      return new Response('Too Many Requests', { status: 429 });
    }

    try {
      switch (path) {
        case '/metrics':
          return new Response(JSON.stringify(this.storage.metrics), {
            headers: { 'Content-Type': 'application/json' },
          });
        case '/errors':
          return new Response(JSON.stringify(this.storage.recentErrors), {
            headers: { 'Content-Type': 'application/json' },
          });
        case '/jobs':
          if (request.method === 'POST') {
            return await this.createJob(request);
          }
          return new Response(JSON.stringify(Object.values(this.storage.jobs)), {
            headers: { 'Content-Type': 'application/json' },
          });
        case '/jobs/batch':
          return await this.processBatch();
        case '/jules/tasks':
          if (request.method === 'POST') {
            return await this.createJulesTask(request);
          }
          return new Response(JSON.stringify(Object.values(this.storage.julesTasks)), {
            headers: { 'Content-Type': 'application/json' },
          });
        case '/jules/next':
          return await this.getJulesNextTask();
        case '/jules/update':
          return await this.updateJulesTask(request);
        case '/github/action':
          return await this.handleGitHubAction(request);
        case '/webhooks/linear':
          return await this.handleWebhook(request);
        case '/v2/chat':
          if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
          return await this.handleV2Chat(request);
        default:
          if (path.startsWith('/jobs/')) {
            const parts = path.split('/');
            const jobId = parts[2];
            const action = parts[3];

            if (!jobId) return new Response('Missing Job ID', { status: 400 });

            if (action === 'approve' && request.method === 'POST') {
              return await this.approveJob(jobId);
            }
            if (request.method === 'PATCH' || request.method === 'GET') {
              return await this.handleJobUpdate(jobId, request);
            }
          }
          return new Response('Not Found', { status: 404 });
      }
    } catch (error: any) {
      await this.logError(error.message, 'DO_FETCH', error);
      return new Response('Internal Server Error: ' + error.message, { status: 500 });
    }
  }

  private async saveState() {
    await this.state.storage.put('router_state', this.storage);
  }
}
