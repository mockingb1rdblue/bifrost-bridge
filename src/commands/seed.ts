
import chalk from 'chalk';
import ora from 'ora';
import { Command } from 'commander';
import { LinearClient } from '../linear-client';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const ROUTER_URL = process.env.REGISTRY_URL || 'https://crypt-core.mock1ng.workers.dev';
// Use ABYSSAL_ARTIFACT if available (Cloudflare), otherwise fallback for consistency
const API_KEY = process.env.ABYSSAL_ARTIFACT || 'test-key-default';

interface IssueSeed {
    title: string;
    description: string;
}

const MISSING_ISSUES: IssueSeed[] = [
    {
        title: "Update Main README with Event Sourcing Section",
        description: `### Context: Root README doesn't mention Annals of Ankou or event sourcing.
### Impact: Onboarding clarity for new developers and agents.
### Autonomy: greenfield | Complexity: simple | Est: 10 mins

**Acceptance Criteria**:
- File modified: README.md
- Verification: grep -i 'annals of ankou' README.md (At least one match)

**Implementation**:
1. Add "Event Sourcing" section after "Architecture"
2. Explain role of Annals of Ankou in 2-3 sentences
3. Link to workers/annals-of-ankou/ARCHITECTURE.md
4. Add one-liner: "All swarm actions are immutably logged for audit trails"`
    },
    {
        title: "Document Sluagh Swarm Polling Mechanism",
        description: `### Context: Agent polling loop lacks documentation.
### Impact: Understanding of autonomous agent lifecycle.
### Autonomy: greenfield | Complexity: simple | Est: 10 mins

**Acceptance Criteria**:
- File modified: workers/sluagh-swarm/src/agent.ts
- Verification: grep -c '@description|@see|@example' workers/sluagh-swarm/src/agent.ts (> 3)

**Implementation**:
1. Add block comment above pollQueue() explaining FIFO logic
2. Document retry and backoff behavior
3. Add example of successful poll -> execute -> complete cycle
4. Link to crypt-core queue documentation`
    },
    {
        title: "Add Integration Test for /append Endpoint",
        description: `### Context: Annals of Ankou endpoint untested.
### Impact: Verify end-to-end event persistence.
### Autonomy: supervised | Complexity: simple | Est: 15 mins

**Acceptance Criteria**:
- File created: workers/annals-of-ankou/test/integration.test.ts
- Verification: npm test -- integration.test.ts (PASS)

**Implementation**:
1. Spin up local miniflare instance
2. POST event to /append
3. Query /history to verify persistence
4. Check SQLite row count
5. Teardown test environment`
    }
];

export function registerSeedCommand(program: Command) {
    const seed = program.command('seed').description('Seed the environment with data');

    seed
        .command('swarm')
        .description('Seed 5 test issues to Linear for Sluagh Swarm testing')
        .action(async () => {
            const spinner = ora('Seeding swarm issues...').start();
            try {
                // Logic from scripts/seed-5-test-issues.ts would go here
                // For now, we'll implement a simple version or call the router
                // Since the original script just called the router, we replicate that.

                // This is a placeholder for the actual "seed 5 issues" logic
                // In the original script (seed-5-test-issues.ts), it called `npx tsx scripts/seed-5-test-issues.ts`
                // which did: `createIssue({...})`

                // Let's implement directly via Linear Client if possible, OR call the router provided in the script.
                // The script `scripts/seed-missing-issues.js` calls the router.

                spinner.text = 'Triggering remote seeding...';

                // We'll mimic the "seed missing issues" logic here as it's more comprehensive
                for (const issue of MISSING_ISSUES) {
                    spinner.text = `Creating: ${issue.title}`;
                    await createIssueViaRouter(issue);
                }

                spinner.succeed('Seeding complete.');
            } catch (error) {
                spinner.fail(`Seeding failed: ${(error as Error).message}`);
                process.exit(1);
            }
        });

    seed
        .command('missing')
        .description('Seed specific missing issues defined in the codebase')
        .action(async () => {
            const spinner = ora('Seeding missing issues...').start();
            try {
                for (const issue of MISSING_ISSUES) {
                    spinner.text = `Creating: ${issue.title}`;
                    await createIssueViaRouter(issue);
                }
                spinner.succeed('Missing issues seeded.');
            } catch (error) {
                spinner.fail(`Seeding failed: ${(error as Error).message}`);
                process.exit(1);
            }
        });
}

async function createIssueViaRouter(issue: IssueSeed) {
    // We use the router endpoint as defined in scripts/seed-missing-issues.js
    // URL: `${ROUTER_URL}/admin/linear/create-issue`

    const response = await fetch(`${ROUTER_URL}/admin/linear/create-issue`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            title: issue.title,
            description: issue.description,
            labels: ["sluagh:autonomous", "type:feature", "complexity:simple"]
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to create issue: ${response.status} ${await response.text()}`);
    }

    return await response.json();
}
