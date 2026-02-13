/// <reference types="@cloudflare/workers-types" />

import { Job, RouterState, JulesTask, EngineeringLog } from './types';
import { LinearClient } from './linear';
import { GitHubClient } from './github';
import { FlyClient } from './fly';
import { EventStoreClient } from './events';
import {
  JobPayloadSchema,
  JulesTaskSchema,
  JulesTaskUpdateSchema,
  GitHubActionSchema,
  LinearWebhookSchema,
  JobUpdateSchema,
} from './schemas';
import { LLMRouter } from './llm/router';
import { verifyLinearSignature } from './utils/crypto';

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
      successCount: 0,
      startTime: Date.now(),
      providerStats: {},
    },
    recentErrors: [],
    lastMaintenance: Date.now(),
  };
  private llm: LLMRouter;
  private events: EventStoreClient;
  private fly: FlyClient;
  private readonly BATCH_SIZE = 10;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;

    // Clients
    this.events = new EventStoreClient({
      secret: this.env.EVENTS_SECRET || 'dev-secret',
      baseUrl: this.env.EVENTS_URL || 'http://bifrost-events.flycast:8080',
    });
    this.fly = new FlyClient({
      token: this.env.FLY_API_TOKEN || '',
      appName: 'bifrost-runner',
    });

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
      'LINEAR_WEBHOOK_SECRET',
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

  private async logError(message: string, context: string, error?: any, provider?: string) {
    console.error(`[${context}] ${message}`, error);
    this.storage.metrics.errorCount++;
    
    if (provider) {
        if (!this.storage.metrics.providerStats[provider]) {
            this.storage.metrics.providerStats[provider] = { requests: 0, successes: 0, failures: 0, tokens: 0 };
        }
        this.storage.metrics.providerStats[provider].failures++;
    }

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
    
    // Check if we should trigger an optimization review
    await this.maybeTriggerOptimization();
    
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

  private async routeLLM(request: RoutingRequest): Promise<LLMResponse> {
    try {
        // Fetch Optimized Prompts from Shared Memory
        let optimizedMessages = request.messages;
        const result = await this.events.getState('global-optimization');
        const optimizationState = result?.state;
        
        const optKey = `optimizedPrompt_${request.taskType || 'default'}`;
        if (optimizationState && optimizationState[optKey]) {
            const optimizedPrompt = optimizationState[optKey];
            optimizedMessages = [
                { role: 'system', content: `[OPTIMIZATION_ACTIVE] ${optimizedPrompt}` },
                ...request.messages
            ];
        }

        const result = await this.llm.route({
            ...request,
            messages: optimizedMessages
        });
        
        // Record Metrics
        this.storage.metrics.successCount++;
        const p = result.provider;
        if (!this.storage.metrics.providerStats[p]) {
            this.storage.metrics.providerStats[p] = { requests: 0, successes: 0, failures: 0, tokens: 0 };
        }
        this.storage.metrics.providerStats[p].requests++;
        this.storage.metrics.providerStats[p].successes++;
        this.storage.metrics.providerStats[p].tokens += result.usage.totalTokens;
        this.storage.metrics.tokensConsumed += result.usage.totalTokens;

        return result;
    } catch (e: any) {
        await this.logError(e.message, 'LLM_ROUTE_FAILURE', e);
        throw e;
    }
  }

  private async handleV2Chat(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const { messages, options, taskType, preferredProvider } = body as any;

      if (!messages || !Array.isArray(messages)) {
        return new Response('Missing or invalid messages', { status: 400 });
      }

      const result = await this.routeLLM({
        messages,
        options,
        taskType,
        preferredProvider,
      });

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
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

      // Log Event
      await this.events.append({
        type: 'JOB_CREATED',
        source: 'custom-router',
        payload: {
          jobId: newJob.id,
          type: newJob.type,
          priority: newJob.priority,
        },
      });

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
        // ... (existing ingestion logic)
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
      } else if (job.type === 'orchestration' && job.status === 'pending') {
        await this.processOrchestrationJob(job);
      } else if (job.type === 'runner_task' && job.status === 'pending') {
        await this.executeRunnerTask(job);
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
      const signature = request.headers.get('Linear-Signature');
      if (!signature) {
        return new Response('Missing Linear-Signature header', { status: 400 });
      }

      const rawBody = await request.text();

      const isValid = await verifyLinearSignature(
        rawBody,
        signature,
        this.env.LINEAR_WEBHOOK_SECRET,
      );

      if (!isValid) {
        return new Response('Invalid signature', { status: 401 });
      }

      const body = JSON.parse(rawBody);
      const result = LinearWebhookSchema.safeParse(body);

      if (!result.success) {
        return new Response('Invalid webhook payload', { status: 400 });
      }

      const payload = result.data;
      const action = payload.action;
      const type = payload.type;

      console.log(`Received Linear webhook: ${action} ${type}`);

      // Handle Issue Transitions
      if (type === 'Issue' && action === 'update') {
        const issueId = payload.data.id;
        const stateName = payload.data.state?.name;
        const issueIdentifier = (payload as any).data.identifier; // e.g. BIF-123
        const issueTitle = (payload as any).data.title;

        // 1. "In Progress" -> Create Workspace & Plan
        if (stateName === 'In Progress') {
          console.log(`Issue ${issueIdentifier} moved to In Progress. Initiating Swarm Orchestration.`);

          const jobId = crypto.randomUUID();
          const topic = issueIdentifier;
          const correlationId = crypto.randomUUID();

          const newJob: Job = {
            id: jobId,
            type: 'orchestration',
            status: 'pending',
            priority: 10,
            topic,
            correlationId,
            payload: {
              action: 'initialize_and_plan',
              issueIdentifier,
              issueTitle,
              issueId,
              description: (payload as any).data.description || '',
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          this.storage.jobs[jobId] = newJob;
          await this.saveState();
          
          // Log Event
          await this.events.append({
            type: 'SWARM_TRIGGERED',
            source: 'custom-router',
            topic,
            correlationId,
            payload: { issueIdentifier, jobId }
          });
        }

        // 2. "Done" -> Log completion (existing logic + enhancement)
        if (stateName === 'Completed' || stateName === 'Approved' || stateName === 'Done') {
          const job = Object.values(this.storage.jobs).find((j) => j.linearIssueId === issueId);
          if (job) {
            job.status = 'pending';
            job.updatedAt = Date.now();
            await this.saveState();
            console.log(`Job ${job.id} approved via Linear issue update`);
          }
        }
      }

      // Handle Comments (Approvals)
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
        case '/v1/queue/poll':
          if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
          return await this.handleQueuePoll(request);
        case '/v1/queue/complete':
          if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
          return await this.handleQueueComplete(request);
        case '/admin/projects':
          const client = new LinearClient({
            apiKey: this.env.LINEAR_API_KEY,
            teamId: this.env.LINEAR_TEAM_ID,
          });
          const projects = await client.listProjects();
          return new Response(JSON.stringify(projects), {
            headers: { 'Content-Type': 'application/json' },
          });
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

  private async processOrchestrationJob(job: Job) {
    try {
      // Initialize Clients
      const github = new GitHubClient({
        appId: this.env.GITHUB_APP_ID,
        privateKey: this.env.GITHUB_PRIVATE_KEY,
        installationId: this.env.GITHUB_INSTALLATION_ID,
      });
      const linear = new LinearClient({
        apiKey: this.env.LINEAR_API_KEY,
        teamId: this.env.LINEAR_TEAM_ID,
      });

      if (job.payload.action === 'initialize_and_plan' || job.payload.action === 'initialize_workspace') {
        const { issueIdentifier, issueTitle, issueId, description } = job.payload;
        const slug = issueTitle
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '');
        const branchName = `feat/${issueIdentifier}-${slug}`;
        const repo = 'bifrost-bridge';
        const owner = 'mockingb1rdblue';

        console.log(`Orchestrating workspace: ${branchName} for ${issueIdentifier}`);

        // 1. Create Branch
        let branchResult = 'Created';
        try {
          await github.createBranch(owner, repo, 'master', branchName);
        } catch (e: any) {
          if (e.message.includes('Reference already exists')) {
            branchResult = 'Existing';
          } else {
            throw e;
          }
        }

        // 2. Generate Plan if needed (initialize_and_plan)
        let plan = '';
        if (job.payload.action === 'initialize_and_plan') {
            console.log(`Generating plan for ${issueIdentifier}`);
            const prompt = `Task: ${issueTitle}\nDescription: ${description}\n\nGenerate a technical implementation plan for this task. Focus on files to modify and the logic changes. Keep it concise.`;
            const planRes = await this.routeLLM({
                messages: [{ role: 'user', content: prompt }],
                taskType: 'planning'
            });
            plan = planRes.content;
        }

        // 3. Create Engineering Log
        const engineeringLog: EngineeringLog = {
          taskId: job.id,
          whatWasDone: `Initialized workspace (\`${branchResult}\`) and generated initial implementation plan.`,
          diff: `+ Refs: refs/heads/${branchName}\n+ Base: refs/heads/master`,
          whatWorked: [
            `Created/Verified GitHub branch ${branchName}`,
            `Generated technical plan via ${this.llm.constructor.name}`,
          ],
          whatDidntWork: [],
          lessonsLearned: ['Parallelized workspace and planning speeds up agent onboarding.'],
        };

        const logBody = this.formatEngineeringLog(engineeringLog);
        const comment = `🚀 **Workspace Initialized**\n\n${logBody}${plan ? `\n\n### 📋 Implementation Plan\n${plan}` : ''}`;

        // 4. Post Comment
        await linear.addComment(issueId, comment);

        job.status = 'completed';
        job.result = { branch: branchName, plan, engineeringLog };
      } else if (job.payload.action === 'optimization_review') {
          console.log(`Analyzing performance for self-optimization...`);
          const { metrics, recentErrors } = job.payload;
          
          const prompt = `Task: Self-Optimization Review\nPerformance Metrics: ${JSON.stringify(metrics)}\nRecent Errors: ${JSON.stringify(recentErrors)}\n\nAnalyze the data and suggest 3 concrete improvements to prompts, routing logic, or model selection to improve success rates. Highlight any provider that is underperforming.`;
          
          const analysisRes = await this.routeLLM({
              messages: [
                  { role: 'system', content: 'You are the Swarm Optimization Engine. Your goal is to improve agent instructions.' }, 
                  { role: 'user', content: prompt + '\n\nPlease provide a section titled "OPTIMIZED_PROMPT" containing a refined system prompt for future tasks.' }
                ],
              taskType: 'planning'
          });

          // Extract Optimized Prompt (Naive extraction for V1)
          const optimizedPromptMatch = analysisRes.content.match(/OPTIMIZED_PROMPT\n+([\s\S]+)$|^OPTIMIZED_PROMPT[:\s]+([\s\S]+)$|OPTIMIZED_PROMPT[:]\s*([\s\S]+)/i);
          const optimizedPrompt = optimizedPromptMatch ? (optimizedPromptMatch[1] || optimizedPromptMatch[2] || optimizedPromptMatch[3]).trim() : null;

          if (optimizedPrompt) {
              const taskType = 'planning'; // For now we optimize planning
              await this.events.append({
                  type: 'PROMPT_OPTIMIZED',
                  source: 'custom-router',
                  topic: 'global-optimization',
                  payload: {
                      [`optimizedPrompt_${taskType}`]: optimizedPrompt
                  }
              });
          }

          // Post to Linear as an internal note/issue if we have a teamId
          try {
              const linear = new LinearClient({
                apiKey: this.env.LINEAR_API_KEY,
                teamId: this.env.LINEAR_TEAM_ID,
              });
              await linear.createIssue({
                  title: `[SWARM] Optimization Review - ${new Date().toLocaleDateString()}`,
                  description: `## Performance Analysis\n\n${analysisRes.content}\n\n### Metrics Summary\n- Total Requests: ${metrics.totalRequests}\n- Success Rate: ${((metrics.successCount / metrics.totalRequests) * 100).toFixed(2)}%\n- Errors: ${metrics.errorCount}`,
                  teamId: this.env.LINEAR_TEAM_ID
              });
          } catch (e: any) {
              console.error('Failed to post optimization review to Linear:', e.message);
          }

          job.status = 'completed';
          job.result = { analysis: analysisRes.content };
      } else {
        job.status = 'failed';
        job.error = 'Unknown orchestration action';
      }
    } catch (e: any) {
      await this.logError(e.message, 'ORCHESTRATION_FAILURE', e);
      job.status = 'failed';
      job.error = e.message;
    }
  }

  private async executeRunnerTask(job: Job) {
    try {
      console.log(`Processing Runner Task: ${job.id}`);
      // 1. Ensure Runner is Active
      await this.fly.startRunner(); // Fire and forget or await? Await to ensure machine is starting.

      // 2. Dispatch to Runner (Naive: Retry loop or just one shot?)
      // Runner might take time to boot.
      // For V1, we'll try once. If fails, we fail the job (or requeue).
      // Better: Requeue with backoff?
      // Let's try to hit the internal DNS.

      const runnerUrl = 'http://bifrost-runner.flycast:8080/execute';

      // We'll give it a moment or retry fetch?
      // Worker fetch automatically retries connection refused sometimes? No.

      const response = await fetch(runnerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.env.RUNNER_SECRET || process.env.RUNNER_SECRET || ''}`,
        },
        body: JSON.stringify({
          command: job.payload.command,
          cwd: job.payload.cwd,
        }),
      });

      if (!response.ok) {
        throw new Error(`Runner returned ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      job.status = 'completed';
      job.result = result;

      // Log Completion
      await this.events.append({
        type: 'JOB_COMPLETED',
        source: 'custom-router',
        payload: { jobId: job.id, result },
      });
    } catch (e: any) {
      await this.logError(e.message, 'RUNNER_FAILURE', e);
      job.status = 'failed';
      job.error = e.message;

      // Log Failure
      await this.events.append({
        type: 'JOB_FAILED',
        source: 'custom-router',
        payload: { jobId: job.id, error: e.message },
      });
    }
  }

  async handleQueuePoll(request: Request): Promise<Response> {
    try {
      const body = await request.json() as any;
      const workerId = body.workerId;

      console.log(`Worker ${workerId} polling for work...`);

      // Simple FIFO for now
      // Find first pending job that matches worker capabilities (TODO)
      const job = Object.values(this.storage.jobs)
        .filter(j => j.status === 'pending')
        .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)[0];

      if (!job) {
        return new Response(JSON.stringify({ message: "No jobs available" }), { status: 404 });
      }

      // Lock the job
      job.status = 'processing';
      job.assignedTo = workerId;
      job.startedAt = Date.now();
      await this.saveState();

      console.log(`Assigned job ${job.id} to worker ${workerId}`);

      return new Response(JSON.stringify(job), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e: any) {
      await this.logError(e.message, 'QUEUE_POLL_FAILURE', e);
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  async handleQueueComplete(request: Request): Promise<Response> {
    try {
      const body = await request.json() as any;
      const { jobId, workerId, result, error } = body;

      const job = this.storage.jobs[jobId];
      if (!job) {
        return new Response('Job not found', { status: 404 });
      }

      if (job.assignedTo !== workerId) {
        console.warn(`Worker ${workerId} tried to complete job ${jobId} assigned to ${job.assignedTo}`);
        // Allow it for now, but log warning
      }

      if (error) {
        job.status = 'failed';
        job.error = error;
        await this.logError(`Job ${jobId} failed: ${error}`, 'JOB_FAILURE');
      } else {
        job.status = 'completed';
        job.result = result;
        this.storage.metrics.successCount++;
        
        // If the result contains LLM usage, track it
        if (result && result.usage && result.provider) {
            const p = result.provider;
            if (!this.storage.metrics.providerStats[p]) {
                this.storage.metrics.providerStats[p] = { requests: 0, successes: 0, failures: 0, tokens: 0 };
            }
            this.storage.metrics.providerStats[p].requests++;
            this.storage.metrics.providerStats[p].successes++;
            this.storage.metrics.providerStats[p].tokens += result.usage.totalTokens;
            this.storage.metrics.tokensConsumed += result.usage.totalTokens;
        }
      }

      job.completedAt = Date.now();
      await this.saveState();
      
      // Periodic Optimization Check
      if (this.storage.metrics.successCount % 10 === 0) {
          await this.maybeTriggerOptimization();
      }

      console.log(`Job ${jobId} completed by ${workerId} (${job.status})`);

      // Collaboration Triage: If a coding task completes, trigger a REVIEW job
      if (job.type === 'runner_task' && job.status === 'completed' && job.payload.action === 'write_file') {
          console.log(`Coding task ${jobId} completed. Triggering verification loop.`);
          
          const reviewJobId = crypto.randomUUID();
          const reviewJob: Job = {
              id: reviewJobId,
              type: 'runner_task',
              status: 'pending',
              priority: 5, // Lower priority than original work
              topic: job.topic,
              correlationId: job.correlationId,
              payload: {
                  action: 'review_diff',
                  filePath: job.payload.filePath,
                  content: job.payload.content,
                  originalJobId: job.id
              },
              createdAt: Date.now(),
              updatedAt: Date.now(),
              linearIssueId: job.linearIssueId,
              linearIdentifier: job.linearIdentifier
          };

          this.storage.jobs[reviewJobId] = reviewJob;
          await this.saveState();

          await this.events.append({
              type: 'VERIFICATION_TRIGGERED',
              source: 'custom-router',
              topic: job.topic,
              correlationId: job.correlationId,
              payload: { originalJobId: job.id, reviewJobId }
          });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (e: any) {
      await this.logError(e.message, 'QUEUE_COMPLETE_FAILURE', e);
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }


  private async maybeTriggerOptimization() {
      const errorRate = this.storage.metrics.totalRequests > 0 
        ? this.storage.metrics.errorCount / this.storage.metrics.totalRequests 
        : 0;
      
      const shouldOptimize = errorRate > 0.1 || (this.storage.metrics.successCount > 0 && this.storage.metrics.successCount % 50 === 0);

      if (shouldOptimize) {
          console.log(`Self-Optimization triggered. Error Rate: ${errorRate}`);
          
          const jobId = crypto.randomUUID();
          const newJob: Job = {
              id: jobId,
              type: 'orchestration',
              status: 'pending',
              priority: 20, // High priority
              payload: {
                  action: 'optimization_review',
                  metrics: this.storage.metrics,
                  recentErrors: this.storage.recentErrors.slice(0, 10)
              },
              createdAt: Date.now(),
              updatedAt: Date.now(),
          };

          this.storage.jobs[jobId] = newJob;
          
          await this.events.append({
              type: 'SELF_OPTIMIZATION_TRIGGERED',
              source: 'custom-router',
              payload: { jobId, errorRate }
          });
      }
  }

  private async saveState() {
    await this.state.storage.put('router_state', this.storage);
  }
}
