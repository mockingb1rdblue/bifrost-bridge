
import { LinearClient } from '../src/linear-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

async function main() {
    dotenv.config({ path: path.join(__dirname, '../.env') });
    
    const apiKey = process.env.LINEAR_API_KEY;
    if (!apiKey) {
        console.error('Error: LINEAR_API_KEY not found in .env');
        process.exit(1);
    }

    try {
        const client = new LinearClient(apiKey, 'https://api.linear.app/graphql');
        console.log('Fetching projects...');
        const projects = await client.listProjects();
        console.log(`Found ${projects.length} projects:`);
        projects.forEach(p => {
            console.log(`- ${p.name} (${p.id}) Status: ${p.status.name}`);
        });
    } catch (error) {
        console.error('Error fetching projects:', error);
        process.exit(1);
    }
}

main();
