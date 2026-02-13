export interface LinearConfig {
  apiKey: string;
  teamId: string;
  projectId?: string;
}

export class LinearClient {
  private apiKey: string;
  private teamId: string;
  private baseUrl = 'https://api.linear.app/graphql';

  constructor(config: LinearConfig) {
    this.apiKey = config.apiKey;
    this.teamId = config.teamId;
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
            milestones {
              nodes {
                id
                name
                description
                targetDate
                completedAt
              }
            }
          }
        }
      }
    `;

    const data = await this.query<{ projects: { nodes: any[] } }>(query);
    return data.projects.nodes;
  }

  async listLabels(teamId: string): Promise<any[]> {
      const query = `
        query Labels($teamId: String!) {
          issueLabels(filter: { team: { id: { eq: $teamId } } }) {
            nodes {
              id
              name
              color
            }
          }
        }
      `;
      const data = await this.query<{ issueLabels: { nodes: any[] } }>(query, { teamId });
      return data.issueLabels.nodes;
  }

  async updateIssue(issueId: string, input: {
      labelIds?: string[];
      stateId?: string;
      title?: string;
  }): Promise<boolean> {
      const mutation = `
        mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
                success
            }
        }
      `;
      const result = await this.query<{ issueUpdate: { success: boolean } }>(mutation, {
          id: issueId,
          input
      });
      return result.issueUpdate.success;
  }

  async listMilestones(projectId: string): Promise<any[]> {
      const query = `
        query Milestones($projectId: ID!) {
          project(id: $projectId) {
            milestones {
              nodes {
                id
                name
                description
                targetDate
                completedAt
              }
            }
          }
        }
      `;
      const data = await this.query<{ project: { milestones: { nodes: any[] } } }>(query, { projectId });
      return data.project.milestones.nodes;
  }

  async listIssuesByLabel(labelName: string): Promise<any[]> {
      const query = `
        query IssuesByLabel($teamId: String!, $labelName: String!) {
          issues(filter: { 
            team: { id: { eq: $teamId } },
            labels: { name: { eq: $labelName } },
            state: { name: { nin: ["Completed", "Canceled"] } }
          }) {
            nodes {
              id
              identifier
              title
              description
              state { id name }
              labels { nodes { id name } }
            }
          }
        }
      `;
      const data = await this.query<{ issues: { nodes: any[] } }>(query, { 
          teamId: this.teamId, 
          labelName 
      });
      return data.issues.nodes;
  }
}
