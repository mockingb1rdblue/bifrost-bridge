import 'dotenv/config';

const ROUTER_URL = process.env.ROUTER_URL || 'https://bifrost-router.fly.dev'; // Adjust as needed
const API_KEY = process.env.PROXY_API_KEY;

if (!API_KEY) {
  console.error('PROXY_API_KEY is required');
  process.exit(1);
}

async function run() {
  console.log(`🚀 Triggering Swarm Review Verification on ${ROUTER_URL}`);

  // 1. Trigger Orchestration Task (Simulate Linear Issue)
  const payload = {
    issueIdentifier: 'TEST-REVIEW-1',
    issueTitle: 'Verify Swarm Self-Review Capability',
    issueId: 'test-issue-review-id-' + Date.now(),
    description:
      'Create a simple "hello_review.ts" file to test autonomous PR creation and review.',
  };

  console.log('Sending Trigger Payload:', payload);

  try {
    const response = await fetch(`${ROUTER_URL}/v1/swarm/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error('Failed to trigger:', await response.text());
      process.exit(1);
    }

    const job = (await response.json()) as any;
    console.log(`✅ Job Created: ${job.id}`);
    console.log('Use Cloudflare Dashboard or Linear to monitor progress.');
    console.log(
      'Expected Flow: Orchestration -> Coding (creates PR) -> Review (comments on PR) -> Verify (tests)',
    );
  } catch (e: any) {
    console.error('Error:', e.message);
  }
}

run();
