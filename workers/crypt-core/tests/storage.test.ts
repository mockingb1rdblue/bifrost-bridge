import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';

describe('Storage Persistence', () => {
  it('persists jobs correctly', async () => {
    const id = env.ROUTER_DO.idFromName('storage-test');
    const stub = env.ROUTER_DO.get(id);

    // Create a job
    const createRes = await stub.fetch('http://example.com/jobs', {
      method: 'POST',
      body: JSON.stringify({
        type: 'orchestration',
        priority: 10,
        data: { foo: 'bar' },
      }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + 'test-key-storage',
      },
    });
    if (createRes.status !== 201) {
      console.error('Create job failed:', await createRes.text());
    }
    expect(createRes.status).toBe(201);
    const job: any = await createRes.json();
    const jobId = job.id;

    // Verify it exists in list
    const listRes = await stub.fetch('http://example.com/jobs', {
      headers: { Authorization: 'Bearer ' + 'test-key' },
    });
    const jobs: any[] = await listRes.json();
    expect(jobs.find((j: any) => j.id === jobId)).toBeDefined();

    // Verify individual job lookup (path startsWith('/jobs/'))
    const detailRes = await stub.fetch(`http://example.com/jobs/${jobId}`, {
      headers: { Authorization: 'Bearer ' + 'test-key' },
    });
    const detailJob: any = await detailRes.json();
    expect(detailJob.id).toBe(jobId);
    expect(detailJob.payload.foo).toBe('bar');
  });

  it('manages Jules tasks with priority and status transitions', async () => {
    const id = env.ROUTER_DO.idFromName('jules-storage-test');
    const stub = env.ROUTER_DO.get(id);

    // 1. Create low priority task
    await stub.fetch('http://example.com/v1/swarm/tasks', {
      method: 'POST',
      body: JSON.stringify({
        issueId: 'ISS-LOW',
        title: 'Low Priority Task',
        description: 'This is low',
        priority: 1,
        type: 'coding',
      }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + 'test-key-storage',
      },
    });

    // 2. Create high priority task
    await stub.fetch('http://example.com/v1/swarm/tasks', {
      method: 'POST',
      body: JSON.stringify({
        issueId: 'ISS-HIGH',
        title: 'High Priority Task',
        description: 'This is high',
        priority: 50,
        type: 'coding',
      }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + 'test-key-storage',
      },
    });

    // 3. Get next task - should be High Priority
    const nextRes = await stub.fetch('http://example.com/v1/swarm/next', {
      headers: { Authorization: 'Bearer ' + 'test-key' },
    });
    expect(nextRes.status).toBe(200);
    const nextTask: any = await nextRes.json();
    expect(nextTask.title).toBe('High Priority Task');
    expect(nextTask.status).toBe('active');

    // 4. Update task to completed
    const updateRes = await stub.fetch('http://example.com/v1/swarm/update', {
      method: 'POST',
      body: JSON.stringify({
        taskId: nextTask.id,
        status: 'completed',
        engineeringLog: {
          taskId: nextTask.id,
          whatWasDone: 'Fixed everything',
          diff: '--- old\n+++ new',
          whatWorked: ['Thinking'],
          whatDidntWork: ['Giving up'],
          lessonsLearned: ['Persistence pays'],
        },
      }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + 'test-key-storage',
      },
    });
    // 5. Verify next task is now the low priority one
    const nextRes2 = await stub.fetch('http://example.com/v1/swarm/next', {
      headers: { Authorization: 'Bearer ' + 'test-key' },
    });
    const nextTask2: any = await nextRes2.json();
    expect(nextTask2.title).toContain('Verify: High Priority Task');
    expect(nextTask2.type).toBe('verify');

    // Complete the verify task to unblock the queue -> this currently triggers a fix task since we aren't providing success criteria in the mock.
    await stub.fetch('http://example.com/v1/swarm/update', {
      method: 'POST',
      body: JSON.stringify({ taskId: nextTask2.id, status: 'completed' }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + 'test-key-storage',
      },
    });

    const nextResFix = await stub.fetch('http://example.com/v1/swarm/next', {
      headers: { Authorization: 'Bearer ' + 'test-key' },
    });
    const nextTaskFix: any = await nextResFix.json();

    // Complete the fix task
    await stub.fetch('http://example.com/v1/swarm/update', {
      method: 'POST',
      body: JSON.stringify({ taskId: nextTaskFix.id, status: 'completed' }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + 'test-key-storage',
      },
    });

    // Complete the follow-up verify task
    const nextResVerify2 = await stub.fetch('http://example.com/v1/swarm/next', {
      headers: { Authorization: 'Bearer ' + 'test-key' },
    });
    const nextTaskVerify2: any = await nextResVerify2.json();

    await stub.fetch('http://example.com/v1/swarm/update', {
      method: 'POST',
      body: JSON.stringify({
        taskId: nextTaskVerify2.id,
        status: 'completed',
        engineeringLog: { decision: 'APPROVE' },
      }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + 'test-key-storage',
      },
    });

    // Verify the fix loop completed. It will return the original low priority now.
    const nextRes3 = await stub.fetch('http://example.com/v1/swarm/next', {
      headers: { Authorization: 'Bearer ' + 'test-key' },
    });
    const nextTask3: any = await nextRes3.json();
    expect(nextTask3.title).toBe('Low Priority Task');
  });

  it('returns 404 when no tasks are available', async () => {
    const id = env.ROUTER_DO.idFromName('empty-test');
    const stub = env.ROUTER_DO.get(id);

    const res = await stub.fetch('http://example.com/v1/swarm/next', {
      headers: { Authorization: 'Bearer ' + 'test-key' },
    });
    expect(res.status).toBe(404);
    const body: any = await res.json();
    expect(body.message).toBe('No tasks available');
  });
});
