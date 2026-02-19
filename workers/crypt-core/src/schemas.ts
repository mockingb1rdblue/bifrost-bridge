import { z } from 'zod';

export const JobPayloadSchema = z.object({
  type: z.enum(['orchestration', 'ingestion', 'test', 'echo']),
  priority: z.number().int().min(0).max(100).optional().default(0),
  data: z.record(z.any()).optional().default({}),
});

export const JobUpdateSchema = z.object({
  status: z.enum(['pending', 'processing', 'awaiting_hitl', 'completed', 'failed']).optional(),
  priority: z.number().int().min(0).max(100).optional(),
  payload: z.record(z.any()).optional(),
  result: z.any().optional(),
  error: z.string().optional(),
  linearIssueId: z.string().optional(),
  linearIdentifier: z.string().optional(),
});

export const EngineeringLogSchema = z.object({
  taskId: z.string(),
  whatWasDone: z.string(),
  diff: z.string(),
  whatWorked: z.array(z.string()),
  whatDidntWork: z.array(z.string()),
  lessonsLearned: z.array(z.string()),
});

export const SluaghSwarmTaskSchema = z.object({
  id: z.string(),
  type: z.enum(['coding', 'verify', 'review']),
  title: z.string(),
  description: z.string(),
  files: z.array(z.string()).optional(),
  status: z.enum(['pending', 'active', 'completed', 'failed']),
  priority: z.number().default(5),
  isHighRisk: z.boolean().optional(),
  issueId: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  engineeringLog: EngineeringLogSchema.optional(),
  metadata: z.record(z.string()).optional(),
  prNumber: z.number().optional(),
  prUrl: z.string().optional(),
  repository: z
    .object({
      owner: z.string(),
      name: z.string(),
    })
    .optional(),
  reviewDecision: z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']).optional(),
  reviewBody: z.string().optional(),
});

export const SluaghSwarmTaskCreateSchema = SluaghSwarmTaskSchema.omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  engineeringLog: true,
  reviewDecision: true,
  reviewBody: true,
});

export const SluaghSwarmTaskUpdateSchema = z.object({
  taskId: z.string(),
  status: z.enum(['pending', 'active', 'completed', 'failed']).optional(),
  engineeringLog: EngineeringLogSchema.optional(),
  prNumber: z.number().optional(),
  prUrl: z.string().optional(),
  reviewDecision: z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']).optional(),
  reviewBody: z.string().optional(),
});

export const LinearWebhookSchema = z.object({
  action: z.enum(['create', 'update', 'remove']),
  type: z.enum(['Issue', 'Comment', 'Project', 'Cycle']),
  data: z.object({
    id: z.string(),
    identifier: z.string().optional(),
    title: z.string().optional(),
    state: z.object({ name: z.string() }).optional(),
    body: z.string().optional(),
    issueId: z.string().optional(),
  }),
});

export const GitHubActionSchema = z.object({
  action: z.enum(['get_pr', 'review', 'comment', 'create_pr', 'merge']),
  owner: z.string().min(1),
  repo: z.string().min(1),
  taskId: z.string().optional(),
  number: z.number().int().optional(),
  content: z
    .object({
      title: z.string().optional(),
      body: z.string().optional(),
      head: z.string().optional(),
      base: z.string().optional(),
      event: z.enum(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']).optional(),
      method: z.enum(['merge', 'squash', 'rebase']).optional(),
    })
    .optional()
    .default({}),
});
