const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');
try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    let proxyKey = '';

    // Naive .env parser
    const lines = envContent.split(/\r?\n/);
    for (const line of lines) {
        const match = line.match(/^PROXY_API_KEY=(.*)$/);
        if (match) {
            proxyKey = match[1].trim();
            // Remove quotes if present
            if ((proxyKey.startsWith('"') && proxyKey.endsWith('"')) || (proxyKey.startsWith("'") && proxyKey.endsWith("'"))) {
                proxyKey = proxyKey.slice(1, -1);
            }
            break;
        }
    }

    if (!proxyKey) {
        console.error('PROXY_API_KEY not found in .env');
        process.exit(1);
    }

    console.log(`Testing Proxy with Key length: ${proxyKey.length}`);
    console.log(`Key start: ${proxyKey.substring(0, 5)}...`);

    // Use native fetch (Node 18+)
    fetch('https://bifrost-bridge.mock1ng.workers.dev/graphql', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${proxyKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: "{ viewer { id } }" })
    })
    .then(async res => {
        console.log(`Status: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log('Body:', text);
    })
    .catch(err => console.error('Error:', err));

} catch (e) {
    console.error("Failed to read .env or run script:", e);
}
