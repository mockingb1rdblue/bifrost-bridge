import { Env } from '../types';
import { LinearWebhookSchema } from '../schemas';
import { verifyLinearSignature, verifyGitHubSignature } from '../utils/crypto';
import { RouterConfig } from './config';
import { RouterDependencies } from './dependencies';
import { RouterStateManager } from './state';

/**
 * RouterWebhookHandler: Manages incoming webhooks from Linear and GitHub.
 */
export class RouterWebhookHandler {
  constructor(
    private config: RouterConfig,
    private deps: RouterDependencies,
    private stateManager: RouterStateManager
  ) {}

  /**
   * Checks with GOVERNANCE_DO if a request is allowed.
   */
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

  /**
   * Handles Linear webhook events (Issue updates, comments).
   */
  async handleLinearWebhook(request: Request): Promise<Response> {
    try {
      await this.checkGovernance('ingress-webhook');
      const signature = request.headers.get('Linear-Signature');
      if (!signature) return new Response('Missing signature', { status: 400 });

      const rawBody = await request.text();
      if (!verifyLinearSignature(rawBody, signature, this.config.linear.webhookSecret)) {
        return new Response('Invalid signature', { status: 401 });
      }

      const body = JSON.parse(rawBody);
      const result = LinearWebhookSchema.safeParse(body);
      if (!result.success) return new Response('Invalid payload', { status: 400 });

      const payload = result.data;
      if (payload.type === 'Issue' && payload.action === 'update') {
        const stateName = payload.data.state?.name;
        if (stateName === 'In Progress') {
          const issueId = payload.data.id;
          const issueIdentifier = (payload as any).data.identifier;
          const issueTitle = (payload as any).data.title;

          const jobId = crypto.randomUUID();
          await this.stateManager.saveJob({
            id: jobId,
            type: 'orchestration',
            status: 'pending',
            priority: 10,
            topic: issueIdentifier,
            correlationId: crypto.randomUUID(),
            payload: {
              action: 'initialize_and_plan',
              issueIdentifier,
              issueTitle,
              issueId,
              description: (payload as any).data.description || '',
            },
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });

          await this.deps.events.append({
            type: 'SWARM_TRIGGERED',
            source: 'custom-router',
            topic: issueIdentifier,
            payload: { issueIdentifier, jobId },
          });
        }
      }

      return new Response('OK');
    } catch (e: any) {
      console.error('[LinearWebhookHandler] Error:', e.message);
      return new Response(e.message, { status: 400 });
    }
  }

  /**
   * Handles GitHub webhook events (PR events).
   */
  async handleGitHubWebhook(request: Request): Promise<Response> {
    try {
      await this.checkGovernance('ingress-github');
      const signature = request.headers.get('X-Hub-Signature-256');
      if (!signature) return new Response('Missing signature', { status: 400 });

      const rawBody = await request.text();
      if (!verifyGitHubSignature(rawBody, signature, this.config.github.webhookSecret)) {
        return new Response('Invalid signature', { status: 401 });
      }

      const payload = JSON.parse(rawBody);
      const event = request.headers.get('X-GitHub-Event');

      if (event === 'pull_request') {
        const pr = payload.pull_request;
        await this.deps.events.append({
          type: 'GITHUB_PR_EVENT',
          source: 'custom-router',
          topic: `repo/${payload.repository.full_name}`,
          payload: { action: payload.action, number: pr.number, url: pr.html_url },
        });
      }

      return new Response('OK');
    } catch (e: any) {
      console.error('[GitHubWebhookHandler] Error:', e.message);
      return new Response(e.message, { status: 400 });
    }
  }
}
