/// <reference types="@cloudflare/workers-types" />

export interface Job {
  id: string;
  type: 'ingestion' | 'orchestration' | 'cleanup';
  status: 'pending' | 'processing' | 'awaiting_hitl' | 'completed' | 'failed';
  priority: number;
  payload: any;
  result?: any;
  error?: string;
  linearIssueId?: string;
  linearIdentifier?: string;
  createdAt: number;
  updatedAt: number;
}

export interface JulesTask {
  id: string;
  issueId: string;
  type: 'edit' | 'refactor' | 'test' | 'doc';
  title: string;
  description: string;
  files: string[];
  status: 'pending' | 'active' | 'completed' | 'failed' | 'blocked';
  priority: number;
  isHighRisk: boolean;
  handoverContext?: string;
  engineeringLog?: EngineeringLog;
  createdAt: number;
  updatedAt: number;
}

export interface EngineeringLog {
  taskId: string;
  whatWasDone: string;
  diff: string;
  whatWorked: string[];
  whatDidntWork: string[];
  lessonsLearned: string[];
}

export interface RateLimitState {
  tokens: number;
  lastRefill: number;
}

export interface SystemError {
  timestamp: number;
  message: string;
  context: string;
  stack?: string;
}

export interface RouterMetrics {
  totalRequests: number;
  tokensConsumed: number;
  errorCount: number;
  startTime: number;
}

export interface RouterState {
  jobs: Record<string, Job>;
  julesTasks: Record<string, JulesTask>;
  rateLimits: Record<string, RateLimitState>;
  metrics: RouterMetrics;
  recentErrors: SystemError[];
  lastMaintenance: number;
}

// Env is now auto-generated in worker-configuration.d.ts
