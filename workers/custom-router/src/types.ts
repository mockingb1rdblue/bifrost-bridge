export interface Env {
  // ... existing
  FLY_API_TOKEN: string;
  EVENTS_SECRET: string;
  // ... others
  [key: string]: string | undefined;
}

export interface Job {
  id: string;
  type: 'ingestion' | 'orchestration' | 'runner_task'; // Added runner_task
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'awaiting_hitl';
  priority: number;
  payload: any;
  result?: any;
  error?: string;
  createdAt: number;
  updatedAt: number;
  linearIssueId?: string;
  linearIdentifier?: string;
  assignedTo?: string;
  startedAt?: number;
  completedAt?: number;
  topic?: string;
  correlationId?: string;
}

// ... keep existing definitions
export interface RouterState {
  jobs: Record<string, Job>;
  julesTasks: Record<string, JulesTask>;
  rateLimits: Record<string, RateLimitState>;
  metrics: RouterMetrics;
  recentErrors: ErrorLog[];
  lastMaintenance: number;
}
export interface JulesTask {
  id: string;
  issueId: string;
  type: 'feature' | 'bug' | 'chore';
  title: string;
  description: string;
  files: string[];
  status: 'pending' | 'active' | 'completed' | 'failed';
  priority: number;
  isHighRisk: boolean;
  engineeringLog?: EngineeringLog;
  createdAt: number;
  updatedAt: number;
}
export interface RateLimitState {
  tokens: number;
  lastRefill: number;
}
export interface RouterMetrics {
  totalRequests: number;
  totalTasks: number;
  tokensConsumed: number;
  errorCount: number;
  successCount: number;
  startTime: number;
  providerStats: Record<string, ProviderMetrics>;
}
export interface ProviderMetrics {
  requests: number;
  successes: number;
  failures: number;
  tokens: number;
}
export interface AgentMetrics {
  agentId: string;
  tasksCompleted: number;
  successRate: number;
  averageLatency: number;
  lastActive: number;
}
export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'critical';
  details: string;
  timestamp: number;
}
export interface ErrorLog {
  // ...
  timestamp: number;
  message: string;
  context: string;
  stack?: string;
}
export interface EngineeringLog {
  taskId: string;
  whatWasDone: string;
  diff: string;
  whatWorked: string[];
  whatDidntWork: string[];
  lessonsLearned: string[];
}
