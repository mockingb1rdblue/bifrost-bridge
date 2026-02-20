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
          }
        }
      }
    `;

    const data = await this.query<{ projects: { nodes: any[] } }>(query);
    return data.projects.nodes;
  }

  async listLabels(teamId: string): Promise<any[]> {
    const query = `
        query Labels {
          issueLabels(filter: { team: { id: { eq: "${teamId}" } } }) {
            nodes {
              id
              name
              color
            }
          }
        }
      `;
    const data = await this.query<{ issueLabels: { nodes: any[] } }>(query);
    return data.issueLabels.nodes;
  }

  async updateIssue(
    issueId: string,
    input: {
      labelIds?: string[];
      stateId?: string;
      title?: string;
    },
  ): Promise<boolean> {
    const mutation = `
        mutation IssueUpdate($id: String!, $input: IssueUpdateInput!) {
            issueUpdate(id: $id, input: $input) {
                success
            }
        }
      `;
    const result = await this.query<{ issueUpdate: { success: boolean } }>(mutation, {
      id: issueId,
      input,
    });
    return result.issueUpdate.success;
  }

  async createLabel(input: { teamId: string; name: string; color: string }): Promise<string> {
    const mutation = `
        mutation LabelCreate($teamId: String!, $name: String!, $color: String!) {
            issueLabelCreate(input: { teamId: $teamId, name: $name, color: $color }) {
                issueLabel { id }
            }
        }
      `;
    const data = await this.query<{ issueLabelCreate: { issueLabel: { id: string } } }>(
      mutation,
      input,
    );
    return data.issueLabelCreate.issueLabel.id;
  }

  async listMilestones(projectId: string): Promise<any[]> {
    const query = `
        query Milestones($projectId: String!) {
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
    const data = await this.query<{ project: { milestones: { nodes: any[] } } }>(query, {
      projectId,
    });
    return data.project.milestones.nodes;
  }

  async getLabelIdByName(teamId: string, name: string): Promise<string | undefined> {
    const labels = await this.listLabels(teamId);
    return labels.find((l) => l.name === name)?.id;
  }

  async addLabel(issueId: string, labelName: string): Promise<boolean> {
    const labelId = await this.getLabelIdByName(this.teamId, labelName);
    if (!labelId) return false;

    // First get current labels to avoid overwriting
    const query = `
      query IssueLabels($id: String!) {
        issue(id: $id) {
          labels { nodes { id } }
        }
      }
    `;
    const data = await this.query<{ issue: { labels: { nodes: { id: string }[] } } }>(query, {
      id: issueId,
    });
    const currentLabelIds = data.issue.labels.nodes.map((l) => l.id);

    if (currentLabelIds.includes(labelId)) return true;

    return this.updateIssue(issueId, { labelIds: [...currentLabelIds, labelId] });
  }

  async removeLabel(issueId: string, labelName: string): Promise<boolean> {
    const labelId = await this.getLabelIdByName(this.teamId, labelName);
    if (!labelId) return false;

    const query = `
      query IssueLabels($id: String!) {
        issue(id: $id) {
          labels { nodes { id } }
        }
      }
    `;
    const data = await this.query<{ issue: { labels: { nodes: { id: string }[] } } }>(query, {
      id: issueId,
    });
    const currentLabelIds = data.issue.labels.nodes.map((l) => l.id);

    if (!currentLabelIds.includes(labelId)) return true;

    return this.updateIssue(issueId, { labelIds: currentLabelIds.filter((id) => id !== labelId) });
  }

  async listIssuesByLabel(labelName: string): Promise<any[]> {
    const query = `
        query IssuesByLabel {
          issues(filter: { 
            team: { id: { eq: "${this.teamId}" } },
            labels: { name: { eq: "${labelName}" } },
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
    const data = await this.query<{ issues: { nodes: any[] } }>(query);
    return data.issues.nodes;
  }

  async getStateIdByName(name: string): Promise<string | undefined> {
    const query = `
      query States($teamId: String!) {
        workflowStates(filter: { team: { id: { eq: $teamId } } }) {
          nodes {
            id
            name
          }
        }
      }
    `;
    const data = await this.query<{ workflowStates: { nodes: { id: string; name: string }[] } }>(
      query,
      { teamId: this.teamId },
    );
    return data.workflowStates.nodes.find((s) => s.name.toLowerCase() === name.toLowerCase())?.id;
  }

  async postProjectUpdate(
    projectId: string,
    input: {
      health: 'onTrack' | 'atRisk' | 'offTrack';
      body: string;
    },
  ): Promise<boolean> {
    const mutation = `
        mutation ProjectUpdateCreate($projectId: String!, $health: ProjectUpdateHealthType!, $body: String!) {
            projectUpdateCreate(input: { projectId: $projectId, health: $health, body: $body }) {
                success
            }
        }
      `;
    const data = await this.query<{ projectUpdateCreate: { success: boolean } }>(mutation, {
      projectId,
      health: input.health,
      body: input.body,
    });
    return data.projectUpdateCreate.success;
  }
}
