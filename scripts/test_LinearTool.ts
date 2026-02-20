import { LinearHandler } from '../workers/worker-bees/src/handlers/LinearHandler';

// Mock process.env for test if needed, or rely on secure:exec to inject it
// verification: npm run secure:exec scripts/test_LinearTool.ts

async function test() {
  console.log('Testing LinearHandler...');
  const handler = new LinearHandler();

  // Test: List Issues (Mock/Simple) or just check instantiation
  // We can't easily execute without a valid key.
  // This script assumes it's run via `secure:exec` which provides LINEAR_API_KEY

  if (!process.env.LINEAR_API_KEY) {
    console.error('❌ No LINEAR_API_KEY found. Run with `npm run secure:exec`');
    return;
  }

  // We'll try to just instantiate the client by running a "read" action if possible
  // Note: The handler as written expects specific actions.
  // Let's try to 'create_issue' but we don't want to actually spam.
  // Maybe we just check if it throws on import?

  try {
    const { LinearClient } = await import('@linear/sdk');
    console.log('✅ @linear/sdk imported successfully.');
    const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });
    const me = await client.viewer;
    console.log(`✅ Authenticated as: ${me.name} (${me.email})`);
  } catch (e: any) {
    console.error('❌ Failed to authenticate:', e.message);
  }
}

test();
