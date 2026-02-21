import { RouterConfig } from './config';
import { RouterDependencies } from './dependencies';
import { RouterStateManager } from './state';
import { RouterJobProcessor } from './processor';
import { RouterLLMManager } from './llm';
import { RouterWebhookHandler } from './webhooks';
import { RouterSwarmManager } from './swarm';
import { RouterAdminHandler } from './admin';

/**
 * RouterHandler: A lightweight wiring layer delegating request handling to domain-specific services.
 * 
 * Goals:
 * 1. Stay under 300 lines (currently delegating most logic).
 * 2. Pure routing/wiring layer.
 * 3. Consistent error handling and rate limiting.
 */
export class RouterHandler {
  private webhooks: RouterWebhookHandler;
  private swarm: RouterSwarmManager;
  private admin: RouterAdminHandler;

  constructor(
    private config: RouterConfig,
    private deps: RouterDependencies,
    private stateManager: RouterStateManager,
    private processor: RouterJobProcessor,
    private llmManager: RouterLLMManager
  ) {
    this.webhooks = new RouterWebhookHandler(config, deps, stateManager);
    this.swarm = new RouterSwarmManager(config, deps, stateManager, processor);
    this.admin = new RouterAdminHandler(config, deps, stateManager, processor);
  }

  /**
   * Main entry point for Durable Object requests.
   */
  async handleFetch(request: Request): Promise<Response> {
    await this.stateManager.recordRequest();
    const url = new URL(request.url);
    const path = url.pathname;
    const authKey = request.headers.get('Authorization') || 'unknown';

    // 1. Validation & Rate Limiting
    const configError = this.checkConfig();
    if (configError) return configError;

    if (!this.stateManager.checkRateLimit(authKey, this.config.rateLimit.maxTokens, this.config.rateLimit.refillRate)) {
      return new Response('Too Many Requests', { status: 429 });
    }

    try {
      // 2. Job Handlers (Admin/Jobs)
      if (path.startsWith('/jobs/')) {
        const parts = path.split('/');
        const jobId = parts[2];
        const action = parts[3];
        if (!jobId) return new Response('Missing Job ID', { status: 400 });

        if (action === 'approve' && request.method === 'POST') return await this.admin.approveJob(jobId);
        return await this.admin.handleJobUpdate(jobId, request);
      }

      // 3. Central Dispatch
      switch (path) {
        // --- Metrics & State ---
        case '/metrics':
          return new Response(JSON.stringify(this.stateManager.metrics), { headers: { 'Content-Type': 'application/json' } });
        case '/errors':
          return new Response(JSON.stringify(this.stateManager.recentErrors), { headers: { 'Content-Type': 'application/json' } });
        case '/admin/circuits':
          return new Response(JSON.stringify(this.stateManager.circuitBreakers), { headers: { 'Content-Type': 'application/json' } });

        // --- Swarm Task API ---
        case '/v1/swarm/tasks':
          if (request.method === 'POST') return await this.swarm.createTask(request);
          return new Response(JSON.stringify(Object.values(this.stateManager.swarmTasks)), { headers: { 'Content-Type': 'application/json' } });
        case '/v1/swarm/next':
          return await this.swarm.checkoutNextTask();
        case '/v1/swarm/update':
          return await this.swarm.handleTaskUpdate(request);
        case '/v1/worker/poll':
          return await this.swarm.handleWorkerPoll(request);

        // --- Webhooks ---
        case '/webhooks/linear':
          return await this.webhooks.handleLinearWebhook(request);
        case '/webhooks/github':
          return await this.webhooks.handleGitHubWebhook(request);

        // --- Admin & LLM ---
        case '/jobs':
          if (request.method === 'POST') return await this.admin.createJob(request);
          return new Response(JSON.stringify(Object.values(this.stateManager.jobs)), { headers: { 'Content-Type': 'application/json' } });
        case '/v2/chat':
          return await this.handleV2Chat(request);
        case '/admin/seed-test-issues':
          return await this.admin.seedTestIssues();
        case '/admin/post-update':
          return await this.admin.postProjectHealth();
        case '/v1/admin/batch':
          return await this.admin.handleBatchTrigger(request);
        case '/v1/admin/wipe':
          if (request.method === 'POST') {
            await this.stateManager.wipe();
            return new Response('OK');
          }
          return new Response('Forbidden', { status: 403 });

        default:
          return new Response('Not found', { status: 404 });
      }
    } catch (e: any) {
      await this.logError(e.message, 'DO_FETCH', e);
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  // ---- Support Methods ----

  private checkConfig(): Response | null {
    const missing: string[] = [];
    if (!this.config.proxyApiKey) missing.push('PROXY_API_KEY');
    if (!this.config.linear.apiKey) missing.push('LINEAR_API_KEY');
    if (!this.config.llm.geminiKey) missing.push('GEMINI_API_KEY');

    if (missing.length > 0) {
      return new Response(`Config Error: Missing [${missing.join(', ')}]`, { status: 503 });
    }
    return null;
  }

  private async logError(message: string, context: string, error?: any) {
    console.error(`[${context}] ${message}`, error);
    await this.stateManager.logError({
      timestamp: Date.now(),
      message,
      context,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  private async handleV2Chat(request: Request): Promise<Response> {
    const body = await request.json() as any;
    if (!body.messages) return new Response('Missing messages', { status: 400 });

    const result = await this.llmManager.routeLLM(body);
    return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
  }
}
