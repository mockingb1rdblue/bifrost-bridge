import { RunCommandHandler } from './workers/worker-bees/src/handlers/RunCommandHandler';

async function test() {
  const handler = new RunCommandHandler();
  const result = await handler.execute({
    id: 'test-job',
    type: 'run_command',
    payload: {
      command: 'echo',
      args: ['Hello from Sluagh Swarm!'],
    },
  });

  console.log('Result:', JSON.stringify(result, null, 2));
}

test();
