/**
 * Batch create swarm-ready issues in Linear via Cloudflare Worker
 * Run: node scripts/create-swarm-issues.js
 */

const ROUTER_URL = process.env.ROUTER_URL || 'http://localhost:8787';
const API_KEY = process.env.API_KEY || 'test-key-default';

const swarmIssues = [
  {
    title: 'Add JSDoc to EventStoreClient Methods',
    description: `## Context
**Problem**: \`EventStoreClient\` in \`workers/crypt-core/src/events.ts\` lacks comprehensive documentation.
**Impact**: Enables agents to understand and maintain event logging code.

## Acceptance Criteria
\`\`\`json
{
  "type": "code_change",
  "autonomy_level": "greenfield",
  "files_modified": ["workers/crypt-core/src/events.ts"],
  "verification": {
    "command": "grep -c '@param\\\\|@returns' workers/crypt-core/src/events.ts",
    "expected_output": "Minimum 6 matches (3 methods × 2 tags)"
  }
}
\`\`\`

## Implementation
1. Add JSDoc to \`append()\` method with \`@param\`, \`@returns\`, \`@throws\`
2. Add JSDoc to \`getState()\` method
3. Add JSDoc to constructor
4. Run \`npm run lint\` to verify format

## Definition of Done
- [ ] All exported methods have JSDoc
- [ ] Lint passes
- [ ] No breaking changes`,
    labels: ['sluagh:autonomous', 'type:docs', 'complexity:simple', 'component:crypt-core']
  },
  {
    title: 'Create ARCHITECTURE.md for Annals of Ankou',
    description: `## Context
**Problem**: New event sourcing worker lacks architectural documentation.
**Impact**: Enables human oversight and agent understanding of system design.

## Acceptance Criteria
\`\`\`json
{
  "type": "documentation",
  "autonomy_level": "greenfield",
  "files_created": ["workers/annals-of-ankou/ARCHITECTURE.md"],
  "verification": {
    "command": "test -f workers/annals-of-ankou/ARCHITECTURE.md && wc -l < workers/annals-of-ankou/ARCHITECTURE.md",
    "expected_output": "> 50 lines"
  }
}
\`\`\`

## Implementation
1. Create markdown file with sections: Overview, Components, Data Flow, Storage Schema
2. Add Mermaid diagram showing event flow: \`client → POST /append → SQLite → GET /history\`
3. Document all endpoints with request/response examples
4. Add troubleshooting section

## Definition of Done
- [ ] 50+ lines of documentation
- [ ] Mermaid diagram included
- [ ] All endpoints documented`,
    labels: ['sluagh:autonomous', 'type:docs', 'complexity:simple', 'component:annals']
  },
  {
    title: 'Add GET /events/count Endpoint',
    description: `## Context
**Problem**: Need total event count for dashboards.
**Impact**: Monitoring capability without full history retrieval.

## Acceptance Criteria
\`\`\`json
{
  "type": "feature",
  "autonomy_level": "greenfield",
  "files_modified": ["workers/annals-of-ankou/src/index.ts"],
  "tests_required": true,
  "verification": {
    "command": "curl -s http://localhost:8889/events/count -H 'Authorization: Bearer dev-secret' | jq .count",
    "expected_output": "Number (integer)"
  }
}
\`\`\`

## Implementation
1. Add \`handleCountRequest()\` method
2. Query: \`SELECT COUNT(*) FROM events\`
3. Return JSON: \`{"count": N}\`
4. Wire up route in \`fetch()\`

## Definition of Done
- [ ] Endpoint returns correct count
- [ ] Tests pass
- [ ] Documentation updated`,
    labels: ['sluagh:autonomous', 'type:feature', 'complexity:simple', 'component:annals']
  },
  {
    title: 'Write Unit Tests for EventStoreClient.append()',
    description: `## Context
**Problem**: No tests exist for event logging client.
**Impact**: Confidence in event sourcing reliability.

## Acceptance Criteria
\`\`\`json
{
  "type": "test",
  "autonomy_level": "greenfield",
  "files_created": ["workers/crypt-core/src/events.test.ts"],
  "tests_required": true,
  "verification": {
    "command": "npm test -- events.test.ts",
    "expected_output": "PASS"
  }
}
\`\`\`

## Implementation
1. Create test file with Vitest/Jest setup
2. Mock fetch to test HTTP request construction
3. Test success case (200 response)
4. Test error case (401 unauthorized)
5. Test correlation_id propagation

## Definition of Done
- [ ] All tests pass
- [ ] Coverage > 80%
- [ ] Edge cases covered`,
    labels: ['sluagh:autonomous', 'type:test', 'complexity:simple', 'component:crypt-core']
  },
  {
    title: 'Add Comments to Linear Webhook Handler',
    description: `## Context
**Problem**: \`handleWebhook()\` in \`router-do.ts\` has complex logic without inline comments.
**Impact**: Agent maintainability for webhook processing.

## Acceptance Criteria
\`\`\`json
{
  "type": "code_quality",
  "autonomy_level": "greenfield",
  "files_modified": ["workers/crypt-core/src/router-do.ts"],
  "verification": {
    "command": "grep -c '^[[:space:]]*//.*webhook' workers/crypt-core/src/router-do.ts",
    "expected_output": "> 5"
  }
}
\`\`\`

## Implementation
1. Add comment above signature verification explaining HMAC process
2. Add comment before state transition logic
3. Add comment explaining "APPROVE" comment detection
4. Run lint to verify

## Definition of Done
- [ ] 5+ relevant comments added
- [ ] Code more readable
- [ ] Lint passes`,
    labels: ['sluagh:autonomous', 'type:docs', 'complexity:simple', 'component:crypt-core']
  }
];

async function createIssuesViaWorker() {
  console.log(`🚀 Creating ${swarmIssues.length} swarm-ready issues via ${ROUTER_URL}\n`);
  
  const created = [];
  const errors = [];
  
  for (const issue of swarmIssues) {
    try {
      console.log(`Creating: ${issue.title}...`);
      
      const response = await fetch(`${ROUTER_URL}/admin/linear/create-issue`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(issue)
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`HTTP ${response.status}: ${error}`);
      }
      
      const result = await response.json();
      console.log(`✅ Created: ${result.identifier || result.id}\n`);
      created.push(result);
      
    } catch (error) {
      console.error(`❌ Failed: ${issue.title}`);
      console.error(`   Error: ${error.message}\n`);
      errors.push({ issue: issue.title, error: error.message });
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Created: ${created.length}/${swarmIssues.length}`);
  if (errors.length > 0) {
    console.log(`❌ Failed: ${errors.length}`);
    errors.forEach(e => console.log(`   - ${e.issue}: ${e.error}`));
  }
  console.log('='.repeat(50));
}

createIssuesViaWorker().catch(console.error);
