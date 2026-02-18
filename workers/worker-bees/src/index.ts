
import http from 'http';
import { startAgent } from './agent';

console.log('[Original Bee] 🐝 process initializing');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: 'online',
        message: 'Worker Bee is buzzing! 🐝',
        timestamp: new Date().toISOString()
    }));
});

// Start the agent loop explicitly
try {
    startAgent();
} catch (e: any) {
    console.error('[Original Bee] Failed to start agent:', e);
}

server.listen(PORT, () => {
    console.log(`Worker Bee started on port ${PORT}`);
});
