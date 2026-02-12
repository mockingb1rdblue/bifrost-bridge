import {
  LinearProject,
  LinearIssue,
  LinearGraphQLResponse,
  LinearError,
  LinearAuthenticationError,
  LinearNetworkError,
} from './types/linear';
import { logger } from './utils/logger';
import { withRetry } from './utils/retry';

export class LinearClient {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL?: string) {
    let url = baseURL || process.env.LINEAR_WEBHOOK_URL || 'https://api.linear.app/graphql';

    // If the URL ends in /webhook, strip it to get the base proxy URL for GraphQL
    if (url.endsWith('/webhook')) {
      url = url.replace(/\/webhook$/, '');
    }

    this.apiKey = apiKey;
    this.baseURL = url;

    if (!this.apiKey) {
      throw new LinearAuthenticationError('Linear API key (or Proxy Key) is missing');
    }

    logger.info('Initializing LinearClient', { baseURL: this.baseURL });
  }

  /**
   * Generic GraphQL query executor
   */
  async query<T>(query: string, variables?: Record<string, any>): Promise<T> {
    // CIRCUIT BREAKER: Check for lockfile
    if (require('fs').existsSync('.auth.lock')) {
       // Read the lockfile to give context
       const lockContent = require('fs').readFileSync('.auth.lock', 'utf8');
       throw new Error(
         `\n⛔ CIRCUIT BREAKER ACTIVATED ⛔\n` +
         `--------------------------------\n` +
         `Execution blocked to protect your Linear API Key.\n` +
         `Reason: A previous 401 Unauthorized error was detected.\n` +
         `Context: ${lockContent}\n\n` +
         `WHY THIS HAPPENED:\n` +
         `Linear will automatically deactivate API keys if they generate consistent 401 errors.\n` +
         `We stopped to prevent this.\n\n` +
         `TO FIX:\n` +
         `1. Check your .env secrets (LINEAR_API_KEY, LINEAR_WEBHOOK_SECRET, PROXY_API_KEY).\n` +
         `2. Run 'npm start -- linear projects --direct' to verify the key works without the proxy.\n` +
         `3. Delete the lockfile to reset: 'rm .auth.lock' (or 'del .auth.lock' on Windows).\n`
       );
    }

    const makeRequest = async () => {
      try {
        // Only use 'Bearer ' prefix for proxies (workers.dev)
        const authValue = this.baseURL.includes('workers.dev')
          ? `Bearer ${this.apiKey}`
          : this.apiKey;

        const response = await fetch(this.baseURL, {
          method: 'POST',
          headers: {
            Authorization: authValue,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query, variables }),
        });

        if (!response.ok) {
          const text = await response.text();
          if (response.status === 401) {
            // CIRCUIT BREAKER: Trigger Lock
            const lockMsg = `401 Error at ${new Date().toISOString()}: ${text.substring(0, 100)}...`;
            require('fs').writeFileSync('.auth.lock', lockMsg);
            
            const helpMsg = `
  🛑 AUTHENTICATION FAILURE (401) 🛑
  ----------------------------------
  Your request was rejected.
  
  Possible Causes:
  1. The API Key or Webhook Secret is invalid or expired.
  2. The Proxy Key in .env does not match the Worker.
  
  🔒 SAFETY LOCK ENGAGED:
  A '.auth.lock' file has been created. All future requests will be blocked 
  until you delete this file. This prevents Linear from deactivating your key 
  due to excessive error rates.
  
  Action: Verify secrets at https://linear.app/settings/api before retrying.`;
  
            throw new LinearAuthenticationError(
              `${helpMsg}\n\nOriginal Error: ${text}`,
            );
          }
          throw new LinearError(`HTTP Error ${response.status}: ${text}`);
        }

        const result = (await response.json()) as LinearGraphQLResponse<T>;

        if (result.errors && result.errors.length > 0) {
          throw new LinearError(`GraphQL Error: ${result.errors[0].message}`, result.errors);
        }

        if (!result.data) {
          throw new LinearError('Empty data response from Linear');
        }

        return result.data;
      } catch (error) {
        if (error instanceof LinearError) throw error;
        throw new LinearNetworkError((error as Error).message, error);
      }
    };

    return withRetry(makeRequest, {
      maxAttempts: 3,
      initialDelayMs: 1000,
    });
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<LinearProject[]> {
    const query = `
            query {
                projects {
                    nodes {
                    id
                    name
                    description
                    status {
                        id
                        name
                        type
                    }
                    targetDate
                    progress
                    teams {
                        nodes {
                            id
                        }
                    }
                }
            }
        }
    `;

    const data = await this.query<{ projects: { nodes: any[] } }>(query);
    return data.projects.nodes.map((node) => ({
      ...node,
      status: node.status,
      teamIds: node.teams.nodes.map((t: any) => t.id),
    }));
  }

  /**
   * List issues for a project
   */
  async listIssues(projectId: string): Promise<LinearIssue[]> {
    const query = `
            query($projectId: String!) {
                project(id: $projectId) {
                    issues {
                        nodes {
                            id
                            identifier
                            title
                            description
                            priority
                            state {
                                name
                                type
                            }
                            assignee {
                                id
                                name
                            }
                        }
                    }
                }
            }
        `;

    const data = await this.query<{ project: { issues: { nodes: any[] } } }>(query, { projectId });
    return data.project.issues.nodes.map((node) => ({
      ...node,
      status: node.state,
    }));
  }

  /**
   * List all available project statuses
   */
  async listProjectStatuses(): Promise<any[]> {
    const query = `
            query {
                projectStatuses {
                    nodes {
                        id
                        name
                        type
                    }
                }
            }
        `;

    const data = await this.query<{ projectStatuses: { nodes: any[] } }>(query);
    return data.projectStatuses.nodes;
  }

  async updateProjectStatus(projectId: string, statusId: string): Promise<boolean> {
    const query = `
            mutation ProjectUpdate($id: String!, $input: ProjectUpdateInput!) {
                projectUpdate(id: $id, input: $input) {
                    success
                }
            }
        `;

    const variables = {
      id: projectId,
      input: {
        statusId: statusId,
      },
    };

    const data = await this.query<{ projectUpdate: { success: boolean } }>(query, variables);
    return data.projectUpdate.success;
  }

  /**
   * Get workflow states for a team
   */
  async getWorkflowStates(teamId?: string): Promise<any[]> {
    const query = `
            query {
                workflowStates {
                    nodes {
                        id
                        name
                        type
                        team {
                            id
                        }
                    }
                }
            }
        `;

    const data = await this.query<{ workflowStates: { nodes: any[] } }>(query);
    // data.workflowStates.nodes might contain states from multiple teams if API key has broad access
    // If teamId is provided, filter.
    let states = data.workflowStates.nodes;
    if (teamId) {
      states = states.filter((s) => s.team.id === teamId);
    }
    return states;
  }

  /**
   * Update an issue
   */
  async updateIssue(
    issueId: string,
    input: { stateId?: string; description?: string },
  ): Promise<boolean> {
    const query = `
            mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
                issueUpdate(id: $id, input: $input) {
                    success
                }
            }
        `;

    const data = await this.query<{ issueUpdate: { success: boolean } }>(query, {
      id: issueId,
      input,
    });
    return data.issueUpdate.success;
  }

  /**
   * Add a comment to an issue
   */
  async addComment(issueId: string, body: string): Promise<boolean> {
    const query = `
            mutation CommentCreate($input: CommentCreateInput!) {
                commentCreate(input: $input) {
                    success
                }
            }
        `;

    const data = await this.query<{ commentCreate: { success: boolean } }>(query, {
      input: { issueId, body },
    });
    return data.commentCreate.success;
  }

  /**
   * Create an issue
   */
  async createIssue(input: {
    teamId: string;
    title: string;
    description?: string;
    projectId?: string;
  }): Promise<any> {
    const query = `
            mutation IssueCreate($input: IssueCreateInput!) {
                issueCreate(input: $input) {
                    success
                    issue {
                        id
                        identifier
                        title
                        url
                    }
                }
            }
        `;

    const data = await this.query<{ issueCreate: { success: boolean; issue: any } }>(query, {
      input,
    });
    return data.issueCreate.issue;
  }
}
