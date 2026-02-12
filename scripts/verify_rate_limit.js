const fs = require('fs');
const path = require('path');

// Read proxy key from .env
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const proxyKeyMatch = envContent.match(/PROXY_API_KEY=(.*)$/m);
const PROXY_KEY = proxyKeyMatch ? proxyKeyMatch[1].trim() : '';
const PROXY_URL = 'https://linear-proxy.mock1ng.workers.dev/graphql';

if (!PROXY_KEY) {
    console.error('Error: PROXY_API_KEY not found in .env');
    process.exit(1);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testRateLimit() {
    console.log(`Testing Rate Limit on ${PROXY_URL}`);
    console.log('Sending 105 requests rapidly...');
    
    const results = { allowed: 0, blocked: 0, errors: 0 };
    
    // Batch requests to simulate concurrency
    const batchSize = 10;
    for (let i = 0; i < 110; i += batchSize) {
        const promises = [];
        for (let j = 0; j < batchSize; j++) {
            promises.push(
                fetch(PROXY_URL, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${PROXY_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ query: "{ viewer { id } }" })
                }).then(res => res.status)
            );
        }
        
        const statuses = await Promise.all(promises);
        
        statuses.forEach(status => {
            if (status === 200) results.allowed++;
            else if (status === 429) results.blocked++;
            else {
                results.errors++;
                console.log(`Unexpected status: ${status}`);
            }
        });
        
        process.stdout.write('.');
    }
    
    console.log('\n\n--- Results ---');
    console.log(`Allowed: ${results.allowed} (Expected ~100)`);
    console.log(`Blocked: ${results.blocked} (Expected >0 if limit reached)`);
    console.log(`Errors:  ${results.errors}`);
    
    if (results.blocked > 0) {
        console.log('✅ Rate Limit Confirmed Active');
    } else {
        console.log('⚠️ Rate Limit Not Triggered (Did you deploy?)');
    }
}

testRateLimit().catch(console.error);
