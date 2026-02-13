
import http from 'http';

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
        status: 'online',
        message: 'Worker Bee is buzzing! 🐝',
        timestamp: new Date().toISOString()
    }));
});


import './agent'; // Start the agent loop

server.listen(PORT, () => {

    console.log(`Worker Bee started on port ${PORT}`);
});

