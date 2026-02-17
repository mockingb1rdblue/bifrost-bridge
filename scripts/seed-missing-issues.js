/**
 * Seed Missing Swarm Issues Script
 */
const ROUTER_URL = 'https://crypt-core.mock1ng.workers.dev';
const API_KEY = 'test-key-default';

const missingIssues = [
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
    title: "Document Worker Bees Polling Mechanism",
    description: `### Context: Agent polling loop lacks documentation.
### Impact: Understanding of autonomous agent lifecycle.
### Autonomy: greenfield | Complexity: simple | Est: 10 mins

**Acceptance Criteria**:
- File modified: workers/worker-bees/src/agent.ts
- Verification: grep -c '@description|@see|@example' workers/worker-bees/src/agent.ts (> 3)

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
  },
  {
    title: "Create Test Fixtures for Event Replay",
    description: `### Context: Need sample event data for testing playback.
### Impact: Standardized test data for event sourcing features.
### Autonomy: greenfield | Complexity: simple | Est: 10 mins

**Acceptance Criteria**:
- File created: workers/annals-of-ankou/test/fixtures/events.json
- Verification: jq length workers/annals-of-ankou/test/fixtures/events.json (> 10)

**Implementation**:
1. Create fixtures directory
2. Generate 15 sample events covering all types: JOB_CREATED, LLM_DECISION, ERROR_LOGGED, etc.
3. Include varied correlation_ids and topics
4. Validate JSON syntax with jq`
  },
  {
    title: "Test Worker Bee Job Handler Registration",
    description: `### Context: Handler registry lacks test coverage.
### Impact: Verify agent can handle all job types.
### Autonomy: greenfield | Complexity: simple | Est: 10 mins

**Acceptance Criteria**:
- File created: workers/worker-bees/src/agent.test.ts
- Verification: npm test -- agent.test.ts (PASS)

**Implementation**:
1. Test registerHandler() adds to registry
2. Test handlers['echo'] exists
3. Test handlers['runner_task'] exists
4. Test unknown type returns undefined`
  },
  {
    title: "Add Negative Test for Invalid Event Schema",
    description: `### Context: Annals doesn't validate event payloads.
### Impact: Ensure bad data is rejected.
### Autonomy: greenfield | Complexity: simple | Est: 10 mins

**Acceptance Criteria**:
- File modified: workers/annals-of-ankou/test/integration.test.ts
- Verification: npm test -- integration.test.ts (Test 'rejects invalid schema' passes)

**Implementation**:
1. POST event missing required fields (type, source)
2. Expect 400 Bad Request
3. POST event with invalid correlation_id format
4. Expect error response`
  },
  {
    title: "Implement Date Range Filtering for /history",
    description: `### Context: /history endpoint returns all events.
### Impact: Efficient queries for time-bounded analysis.
### Autonomy: greenfield | Complexity: moderate | Est: 15 mins

**Acceptance Criteria**:
- File modified: workers/annals-of-ankou/src/index.ts
- Verification: curl -s 'http://localhost:8889/history?from=2026-02-01&to=2026-02-14' ... | jq length (> 0)

**Implementation**:
1. Parse from and to query params
2. Update SQL: WHERE timestamp >= ? AND timestamp <= ?
3. Validate date format (ISO 8601)
4. Return 400 if invalid dates`
  },
  {
    title: "Add Correlation ID Validation to Events",
    description: `### Context: Events accept any string as correlation_id.
### Impact: Data quality and trace accuracy.
### Autonomy: greenfield | Complexity: simple | Est: 10 mins

**Acceptance Criteria**:
- File modified: workers/annals-of-ankou/src/index.ts
- Verification: curl -X POST http://localhost:8889/append ... -d '{"correlation_id":"invalid id"}' (400 Bad Request)

**Implementation**:
1. Add regex validation: /^[a-zA-Z0-9_-]+$/
2. Reject if correlation_id contains spaces or special chars
3. Return 400 with error message: "Invalid correlation_id format"`
  },
  {
    title: "Implement GET /events/topics Endpoint",
    description: `### Context: No way to list all distinct topics.
### Impact: Discover available trace categories.
### Autonomy: greenfield | Complexity: simple | Est: 10 mins

**Acceptance Criteria**:
- File modified: workers/annals-of-ankou/src/index.ts
- Verification: curl -s .../events/topics | jq '.topics | length' (> 0)

**Implementation**:
1. Add handleTopicsRequest() method
2. Query: SELECT DISTINCT topic FROM events ORDER BY topic
3. Return JSON: {"topics": ["global", "BIF-42", ...]}
4. Wire up route`
  },
  {
    title: "Add Event Type Filtering to /history",
    description: `### Context: Can't filter by event type (e.g., only errors).
### Impact: Targeted debugging and analysis.
### Autonomy: greenfield | Complexity: simple | Est: 10 mins

**Acceptance Criteria**:
- File modified: workers/annals-of-ankou/src/index.ts
- Verification: curl -s '.../history?type=ERROR_LOGGED' | jq '.[].type' | uniq (ERROR_LOGGED)

**Implementation**:
1. Parse type query param
2. Update SQL: WHERE type = ? (if provided)
3. Handle multiple types: type=ERROR_LOGGED,JOB_CREATED
4. Use IN clause for multiple values`
  }
];

async function createIssue(issue) {
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
  const data = await response.json();
  return data.success;
}

async function main() {
  console.log(`🚀 Seeding ${missingIssues.length} missing issues to Linear...`);
  for (const issue of missingIssues) {
    process.stdout.write(`Creating: ${issue.title}... `);
    const success = await createIssue(issue);
    console.log(success ? '✅ Success' : '❌ Failed');
  }
  console.log('\n✨ Seeding complete.');
}

main().catch(console.error);
