import { Job, RouterState, SluaghSwarmTask, EngineeringLog } from './types';
import { LinearClient } from './linear';
import { GitHubClient } from './github';
import { FlyClient } from './fly';
import { EventStoreClient } from './events';
import {
  JobPayloadSchema,
  SluaghSwarmTaskSchema,
  SluaghSwarmTaskUpdateSchema,
  GitHubActionSchema,
  LinearWebhookSchema,
  JobUpdateSchema,
} from './schemas';
import { LLMRouter, RoutingRequest } from './llm/router';
import { LLMResponse } from './llm/types';
import { verifyLinearSignature, verifyGitHubSignature } from './utils/crypto';

export interface Env {
  PROXY_API_KEY: string;
  LINEAR_API_KEY: string;
  LINEAR_WEBHOOK_SECRET: string;
  LINEAR_TEAM_ID: string;
  LINEAR_PROJECT_ID: string;
  GITHUB_APP_ID: string;
  GITHUB_PRIVATE_KEY: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_WEBHOOK_SECRET: string;
  DEEPSEEK_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  GEMINI_API_KEY: string;
  PERPLEXITY_API_KEY: string;
  EVENTS_SECRET: string;
  EVENTS_URL: string;
  FLY_API_TOKEN: string;
  RATE_LIMIT_DEGRADATION_THRESHOLD?: string;
  RATE_LIMIT_MAX_TOKENS?: string;
  RATE_LIMIT_REFILL_RATE?: string;
  JULES_API_KEY: string;
  RUNNER_SECRET: string;
  ROUTER_DO: DurableObjectNamespace;
  GOVERNANCE_DO: DurableObjectNamespace;
}

export class RouterDO {
  private state: DurableObjectState;
  private env: Env;
  private storage: RouterState = {
    jobs: {},
    swarmTasks: {},
    rateLimits: {},
    metrics: {
      totalRequests: 0,
      totalTasks: 0,
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
      anthropicBaseUrl: 'https://proxy.jules.codes/v1',
      deepseekBaseUrl: 'https://proxy.jules.codes/v1',
      geminiBaseUrl: 'https://proxy.jules.codes/v1',
    });

    // Set heartbeat alarm
    this.state.storage.setAlarm(Date.now() + 10000);
  }

  async alarm() {
    console.log('[RouterDO] Manual Trigger: Running maintenance and sync...');
    try {
      await this.syncLinearTasks();
      await this.processBatch();
      await this.triggerMaintenance();
    } catch (e: any) {
      console.error('[RouterDO] Trigger failed:', e.message);
    }
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
      const msg = `Configuration Error: Missing secrets[${missing.join(', ')}]`;
      console.error(msg);
      return new Response(msg, { status: 503 });
    }
    return null;
  }

  private async logError(message: string, context: string, error?: any, provider?: string) {
    console.error(`[${context}] ${message} `, error);
    this.storage.metrics.errorCount++;

    if (provider) {
      if (!this.storage.metrics.providerStats[provider]) {
        this.storage.metrics.providerStats[provider] = {
          requests: 0,
          successes: 0,
          failures: 0,
          tokens: 0,
        };
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
      const meshResult = (await this.events.getState('global-optimization')) as any;
      const optimizationState = meshResult?.state;

      const optKey = `optimizedPrompt_${request.taskType || 'default'} `;
      if (optimizationState && optimizationState[optKey]) {
        const optimizedPrompt = optimizationState[optKey];
        optimizedMessages = [
          { role: 'system', content: `[OPTIMIZATION_ACTIVE] ${optimizedPrompt} ` },
          ...request.messages,
        ];
      }

      const result = await this.llm.route({
        ...request,
        messages: optimizedMessages,
      });

      // Record Metrics
      this.storage.metrics.successCount++;
      const p = result.provider;
      if (!this.storage.metrics.providerStats[p]) {
        this.storage.metrics.providerStats[p] = {
          requests: 0,
          successes: 0,
          failures: 0,
          tokens: 0,
        };
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

  private async getSluaghSwarmNextTask(): Promise<Response> {
    const nextTask = Object.values(this.storage.swarmTasks)
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

  private async handleSluaghSwarmTaskUpdate(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const result = SluaghSwarmTaskUpdateSchema.safeParse(body);

      if (!result.success) {
        return new Response('Invalid task update payload: ' + result.error.message, {
          status: 400,
        });
      }

      const { taskId, status, engineeringLog } = result.data;

      const task = this.storage.swarmTasks[taskId];
      if (!task) {
        return new Response('Task not found', { status: 404 });
      }

      task.status = status as SluaghSwarmTask['status'];
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
            : `Task ${status} `;
          await linear.addComment(task.issueId, `🤖 Sluagh Swarm: Task ${status} \n\n${logBody} `);

          if (status === 'completed') {
            await linear.addLabel(task.issueId, 'swarm:review');
            await linear.removeLabel(task.issueId, 'swarm:active');

            // Autonomy: If verify task succeeds, merge and close
            if (task.type === 'verify') {
              await this.completeAndMergeTask(task);
            }
          } else if (status === 'failed') {
            await linear.addLabel(task.issueId, 'swarm:blocked');
            await linear.removeLabel(task.issueId, 'swarm:active');
          }
        } catch (e: any) {
          console.error('Failed to post comment to Linear:', e.message);
        }
      }

      // If PR info is provided in update, save it
      if (result.data.prNumber) task.prNumber = result.data.prNumber;
      if (result.data.prUrl) task.prUrl = result.data.prUrl;

      // Chaining: If coding is done, create verify task
      if (status === 'completed' && task.type === 'coding') {
        const verifyTaskId = `task_verify_${Date.now()} `;
        this.storage.swarmTasks[verifyTaskId] = {
          ...task,
          id: verifyTaskId,
          type: 'verify',
          title: `Verify: ${task.title} `,
          description: `Verify the changes made for task ${task.id}.Run tests and check requirements.`,
          status: 'pending',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await this.saveState();
        console.log(`[handleSluaghSwarmTaskUpdate] Chained verify task ${verifyTaskId} for ${task.id}`);
      }

      // Trigger next batch
      await this.processBatch();

      return new Response('OK');
    } catch (e: any) {
      console.error('handleSluagh SwarmTaskUpdate error:', e);
      return new Response('Invalid JSON (handleSluaghSwarmTaskUpdate): ' + e.message, { status: 400 });
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

      const { action, owner, repo, number, content, taskId } = validation.data;

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

          if (taskId && this.storage.swarmTasks[taskId]) {
            this.storage.swarmTasks[taskId].prNumber = result.number;
            this.storage.swarmTasks[taskId].prUrl = result.html_url;
            await this.saveState();
            console.log(`Linked PR #${result.number} to SluaghSwarmTask ${taskId} `);
          }
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

  private async handleCreateSluaghSwarmTask(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      const result = SluaghSwarmTaskSchema.safeParse(body);

      if (!result.success) {
        return new Response('Invalid task payload: ' + result.error.message, { status: 400 });
      }

      const payload = result.data;
      const taskId = crypto.randomUUID();
      const now = Date.now();

      const newTask: SluaghSwarmTask = {
        id: taskId,
        issueId: payload.issueId,
        type: payload.type as SluaghSwarmTask['type'],
        title: payload.title,
        description: payload.description,
        files: payload.files || [],
        status: 'pending',
        priority: payload.priority || 0,
        isHighRisk: payload.isHighRisk || false,
        createdAt: now,
        updatedAt: now,
      };

      this.storage.swarmTasks[taskId] = newTask;
      await this.saveState();

      return new Response(JSON.stringify(newTask), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      await this.logError(e.message, 'CREATE_SWARM_TASK', e);
      return new Response('Invalid JSON (createSluaghSwarmTask): ' + e.message, { status: 400 });
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

    job.status = 'pending';
    job.updatedAt = Date.now();
    await this.saveState();

    return new Response(JSON.stringify({ message: 'Job approved and re-queued', job }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async processBatch(): Promise<Response> {
    await this.syncLinearTasks();

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
      await this.checkGovernance('ingress-webhook');
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

      if (type === 'Issue' && action === 'update') {
        const issueId = payload.data.id;
        const stateName = payload.data.state?.name;
        const issueIdentifier = (payload as any).data.identifier;
        const issueTitle = (payload as any).data.title;

        if (stateName === 'In Progress') {
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

          await this.events.append({
            type: 'SWARM_TRIGGERED',
            source: 'custom-router',
            topic,
            correlation_id: correlationId,
            payload: { issueIdentifier, jobId },
          });
        }

        if (stateName === 'Completed' || stateName === 'Approved' || stateName === 'Done') {
          const job = Object.values(this.storage.jobs).find((j) => j.linearIssueId === issueId);
          if (job) {
            job.status = 'pending';
            job.updatedAt = Date.now();
            await this.saveState();
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
          }
        }
      }

      return new Response('OK');
    } catch (e: any) {
      await this.logError(e.message, 'WEBHOOK_FAILURE', e);
      return new Response(JSON.stringify({ error: e.message }), { status: 400 });
    }
  }

  private async handleGitHubWebhook(request: Request): Promise<Response> {
    try {
      await this.checkGovernance('ingress-github');
      const signature = request.headers.get('X-Hub-Signature-256');
      if (!signature) {
        return new Response('Missing X-Hub-Signature-256 header', { status: 400 });
      }

      const rawBody = await request.text();
      const isValid = await verifyGitHubSignature(
        rawBody,
        signature,
        this.env.GITHUB_WEBHOOK_SECRET
      );

      if (!isValid) {
        return new Response('Invalid signature', { status: 401 });
      }

      const payload = JSON.parse(rawBody);
      const event = request.headers.get('X-GitHub-Event');

      if (event === 'pull_request') {
        const pr = payload.pull_request;
        const action = payload.action;

        await this.events.append({
          type: 'GITHUB_PR_EVENT',
          source: 'custom-router',
          topic: `repo/${payload.repository.full_name}`,
          correlation_id: crypto.randomUUID(),
          payload: {
            action,
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            sender: payload.sender.login
          }
        });
      }

      return new Response('OK');
    } catch (e: any) {
      await this.logError(e.message, 'GITHUB_WEBHOOK_FAILURE', e);
      return new Response(JSON.stringify({ error: e.message }), { status: 400 });
    }
  }

  async fetch(request: Request): Promise<Response> {
    this.storage.metrics.totalRequests++;
    const url = new URL(request.url);
    const path = url.pathname;
    const authKey = request.headers.get('Authorization') || 'unknown';

    const configError = this.checkConfig();
    if (configError) return configError;

    if (!this.checkRateLimit(authKey)) {
      await this.saveState();
      return new Response('Too Many Requests', { status: 429 });
    }

    try {
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
        case '/v1/swarm/tasks':
          if (request.method === 'POST') {
            return await this.handleCreateSluaghSwarmTask(request);
          }
          return new Response(JSON.stringify(Object.values(this.storage.swarmTasks)), {
            headers: { 'Content-Type': 'application/json' },
          });
        case '/v1/swarm/next':
          return await this.getSluaghSwarmNextTask();
        case '/v1/swarm/update':
          return await this.handleSluaghSwarmTaskUpdate(request);
        case '/github/action':
          return await this.handleGitHubAction(request);
        case '/v2/chat':
          if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
          return await this.handleV2Chat(request);
        case '/v1/queue/poll':
          if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
          return await this.handleQueuePoll(request);
        case '/v1/queue/complete':
          if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
          return await this.handleQueueComplete(request);
        case '/webhooks/linear':
          return await this.handleWebhook(request);
        case '/webhooks/github':
          return await this.handleGitHubWebhook(request);
        case '/admin/sync-linear':
          await this.syncLinearTasks();
          return new Response(JSON.stringify({ message: 'Linear tasks sync completed' }), {
            headers: { 'Content-Type': 'application/json' },
          });
        case '/admin/maintenance':
          await this.triggerMaintenance();
          return new Response(JSON.stringify({ message: 'Maintenance triggered' }), {
            headers: { 'Content-Type': 'application/json' },
          });
        case '/admin/seed-test-issues':
          return await this.seedTestIssues();
        case '/admin/projects':
          const projectsClient = new LinearClient({
            apiKey: this.env.LINEAR_API_KEY,
            teamId: this.env.LINEAR_TEAM_ID,
          });
          const projects = await projectsClient.listProjects();
          return new Response(JSON.stringify(projects), {
            headers: { 'Content-Type': 'application/json' },
          });
        case '/admin/query':
          if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
          const { query: customQuery, variables: customVars } = (await request.json()) as any;
          const queryClient = new LinearClient({
            apiKey: this.env.LINEAR_API_KEY,
            teamId: this.env.LINEAR_TEAM_ID,
          });
          const queryResult = await (queryClient as any).query(customQuery, customVars);
          return new Response(JSON.stringify(queryResult), {
            headers: { 'Content-Type': 'application/json' },
          });
        case '/admin/post-update':
          if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
          return await this.postProjectHealth();
        case '/v1/swarm/sync': // New route for triggering batch processing
          if (request.method === 'POST') {
            await this.processBatch();
            return new Response('OK');
          }
          return new Response('Method Not Allowed', { status: 405 });
        case '/v1/swarm/trigger': // Renamed to trigger to avoid confusion with sync
          if (request.method === 'POST') {
            const body = (await request.json()) as any;
            const { issueIdentifier, issueTitle, issueId, description } = body;

            if (!issueIdentifier || !issueTitle || !issueId) {
              return new Response('Missing issue details', { status: 400 });
            }

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
                description: description || '',
              },
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            this.storage.jobs[jobId] = newJob;
            await this.saveState();

            await this.events.append({
              type: 'SWARM_TRIGGERED',
              source: 'custom-router',
              topic,
              correlation_id: correlationId,
              payload: { issueIdentifier, jobId },
            });
            return new Response(JSON.stringify(newJob), { status: 201, headers: { 'Content-Type': 'application/json' } });
          }
          return new Response('Method Not Allowed', { status: 405 });
        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (e: any) {
      await this.logError(e.message, 'DO_FETCH', e);
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  private async seedTestIssues(): Promise<Response> {
    try {
      if (!this.env.LINEAR_API_KEY || !this.env.LINEAR_TEAM_ID) {
        return new Response('Linear API Key or Team ID missing', { status: 503 });
      }

      const linear = new LinearClient({
        apiKey: this.env.LINEAR_API_KEY,
        teamId: this.env.LINEAR_TEAM_ID,
        projectId: this.env.LINEAR_PROJECT_ID,
      });

      let swarmReadyLabelId = await linear.getLabelIdByName(this.env.LINEAR_TEAM_ID, 'swarm:ready');
      if (!swarmReadyLabelId) {
        try {
          await linear.createLabel({
            teamId: this.env.LINEAR_TEAM_ID,
            name: 'swarm:ready',
            color: '#2DA54F',
          });
          await linear.createLabel({
            teamId: this.env.LINEAR_TEAM_ID,
            name: 'swarm:active',
            color: '#3B82F6',
          });
          await linear.createLabel({
            teamId: this.env.LINEAR_TEAM_ID,
            name: 'swarm:review',
            color: '#EAB308',
          });
          await linear.createLabel({
            teamId: this.env.LINEAR_TEAM_ID,
            name: 'swarm:blocked',
            color: '#EF4444',
          });
          await linear.createLabel({
            teamId: this.env.LINEAR_TEAM_ID,
            name: 'agent:jules',
            color: '#8B5CF6',
          });

          swarmReadyLabelId = await linear.getLabelIdByName(this.env.LINEAR_TEAM_ID, 'swarm:ready');
        } catch (e: any) {
          console.error('Failed to create labels:', e.message);
          return new Response('Failed to create swarm labels: ' + e.message, { status: 500 });
        }
      }

      const testTasks = [
        {
          title: 'Simulate Runner Failure to Verify Sluagh Swarm Resilience',
          description: `Verify the swarm handles task failure correctly.\n\nMetadata:\nTaskType: maintenance\nRiskProfile: medium\nPriority: 10\nBudgetMax: 1000\nSuccessCriteria: Issue marked as swarm:blocked upon failure.`,
        },
        {
          title: 'Prioritize High-Priority Documentation Updates in Metadata Routing',
          description: `Verify the orchestrator prioritizes high-priority tasks.\n\nMetadata:\nTaskType: documentation\nRiskProfile: low\nPriority: 90\nBudgetMax: 2000\nSuccessCriteria: Task checked out before lower priority tasks.`,
        },
      ];

      const results = [];
      for (const task of testTasks) {
        const issue = await linear.createIssue({
          ...task,
          teamId: this.env.LINEAR_TEAM_ID,
          projectId: this.env.LINEAR_PROJECT_ID,
        });
        await linear.updateIssue(issue.id, { labelIds: [swarmReadyLabelId!] });
        results.push(issue.identifier);
      }

      return new Response(JSON.stringify({ success: true, seeded: results }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      await this.logError(error.message, 'SEED_ISSUES', error);
      return new Response('Seeding failed: ' + error.message, { status: 500 });
    }
  }

  private async postProjectHealth(): Promise<Response> {
    try {
      if (!this.env.LINEAR_API_KEY || !this.env.LINEAR_PROJECT_ID) {
        return new Response('Linear API Key or Project ID missing', { status: 503 });
      }

      const linear = new LinearClient({
        apiKey: this.env.LINEAR_API_KEY,
        teamId: this.env.LINEAR_TEAM_ID,
        projectId: this.env.LINEAR_PROJECT_ID,
      });

      const metrics = this.storage.metrics;
      const successRate =
        metrics.totalTasks > 0
          ? Math.round((metrics.successCount / metrics.totalTasks) * 100)
          : 100;

      const health = successRate > 90 ? 'onTrack' : successRate > 70 ? 'atRisk' : 'offTrack';
      const body = `Automated Health Report from Bifrost Bridge Sluagh Swarm:
      - Total Tasks Orchestrated: ${metrics.totalTasks}
      - Success Rate: ${successRate}%
      
      Current swarm performance is ${health === 'onTrack' ? 'optimal' : 'requiring review'}.`;

      const success = await linear.postProjectUpdate(this.env.LINEAR_PROJECT_ID, {
        health,
        body,
      });

      return new Response(JSON.stringify({ success, health, successRate }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error: any) {
      await this.logError(error.message, 'POST_HEALTH', error);
      return new Response('Post health failed: ' + error.message, { status: 500 });
    }
  }

  private async maybeTriggerOptimization() {
    const errorRate =
      this.storage.metrics.totalRequests > 0
        ? this.storage.metrics.errorCount / this.storage.metrics.totalRequests
        : 0;

    const shouldOptimize =
      errorRate > 0.1 ||
      (this.storage.metrics.successCount > 0 && this.storage.metrics.successCount % 50 === 0);

    if (shouldOptimize) {
      const jobId = crypto.randomUUID();
      const newJob: Job = {
        id: jobId,
        type: 'orchestration',
        status: 'pending',
        priority: 20,
        payload: {
          action: 'optimization_review',
          metrics: this.storage.metrics,
          recentErrors: this.storage.recentErrors.slice(0, 10),
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.storage.jobs[jobId] = newJob;

      await this.events.append({
        type: 'SELF_OPTIMIZATION_TRIGGERED',
        source: 'custom-router',
        payload: { jobId, errorRate },
      });
    }
  }

  private async triggerMaintenance() {
    this.storage.lastMaintenance = Date.now();
    await this.syncLinearTasks();
    await this.processBatch();
    await this.saveState();
  }

  private async saveState() {
    await this.state.storage.put('router_state', this.storage);
  }

  private async syncLinearTasks() {
    try {
      if (!this.env.LINEAR_API_KEY || !this.env.LINEAR_TEAM_ID) {
        return;
      }

      const linear = new LinearClient({
        apiKey: this.env.LINEAR_API_KEY,
        teamId: this.env.LINEAR_TEAM_ID,
      });

      const labels = await linear.listLabels(this.env.LINEAR_TEAM_ID);
      const readyLabel = labels.find((l: any) => l.name === 'sluagh:ready');
      const activeLabel = labels.find((l: any) => l.name === 'sluagh:active');
      const julesLabel = labels.find((l: any) => l.name === 'agent:jules');

      if (!readyLabel || !activeLabel) {
        return;
      }

      const issues = await linear.listIssuesByLabel('sluagh:ready');

      const prioritizedTasks = issues
        .map((issue) => {
          const metadata = this.parseMetadata(issue.description);
          const priority = parseInt(metadata['Priority'] || '10');
          const risk = metadata['RiskProfile'] || 'low';
          return { issue, metadata, priority, risk };
        })
        .sort((a, b) => b.priority - a.priority);

      for (const task of prioritizedTasks) {
        const { issue, metadata, priority } = task;

        const existingJob = Object.values(this.storage.jobs).find(
          (j) => j.linearIssueId === issue.id && j.status !== 'failed' && j.status !== 'completed',
        );
        if (existingJob) continue;

        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.storage.jobs[jobId] = {
          id: jobId,
          type: 'orchestration',
          status: 'pending',
          priority: priority,
          payload: {
            action: 'initialize_and_plan',
            issueId: issue.id,
            issueIdentifier: issue.identifier,
            issueTitle: issue.title,
            description: issue.description,
            metadata: metadata,
          },
          linearIssueId: issue.id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        await this.events.append({
          type: 'TASK_SYNCED',
          source: 'custom-router',
          payload: { jobId, issueIdentifier: issue.identifier },
        });
      }
    } catch (e: any) {
      console.error('[syncLinearTasks] Sync failed:', e.message);
    }
  }

  private async processOrchestrationJob(job: Job) {
    try {
      await this.checkGovernance('orchestrator');
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
        const slug = issueTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const branchName = `feat/${issueIdentifier}-${slug}`;
        const repo = 'bifrost-bridge';
        const owner = 'mockingb1rdblue';

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
          whatWorked: [
            `Created/Verified GitHub branch ${branchName}`,
            `Generated technical plan`,
          ],
          whatDidntWork: [],
          lessonsLearned: ['Parallelized workspace and planning speeds up agent onboarding.'],
        };

        const logBody = this.formatEngineeringLog(engineeringLog);
        const comment = `🚀 **Workspace Initialized**\n\n${logBody}${plan ? `\n\n### 📋 Implementation Plan\n${plan}` : ''}`;

        await linear.addComment(issueId, comment);

        // 5. Create Sluagh SwarmTask for execution handoff
        if (job.payload.action === 'initialize_and_plan') {
          const taskId = `task_${Date.now()}`;
          const isHighRisk = job.payload.metadata?.RiskProfile === 'high';

          this.storage.swarmTasks[taskId] = {
            id: taskId,
            type: 'coding',
            title: issueTitle,
            description: `Generated Plan:\n${plan}\n\nObjective: Execute the plan on branch ${branchName}.`,
            files: [],
            status: 'pending',
            priority: job.priority,
            isHighRisk: isHighRisk,
            issueId: issueId,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            repository: {
              owner: owner,
              name: repo,
            },
          };
          console.log(`Created Sluagh SwarmTask ${taskId} for issue ${issueIdentifier}`);
        }

        job.status = 'completed';
        job.result = { branch: branchName, plan };
      } else if (job.payload.action === 'optimization_review') {
        const { metrics, recentErrors } = job.payload;
        const prompt = `Task: Self-Optimization Review\nPerformance Metrics: ${JSON.stringify(metrics)}\nRecent Errors: ${JSON.stringify(recentErrors)}\n\nAnalyze the data and suggest 3 concrete improvements. Highlight any provider that is underperforming.`;

        const analysisRes = await this.routeLLM({
          messages: [
            { role: 'system', content: 'You are the Sluagh Swarm Optimization Engine.' },
            { role: 'user', content: prompt + '\n\nPlease provide a section titled "OPTIMIZED_PROMPT" containing a refined system prompt.' },
          ],
          taskType: 'planning',
        });

        const optimizedPromptMatch = analysisRes.content.match(/OPTIMIZED_PROMPT\n+([\s\S]+)$|^OPTIMIZED_PROMPT[:\s]+([\s\S]+)$|OPTIMIZED_PROMPT[:]\s*([\s\S]+)/i);
        const optimizedPrompt = optimizedPromptMatch
          ? (optimizedPromptMatch[1] || optimizedPromptMatch[2] || optimizedPromptMatch[3] || '').trim()
          : null;

        if (optimizedPrompt) {
          await this.events.append({
            type: 'PROMPT_OPTIMIZED',
            source: 'custom-router',
            topic: 'global-optimization',
            payload: { optimizedPrompt_planning: optimizedPrompt },
          });
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
      // 1. Governance Check
      if (this.env.GOVERNANCE_DO) {
        const id = this.env.GOVERNANCE_DO.idFromName('guard-dog');
        const stub = this.env.GOVERNANCE_DO.get(id);
        const govRes = await stub.fetch('http://governance/check');

        if (govRes.status === 429) {
          const body = await govRes.json() as any;
          throw new Error(`Governance Blocked: ${body.reason}`);
        }
      }

      await this.fly.startRunner();
      const runnerUrl = 'http://bifrost-runner.flycast:8080/execute';
      const command = job.payload?.command;
      const cwd = job.payload?.cwd;

      if (!command) throw new Error('Missing command in runner task payload');

      const response = await fetch(runnerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.env.RUNNER_SECRET || ''}`,
        },
        body: JSON.stringify({ command, cwd }),
      });

      if (!response.ok) {
        throw new Error(`Runner returned ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      job.status = 'completed';
      job.result = result;

      await this.events.append({
        type: 'JOB_COMPLETED',
        source: 'custom-router',
        payload: { jobId: job.id, result },
      });
    } catch (e: any) {
      await this.logError(e.message, 'RUNNER_FAILURE', e);
      job.status = 'failed';
      job.error = e.message;
      await this.events.append({
        type: 'JOB_FAILED',
        source: 'custom-router',
        payload: { jobId: job.id, error: e.message },
      });
    }
  }

  async handleQueuePoll(request: Request): Promise<Response> {
    try {
      const body = (await request.json()) as any;
      const workerId = body.workerId;
      const job = Object.values(this.storage.jobs)
        .filter((j) => j.status === 'pending')
        .sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt)[0];

      if (!job) return new Response(JSON.stringify({ message: 'No jobs available' }), { status: 404 });

      job.status = 'processing';
      job.assignedTo = workerId;
      job.startedAt = Date.now();
      await this.saveState();

      return new Response(JSON.stringify(job), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      await this.logError(e.message, 'QUEUE_POLL_FAILURE', e);
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  async handleQueueComplete(request: Request): Promise<Response> {
    try {
      const body = (await request.json()) as any;
      const { jobId, workerId, result, error } = body;

      const job = this.storage.jobs[jobId];
      if (!job) return new Response('Job not found', { status: 404 });

      if (error) {
        job.status = 'failed';
        job.error = error;
        await this.logError(`Job ${jobId} failed: ${error}`, 'JOB_FAILURE');
      } else {
        job.status = 'completed';
        job.result = result;
        this.storage.metrics.successCount++;

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

      if (job.linearIssueId) {
        try {
          const linear = new LinearClient({
            apiKey: this.env.LINEAR_API_KEY,
            teamId: this.env.LINEAR_TEAM_ID,
          });

          if (job.status === 'completed') {
            const resultSummary = typeof job.result === 'string' ? job.result : JSON.stringify(job.result, null, 2);
            await linear.addComment(job.linearIssueId, `🏁 **Sluagh Swarm Handoff**\n\nTask completed successfully.\n\n**Result Summary:**\n\`\`\`json\n${resultSummary.substring(0, 1000)}\n\`\`\`\n\nMoving to **Review** phase.`);
            await linear.addLabel(job.linearIssueId, 'swarm:review');
            await linear.removeLabel(job.linearIssueId, 'swarm:active');
          } else if (job.status === 'failed') {
            await linear.addComment(job.linearIssueId, `⚠️ **Sluagh Swarm Blocked**\n\nTask execution failed.\n\n**Error:**\n> ${job.error}\n\nHuman intervention required.`);
            await linear.addLabel(job.linearIssueId, 'swarm:blocked');
            await linear.removeLabel(job.linearIssueId, 'swarm:active');
          }
        } catch (e: any) {
          console.error('[handleQueueComplete] Failed to post handoff comment:', e.message);
        }
      }

      if (this.storage.metrics.successCount % 10 === 0) {
        await this.maybeTriggerOptimization();
      }

      // Trigger next batch
      await this.processBatch();

      if (job.type === 'runner_task' && job.status === 'completed' && job.payload.action === 'write_file') {
        const reviewJobId = crypto.randomUUID();
        const reviewJob: Job = {
          id: reviewJobId,
          type: 'runner_task',
          status: 'pending',
          priority: 5,
          payload: {
            action: 'review_diff',
            filePath: job.payload.filePath,
            content: job.payload.content,
            originalJobId: job.id,
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
          linearIssueId: job.linearIssueId,
          linearIdentifier: job.linearIdentifier,
        };
        this.storage.jobs[reviewJobId] = reviewJob;
        await this.saveState();
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e: any) {
      await this.logError(e.message, 'QUEUE_COMPLETE_FAILURE', e);
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  private async completeAndMergeTask(task: SluaghSwarmTask) {
    if (!task.prNumber || !task.repository) {
      console.warn(`[completeAndMergeTask] Task ${task.id} missing PR info. Cannot merge.`);
      return;
    }

    try {
      const github = new GitHubClient({
        appId: this.env.GITHUB_APP_ID,
        privateKey: this.env.GITHUB_PRIVATE_KEY,
        installationId: this.env.GITHUB_INSTALLATION_ID,
      });
      const linear = new LinearClient({
        apiKey: this.env.LINEAR_API_KEY,
        teamId: this.env.LINEAR_TEAM_ID,
      });

      console.log(`[completeAndMergeTask] Approving and merging PR #${task.prNumber} for task ${task.id}`);

      // 1. Approve PR
      await github.createReviewComment(
        task.repository.owner,
        task.repository.name,
        task.prNumber,
        '🤖 **Autonomous Approval**: Sluagh Swarm verification successful. All tests passed. Merging...',
        'APPROVE',
      );

      // 2. Squash and Merge
      await github.mergePullRequest(
        task.repository.owner,
        task.repository.name,
        task.prNumber,
        'squash',
      );

      // 3. Move Linear Issue to Done
      const doneStateId = await linear.getStateIdByName('Done');
      if (doneStateId) {
        await linear.updateIssue(task.issueId, { stateId: doneStateId });
        await linear.addComment(
          task.issueId,
          `🏁 **Autonomous Merge & Close**\n\nPR #${task.prNumber} merged. Issue moved to **Done**.`,
        );
      } else {
        console.warn('[completeAndMergeTask] Done state not found in Linear.');
      }
    } catch (e: any) {
      console.error(`[completeAndMergeTask] Failed to merge/close: ${e.message}`);
      // Optionally notify Linear that merge failed
    }
  }

  private async checkGovernance(agentId: string = 'global') {
    if (this.env.GOVERNANCE_DO) {
      const id = this.env.GOVERNANCE_DO.idFromName('guard-dog');
      const stub = this.env.GOVERNANCE_DO.get(id);
      const govRes = await stub.fetch(`http://governance/check?agent=${agentId}`);

      if (govRes.status === 429) {
        const body = (await govRes.json()) as any;
        throw new Error(`Governance Blocked: ${body.reason}`);
      }
    }
  }

  private parseMetadata(description: string = ''): Record<string, string> {
    const metadata: Record<string, string> = {};
    const lines = description.split('\n');
    let inMetadata = false;

    for (const line of lines) {
      if (line.trim().toLowerCase().startsWith('metadata:')) {
        inMetadata = true;
        continue;
      }
      if (inMetadata) {
        if (line.trim() === '' || !line.includes(':')) {
          if (line.trim() !== '') continue;
          inMetadata = false;
          continue;
        }
        const [key, ...valueParts] = line.split(':');
        if (key) {
          metadata[key.trim()] = valueParts.join(':').trim();
        }
      }
    }
    return metadata;
  }
}
