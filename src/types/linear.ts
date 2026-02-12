/**
 * Linear API types
 */

export interface LinearProject {
  id: string;
  name: string;
  description?: string;
  status: {
    id: string;
    name: string;
    type: string;
  };
  targetDate?: string;
  progress: number;
  teamIds: string[];
}

export interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description?: string;
  status: {
    name: string;
    type: string;
  };
  priority: number;
  assignee?: {
    id: string;
    name: string;
  };
}

export interface LinearGraphQLResponse<T> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

/**
 * Error types for Linear integration
 */
export class LinearError extends Error {
  constructor(
    message: string,
    public readonly upstream?: any,
  ) {
    super(message);
    this.name = 'LinearError';
  }
}

export class LinearAuthenticationError extends LinearError {
  constructor(message: string = 'Invalid Linear API Key') {
    super(message);
    this.name = 'LinearAuthenticationError';
  }
}

export class LinearNetworkError extends LinearError {
  constructor(message: string, upstream?: any) {
    super(message, upstream);
    this.name = 'LinearNetworkError';
  }
}
