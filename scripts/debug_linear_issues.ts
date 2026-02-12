
import { LinearClient } from '../src/linear-client';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

// Certs
const certPath = path.join(__dirname, '../.certs/corporate_bundle.pem');
if (fs.existsSync(certPath)) {
  process.env.NODE_EXTRA_CA_CERTS = certPath;
}

if (fs.existsSync(certPath)) {
  process.env.NODE_EXTRA_CA_CERTS = certPath;
}

async function main() {
    let apiKey = process.env.LINEAR_API_KEY;
    const baseUrl = process.env.LINEAR_WEBHOOK_URL;

    // Smart Key Logic: if using proxy, use PROXY_API_KEY
    if (baseUrl && baseUrl.includes('workers.dev')) {
        console.log('🌐 Using Proxy Configuration');
        apiKey = process.env.PROXY_API_KEY;
    }

    const client = new LinearClient(apiKey!, baseUrl);
    console.log('✅ Authenticated');

    const issuesToFix = ['BIF-64', 'BIF-9'];
    
    for (const identifier of issuesToFix) {
        console.log(`\n🔍 Inspecting ${identifier}...`);
        
        // Custom query to get Team ID
        const query = `
            query($identifier: String!) {
                issue(id: $identifier) {
                    id
                    title
                    state {
                        id
                        name
                        type
                    }
                    team {
                        id
                        name
                    }
                }
            }
        `;
        
        try {
            const data = await client.query<{ issue: any }>(query, { identifier });
            const issue = data.issue;
            
            if (!issue) {
                console.error(`❌ Issue ${identifier} not found`);
                continue;
            }

            console.log(`   Title: ${issue.title}`);
            console.log(`   Current State: ${issue.state.name} (${issue.state.type})`);
            console.log(`   Team: ${issue.team.name} (${issue.team.id})`);

            // Fetch States for this Team
            const states = await client.getWorkflowStates(issue.team.id);
            console.log(`   Found ${states.length} states for team ${issue.team.name}`);

            let targetStateId;
            if (identifier === 'BIF-64') {
                // Target: Done / Completed
                const doneState = states.find(s => s.type === 'completed' || s.name === 'Done');
                if (doneState) {
                    targetStateId = doneState.id;
                    console.log(`   🎯 Target 'Done' State: ${doneState.name} (${doneState.id})`);
                    
                    // Update
                    console.log(`   ⏳ Updating ${identifier} to Done...`);
                    await client.updateIssue(issue.id, { stateId: targetStateId });
                    console.log(`   ✅ Success!`);
                } else {
                    console.error(`   ❌ No 'Completed' state found for team`);
                }
            } else if (identifier === 'BIF-9') {
                // Target: In Progress
                const progressState = states.find(s => s.type === 'started' || s.name === 'In Progress');
                if (progressState) {
                    targetStateId = progressState.id;
                    console.log(`   🎯 Target 'In Progress' State: ${progressState.name} (${progressState.id})`);
                     
                     // Update Description too
                     console.log(`   ⏳ Updating ${identifier} to In Progress...`);
                     await client.updateIssue(issue.id, { 
                         stateId: targetStateId,
                         description: "Implement Rate Limiting\n\nNote: 50% Complete. Token bucket in custom-router is done. Remaining: linear-proxy and perplexity-proxy."
                     });
                     console.log(`   ✅ Success!`);
                } else {
                    console.error(`   ❌ No 'In Progress' state found for team`);
                }
            }

        } catch (e: any) {
            console.error(`❌ Error processing ${identifier}:`, e.message);
            if (e.response) console.error(JSON.stringify(e.response, null, 2));
        }
    }
    
    // Cleanup Test Issues (BIF-65 to BIF-69)
    console.log('\n🧹 Cleaning up test issues...');
    const testIssues = ['BIF-65', 'BIF-66', 'BIF-67', 'BIF-68', 'BIF-69'];
    for (const testId of testIssues) {
         const query = `
            query($identifier: String!) {
                issue(id: $identifier) {
                    id
                    team { id }
                }
            }
        `;
        try {
            const data = await client.query<{ issue: any }>(query, { identifier: testId });
             if (data.issue) {
                 const states = await client.getWorkflowStates(data.issue.team.id);
                 const cancelState = states.find(s => s.type === 'canceled');
                 if (cancelState) {
                     console.log(`   🗑️ Canceling ${testId}...`);
                     await client.updateIssue(data.issue.id, { stateId: cancelState.id });
                 } else {
                     console.log(`   ⚠️ No 'Canceled' state for ${testId}`);
                 }
             } else {
                 console.log(`   ⚠️ Issue ${testId} not found (maybe already deleted)`);
             }
        } catch (e) {}
    }
}

main().catch(console.error);
