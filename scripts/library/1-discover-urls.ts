import { PerplexityClient } from '../../workers/crypt-core/src/llm/perplexity';
import Database from 'better-sqlite3';
import path from 'path';

const API_KEY = process.env.PERPLEXITY_API_KEY;

if (!API_KEY) {
    console.error('❌ Missing PERPLEXITY_API_KEY! Because of the Zero Local Secrets policy, this is not stored in .env.');
    console.error('   Please run this script via Secure Connect:');
    console.error('   npm run secure:exec npx tsx scripts/library/1-discover-urls.ts "Target Name"');
    process.exit(1);
}

const db = new Database(path.resolve(__dirname, '../../.data/library.sqlite'));

async function discoverUrls(target: string) {
    console.log(`🔍 Asking Perplexity for official documentation sitemap for: ${target}`);
    const client = new PerplexityClient(API_KEY);

    const prompt = `Find the XML sitemap URL for the official developer documentation of ${target}. Return ONLY a valid JSON array of string URLs. Example: ["https://developers.cloudflare.com/sitemap.xml"]`;

    try {
        const response = await client.chat([{ role: 'user', content: prompt }], {
            model: 'sonar-pro' // Using sonar-pro for accurate search
        });

        let content = response.content.trim();
        // Clean up potential markdown blocks
        if (content.startsWith('```')) {
            content = content.replace(/^```(json)?/, '').replace(/```$/, '').trim();
        }

        const urls: string[] = JSON.parse(content);

        console.log(`✅ Found ${urls.length} sitemap(s):`, urls);

        const insert = db.prepare('INSERT OR IGNORE INTO scraped_urls (url, status) VALUES (?, ?)');
        db.transaction(() => {
            for (const url of urls) {
                insert.run(url, 'pending_sitemap');
            }
        })();

        console.log(`✅ Successfully queued sitemaps to library.sqlite.`);
    } catch (err) {
        console.error('❌ Failed to discover URLs:', err);
    }
}

const target = process.argv[2] || 'Cloudflare D1';
discoverUrls(target);
