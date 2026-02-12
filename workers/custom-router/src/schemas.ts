import { z } from 'zod';

export const JobPayloadSchema = z.object({
  type: z.enum(['orchestration', 'ingestion', 'test']),
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

export const JulesTaskSchema = z.object({
  issueId: z.string().min(1),
  type: z.enum(['edit', 'create', 'research', 'test']).optional().default('edit'),
  title: z.string().min(1),
  description: z.string().min(1),
  files: z.array(z.string()).optional().default([]),
  priority: z.number().int().optional().default(0),
  isHighRisk: z.boolean().optional().default(false),
});

export const JulesTaskUpdateSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(['pending', 'active', 'completed', 'failed', 'paused']),
  engineeringLog: z
    .object({
      taskId: z.string(),
      whatWasDone: z.string(),
      diff: z.string(),
      whatWorked: z.array(z.string()),
      whatDidntWork: z.array(z.string()),
      lessonsLearned: z.array(z.string()),
    })
    .optional(),
});

export const LinearWebhookSchema = z.object({
  action: z.enum(['create', 'update', 'remove']),
  type: z.enum(['Issue', 'Comment', 'Project', 'Cycle']),
  data: z.object({
    id: z.string(),
    state: z.object({ name: z.string() }).optional(),
    body: z.string().optional(),
    issueId: z.string().optional(),
  }),
});

export const GitHubActionSchema = z.object({
  action: z.enum(['get_pr', 'review', 'comment', 'create_pr', 'merge']),
  owner: z.string().min(1),
  repo: z.string().min(1),
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
