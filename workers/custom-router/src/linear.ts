export interface LinearConfig {
  apiKey: string;
  teamId: string;
  projectId?: string;
}

export class LinearClient {
  private apiKey: string;
  private baseUrl = 'https://api.linear.app/graphql';

  constructor(config: LinearConfig) {
    this.apiKey = config.apiKey;
  }

  private async query<T>(query: string, variables?: any): Promise<T> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = (await response.json()) as any;
    if (result.errors) {
      throw new Error(`Linear API Error: ${JSON.stringify(result.errors)}`);
    }
    return result.data as T;
  }

  async createIssue(input: {
    title: string;
    description?: string;
    teamId: string;
    projectId?: string;
  }): Promise<{ id: string; identifier: string }> {
    const mutation = `
            mutation IssueCreate($input: IssueCreateInput!) {
                issueCreate(input: $input) {
                    success
                    issue {
                        id
                        identifier
                    }
                }
            }
        `;

    const result = await this.query<{
      issueCreate: { success: boolean; issue: { id: string; identifier: string } };
    }>(mutation, { input });

    return result.issueCreate.issue;
  }

  async addComment(issueId: string, body: string): Promise<boolean> {
    const mutation = `
            mutation CommentCreate($input: CommentCreateInput!) {
                commentCreate(input: $input) {
                    success
                }
            }
        `;

    const result = await this.query<{ commentCreate: { success: boolean } }>(mutation, {
      input: { issueId, body },
    });

    return result.commentCreate.success;
  }

  async listProjects(): Promise<any[]> {
    const query = `
      query {
        projects {
          nodes {
            id
            name
            description
            status {
              name
              type
            }
            progress
          }
        }
      }
    `;

    const data = await this.query<{ projects: { nodes: any[] } }>(query);
    return data.projects.nodes;
  }
}
