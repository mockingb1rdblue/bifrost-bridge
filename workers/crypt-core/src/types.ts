export interface Env {
  PROXY_API_KEY: string;
  LINEAR_API_KEY: string;
  LINEAR_WEBHOOK_SECRET: string;
  LINEAR_TEAM_ID: string;
  LINEAR_PROJECT_ID: string;
  GITHUB_APP_ID: string;
  GITHUB_PRIVATE_KEY: string;
  GITHUB_INSTALLATION_ID: string;
  GITHUB_WEBHOOK_SECRET: string;
  DEEPSEEK_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  GEMINI_API_KEY: string;
  PERPLEXITY_API_KEY: string;
  EVENTS_SECRET: string;
  EVENTS_URL: string;
  FLY_API_TOKEN: string;
  RATE_LIMIT_DEGRADATION_THRESHOLD?: string;
  RATE_LIMIT_MAX_TOKENS?: string;
  RATE_LIMIT_REFILL_RATE?: string;
  JULES_API_KEY: string;
  RUNNER_SECRET: string;
  ROUTER_DO: DurableObjectNamespace;
  GOVERNANCE_DO: DurableObjectNamespace;
}

export interface Job {
  id: string;
  type: 'ingestion' | 'orchestration' | 'runner_task' | 'run_command'; // run_command: dispatched by LinearIngestor
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

export interface CircuitBreakerState {
  state: 'closed' | 'open';
  failureCount: number;
  trippedAt?: number;
  reason?: string;
}

// ... keep existing definitions
export interface RouterState {
  jobs: Record<string, Job>;
  swarmTasks: Record<string, SluaghSwarmTask>;
  rateLimits: Record<string, RateLimitState>;
  metrics: RouterMetrics;
  recentErrors: ErrorLog[];
  lastMaintenance: number;
  circuitBreakers: Record<string, CircuitBreakerState>;
  ingestedIssueIds: string[];
}
export interface SluaghSwarmTask {
  id: string;
  issueId: string;
  type: 'feature' | 'bug' | 'chore' | 'coding' | 'verify' | 'review';
  title: string;
  description: string;
  files: string[];
  status: 'pending' | 'active' | 'in_progress' | 'completed' | 'failed';
  priority: number;
  isHighRisk: boolean;
  engineeringLog?: EngineeringLog;
  metadata?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  assignedTo?: string;
  prNumber?: number;
  repository?: {
    owner: string;
    name: string;
    token?: string;
  };
  prUrl?: string;
  reviewDecision?: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  reviewBody?: string;
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
