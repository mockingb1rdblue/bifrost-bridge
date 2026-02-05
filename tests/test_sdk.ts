import { PerplexityClient } from '../src/perplexity-client';
import { PERPLEXITY_MODELS } from '../src/models';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
    let apiKey = process.env.PERPLEXITY_API_KEY;
    const baseUrl = process.env.PERPLEXITY_BASE_URL;

    // Smart Key Selection
    if (baseUrl && baseUrl.includes('workers.dev')) {
        console.log("[*] Detected Proxy URL. Using PROXY_API_KEY for authentication.");
        apiKey = process.env.PROXY_API_KEY;
    }

    if (!apiKey) {
        console.error("[!] No API Key found. Set PERPLEXITY_API_KEY or PROXY_API_KEY.");
        process.exit(1);
    }

    const client = new PerplexityClient(apiKey, baseUrl);

    console.log("Testing Perplexity Connectivity...");
    console.log(`Base URL: ${process.env.PERPLEXITY_BASE_URL || 'Default'}`);
    console.log(`Model: ${PERPLEXITY_MODELS.SONAR}`);

    try {
        const response = await client.chat([
            { role: 'user', content: 'What is the speed velocity of an unladen swallow? (Short answer)' }
        ], { model: PERPLEXITY_MODELS.SONAR }) as any;

        console.log("\nSuccess!");
        console.log("Response:", response.choices[0].message.content);
    } catch (error) {
        console.error("\nFailed!", error);
    }
}

main();
