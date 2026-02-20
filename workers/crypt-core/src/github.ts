import { SignJWT, importPKCS8 } from 'jose';

interface GitHubAppConfig {
  appId: string;
  privateKey: string;
  installationId: string;
}

/**
 *
 */
export class GitHubClient {
  private baseUrl = 'https://api.github.com';
  private token: string | null = null;
  private tokenExpiry: number = 0;

  /**
   *
   */
  constructor(private config: GitHubAppConfig) {}

  /**
   * Generate a JWT for GitHub App authentication
   */
  private async generateJWT(): Promise<string> {
    const privateKey = await importPKCS8(this.config.privateKey, 'RS256');
    return new SignJWT({ iss: this.config.appId })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setExpirationTime('10m') // Max 10 min
      .sign(privateKey);
  }

  /**
   * Get an Installation Access Token
   */
  public async getAccessToken(): Promise<string> {
    // Reuse token if valid (with 1 min buffer)
    if (this.token && Date.now() < this.tokenExpiry - 60000) {
      return this.token;
    }

    const jwt = await this.generateJWT();
    const response = await fetch(
      `${this.baseUrl}/app/installations/${this.config.installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Bifrost-Jules-Agent',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`);
    }

    const data = (await response.json()) as { token: string; expires_at: string };
    this.token = data.token;
    this.tokenExpiry = new Date(data.expires_at).getTime();

    return this.token;
  }

  /**
   * Make an authenticated request to GitHub API
   */
  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Bifrost-Jules-Agent',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`GitHub API error ${response.status} on ${path}: ${errorBody}`);
    }

    // Handle 204 No Content
    if (response.status === 204) return null;

    return await response.json();
  }

  /**
   *
   */
  async getRef(owner: string, repo: string, ref: string): Promise<any> {
    return await this.request(`/repos/${owner}/${repo}/git/ref/${ref}`);
  }

  /**
   *
   */
  async createBranch(owner: string, repo: string, base: string, name: string): Promise<any> {
    // 1. Get sha of base branch
    const baseRef = await this.getRef(owner, repo, `heads/${base}`);
    const sha = baseRef.object.sha;

    // 2. Create new ref
    return await this.request(`/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${name}`,
        sha,
      }),
    });
  }

  /**
   *
   */
  async getPullRequest(owner: string, repo: string, number: number) {
    return await this.request(`/repos/${owner}/${repo}/pulls/${number}`);
  }

  /**
   *
   */
  async createReviewComment(
    owner: string,
    repo: string,
    pullNumber: number,
    body: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT',
  ) {
    return await this.request(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ body, event }),
    });
  }

  /**
   *
   */
  async addIssueComment(owner: string, repo: string, issueNumber: number, body: string) {
    return await this.request(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    });
  }

  /**
   *
   */
  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string,
  ) {
    return await this.request(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: JSON.stringify({ title, body, head, base }),
    });
  }

  /**
   *
   */
  async mergePullRequest(
    owner: string,
    repo: string,
    pullNumber: number,
    method: 'merge' | 'squash' | 'rebase' = 'squash',
  ) {
    return await this.request(`/repos/${owner}/${repo}/pulls/${pullNumber}/merge`, {
      method: 'PUT',
      body: JSON.stringify({ merge_method: method }),
    });
  }
}
