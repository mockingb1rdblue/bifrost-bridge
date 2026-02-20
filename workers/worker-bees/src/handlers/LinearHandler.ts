import { Job, JobResult, JobHandler } from '../agent';

interface LinearActionPayload {
  action: 'create_issue' | 'update_issue' | 'list_issues' | 'create_comment';
  params: Record<string, any>;
}

/**
 *
 */
export class LinearHandler implements JobHandler {
  type = 'linear_action';

  /**
   *
   */
  async execute(job: Job): Promise<JobResult> {
    const payload = job.payload as LinearActionPayload;
    const { action, params } = payload;

    // We use the FetchUrlHandler logic internally but specialized for Linear
    // OR we can use the SDK. For now, let's use raw fetch to avoid heavy dependency layers in the microVM if possible,
    // BUT we have the SDK installed in the project.
    // Actually, let's use the SDK approach but dynamic import to keep startup fast?
    // No, let's stick to fetch for "Zero Dependency" purity if we can, OR just use the installed SDK.
    // We already have @linear/sdk in package.json. Let's use it.

    const API_KEY = process.env.LINEAR_API_KEY;
    if (!API_KEY) {
      return { success: false, error: 'Missing LINEAR_API_KEY env var' };
    }

    try {
      // Dynamic import to avoid load-time issues if SDK isn't fully compatible with some runtimes (though Node 18 is fine)
      const { LinearClient } = await import('@linear/sdk');
      const linear = new LinearClient({ apiKey: API_KEY });

      console.log(`[LinearHandler] Action: ${action}`);

      let data;
      switch (action) {
        case 'create_issue':
          data = await linear.createIssue(params as any);
          break;
        case 'update_issue':
          data = await linear.updateIssue(params.id, params as any);
          break;
        case 'create_comment':
          data = await linear.createComment(params as any);
          break;
        // Add more as needed
        default:
          return { success: false, error: `Unsupported Linear action: ${action}` };
      }

      // The SDK returns a complex object, we might need to await the payload
      // createIssue returns { success, issue: Promise<Issue> }
      const result = (await (data as any).issue) || (await (data as any).comment) || data;

      // Serialize what we need (resolving the promise if it's a mutation payload)
      // Linear SDK mutations return { success: boolean, [entity]: Promise<Entity> }
      // We need to resolve that "entity" promise.

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Linear Error: ${error.message}`,
      };
    }
  }
}
