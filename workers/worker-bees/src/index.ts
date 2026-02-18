import http from 'http';
import { Job, JobResult, handlers, registerHandler } from './agent';
import { RunCommandHandler } from './handlers/RunCommandHandler';
import { FetchUrlHandler } from './handlers/FetchUrlHandler';

console.log('[Worker Bee] 🐝 Starting in HTTP Runner Mode');

// Register handlers
registerHandler(new RunCommandHandler());
registerHandler(new FetchUrlHandler());

const PORT = process.env.PORT || 8080;

const server = http.createServer(async (req, res) => {
    // Health check
    if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'online',
            mode: 'runner',
            version: '2.0.0'
        }));
        return;
    }

    // Execute endpoint
    if (req.method === 'POST' && req.url === '/execute') {
        const authHeader = req.headers['authorization'];
        const apiKey = process.env.WORKER_API_KEY || 'dev-key';

        if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
        }

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body);
                const { command, cwd } = payload;

                if (!command) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Missing command' }));
                    return;
                }

                console.log(`[Worker Bee] ⚡ Executing command: ${command}`);

                // Use the RunCommandHandler directly
                const handler = handlers['run_command'];
                if (!handler) {
                    throw new Error('RunCommandHandler not registered');
                }

                const job: Job = {
                    id: `req-${Date.now()}`,
                    type: 'run_command',
                    payload: { command, cwd }
                };

                const result: JobResult = await handler.execute(job);

                res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));

            } catch (e: any) {
                console.error('[Worker Bee] Execution failed:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end();
});

server.listen(PORT, () => {
    console.log(`Worker Bee (Runner Mode) listening on port ${PORT}`);
});
