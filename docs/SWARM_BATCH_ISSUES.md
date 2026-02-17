# Swarm-Ready Issue Batch: Quick Deploy

> **15 atomic tasks ready for immediate Linear deployment**
> Each task is greenfield, autonomous, and completable by any LLM in <15 minutes

---

## Batch 1: Documentation (5 issues)

### BIF-201: Add JSDoc to EventStoreClient Methods
**Context**: `EventStoreClient` in `workers/crypt-core/src/events.ts` lacks comprehensive documentation.
**Impact**: Enables agents to understand and maintain event logging code.
**Autonomy**: `greenfield` | **Complexity**: `simple` | **Est**: 10 mins

**Acceptance Criteria**:
```json
{
  "files_modified": ["workers/crypt-core/src/events.ts"],
  "verification": {
    "command": "grep -c '@param\\|@returns' workers/crypt-core/src/events.ts",
    "expected_output": "Minimum 6 matches (3 methods × 2 tags)"
  }
}
```

**Implementation**:
1. Add JSDoc to `append()` method with `@param`, `@returns`, `@throws`
2. Add JSDoc to `getState()` method
3. Add JSDoc to constructor
4. Run `npm run lint` to verify format

---

### BIF-202: Create ARCHITECTURE.md for Annals of Ankou
**Context**: New event sourcing worker lacks architectural documentation.
**Impact**: Enables human oversight and agent understanding of system design.
**Autonomy**: `greenfield` | **Complexity**: `simple` | **Est**: 15 mins

**Acceptance Criteria**:
```json
{
  "files_created": ["workers/annals-of-ankou/ARCHITECTURE.md"],
  "verification": {
    "command": "test -f workers/annals-of-ankou/ARCHITECTURE.md && wc -l < workers/annals-of-ankou/ARCHITECTURE.md",
    "expected_output": "> 50 lines"
  }
}
```

**Implementation**:
1. Create markdown file with sections: Overview, Components, Data Flow, Storage Schema
2. Add Mermaid diagram showing event flow: `client → POST /append → SQLite → GET /history`
3. Document all endpoints with request/response examples
4. Add troubleshooting section

---

### BIF-203: Update Main README with Event Sourcing Section
**Context**: Root README doesn't mention Annals of Ankou or event sourcing.
**Impact**: Onboarding clarity for new developers and agents.
**Autonomy**: `greenfield` | **Complexity**: `simple` | **Est**: 10 mins

**Acceptance Criteria**:
```json
{
  "files_modified": ["README.md"],
  "verification": {
    "command": "grep -i 'annals of ankou' README.md",
    "expected_output": "At least one match"
  }
}
```

**Implementation**:
1. Add "Event Sourcing" section after "Architecture"
2. Explain role of Annals of Ankou in 2-3 sentences
3. Link to `workers/annals-of-ankou/ARCHITECTURE.md`
4. Add one-liner: "All swarm actions are immutably logged for audit trails"

---

### BIF-204: Add Comments to Linear Webhook Handler
**Context**: `handleWebhook()` in `router-do.ts` has complex logic without inline comments.
**Impact**: Agent maintainability for webhook processing.
**Autonomy**: `greenfield` | **Complexity**: `simple` | **Est**: 10 mins

**Acceptance Criteria**:
```json
{
  "files_modified": ["workers/crypt-core/src/router-do.ts"],
  "verification": {
    "command": "grep -c '^[[:space:]]*//.*webhook' workers/crypt-core/src/router-do.ts",
    "expected_output": "> 5"
  }
}
```

**Implementation**:
1. Add comment above signature verification explaining HMAC process
2. Add comment before state transition logic
3. Add comment explaining "APPROVE" comment detection
4. Run lint to verify

---

### BIF-205: Document Worker Bees Polling Mechanism
**Context**: Agent polling loop lacks documentation.
**Impact**: Understanding of autonomous agent lifecycle.
**Autonomy**: `greenfield` | **Complexity**: `simple` | **Est**: 10 mins

**Acceptance Criteria**:
```json
{
  "files_modified": ["workers/worker-bees/src/agent.ts"],
  "verification": {
    "command": "grep -c '@description\\|@see\\|@example' workers/worker-bees/src/agent.ts",
    "expected_output": "> 3"
  }
}
```

**Implementation**:
1. Add block comment above `pollQueue()` explaining FIFO logic
2. Document retry and backoff behavior
3. Add example of successful poll → execute → complete cycle
4. Link to crypt-core queue documentation

---

## Batch 2: Testing (5 issues)

### BIF-206: Write Unit Tests for EventStoreClient.append()
**Context**: No tests exist for event logging client.
**Impact**: Confidence in event sourcing reliability.
**Autonomy**: `greenfield` | **Complexity**: `simple` | **Est**: 15 mins

**Acceptance Criteria**:
```json
{
  "files_created": ["workers/crypt-core/src/events.test.ts"],
  "tests_required": true,
  "verification": {
    "command": "npm test -- events.test.ts",
    "expected_output": "PASS"
  }
}
```

**Implementation**:
1. Create test file with Vitest/Jest setup
2. Mock fetch to test HTTP request construction
3. Test success case (200 response)
4. Test error case (401 unauthorized)
5. Test correlation_id propagation

---

### BIF-207: Add Integration Test for /append Endpoint
**Context**: Annals of Ankou endpoint untested.
**Impact**: Verify end-to-end event persistence.
**Autonomy**: `supervised` | **Complexity**: `simple` | **Est**: 15 mins

**Acceptance Criteria**:
```json
{
  "files_created": ["workers/annals-of-ankou/test/integration.test.ts"],
  "verification": {
    "command": "npm test -- integration.test.ts",
    "expected_output": "PASS"
  },
  "hitl_approval": false
}
```

**Implementation**:
1. Spin up local miniflare instance
2. POST event to `/append`
3. Query `/history` to verify persistence
4. Check SQLite row count
5. Teardown test environment

---

### BIF-208: Create Test Fixtures for Event Replay
**Context**: Need sample event data for testing playback.
**Impact**: Standardized test data for event sourcing features.
**Autonomy**: `greenfield` | **Complexity**: `simple` | **Est**: 10 mins

**Acceptance Criteria**:
```json
{
  "files_created": ["workers/annals-of-ankou/test/fixtures/events.json"],
  "verification": {
    "command": "jq length workers/annals-of-ankou/test/fixtures/events.json",
    "expected_output": "> 10"
  }
}
```

**Implementation**:
1. Create fixtures directory
2. Generate 15 sample events covering all types: JOB_CREATED, LLM_DECISION, ERROR_LOGGED, etc.
3. Include varied correlation_ids and topics
4. Validate JSON syntax with `jq`

---

### BIF-209: Test Worker Bee Job Handler Registration
**Context**: Handler registry lacks test coverage.
**Impact**: Verify agent can handle all job types.
**Autonomy**: `greenfield` | **Complexity**: `simple` | **Est**: 10 mins

**Acceptance Criteria**:
```json
{
  "files_created": ["workers/worker-bees/src/agent.test.ts"],
  "verification": {
    "command": "npm test -- agent.test.ts",
    "expected_output": "PASS"
  }
}
```

**Implementation**:
1. Test `registerHandler()` adds to registry
2. Test `handlers['echo']` exists
3. Test `handlers['runner_task']` exists
4. Test unknown type returns undefined

---

### BIF-210: Add Negative Test for Invalid Event Schema
**Context**: Annals doesn't validate event payloads.
**Impact**: Ensure bad data is rejected.
**Autonomy**: `greenfield` | **Complexity**: `simple` | **Est**: 10 mins

**Acceptance Criteria**:
```json
{
  "files_modified": ["workers/annals-of-ankou/test/integration.test.ts"],
  "verification": {
    "command": "npm test -- integration.test.ts",
    "expected_output": "Test 'rejects invalid schema' passes"
  }
}
```

**Implementation**:
1. POST event missing required fields (`type`, `source`)
2. Expect 400 Bad Request
3. POST event with invalid correlation_id format
4. Expect error response

---

## Batch 3: Simple Features (5 issues)

### BIF-211: Add GET /events/count Endpoint
**Context**: Need total event count for dashboards.
**Impact**: Monitoring capability without full history retrieval.
**Autonomy**: `greenfield` | **Complexity**: `simple` | **Est**: 10 mins

**Acceptance Criteria**:
```json
{
  "files_modified": ["workers/annals-of-ankou/src/index.ts"],
  "verification": {
    "command": "curl -s http://localhost:8889/events/count -H 'Authorization: Bearer dev-secret' | jq .count",
    "expected_output": "Number (integer)"
  }
}
```

**Implementation**:
1. Add `handleCountRequest()` method
2. Query: `SELECT COUNT(*) FROM events`
3. Return JSON: `{"count": N}`
4. Wire up route in `fetch()`

---

### BIF-212: Implement Date Range Filtering for /history
**Context**: `/history` endpoint returns all events.
**Impact**: Efficient queries for time-bounded analysis.
**Autonomy**: `greenfield` | **Complexity**: `moderate` | **Est**: 15 mins

**Acceptance Criteria**:
```json
{
  "files_modified": ["workers/annals-of-ankou/src/index.ts"],
  "verification": {
    "command": "curl -s 'http://localhost:8889/history?from=2026-02-01&to=2026-02-14' -H 'Authorization: Bearer dev-secret' | jq length",
    "expected_output": "> 0"
  }
}
```

**Implementation**:
1. Parse `from` and `to` query params
2. Update SQL: `WHERE timestamp >= ? AND timestamp <= ?`
3. Validate date format (ISO 8601)
4. Return 400 if invalid dates

---

### BIF-213: Add Correlation ID Validation to Events
**Context**: Events accept any string as correlation_id.
**Impact**: Data quality and trace accuracy.
**Autonomy**: `greenfield` | **Complexity**: `simple` | **Est**: 10 mins

**Acceptance Criteria**:
```json
{
  "files_modified": ["workers/annals-of-ankou/src/index.ts"],
  "verification": {
    "command": "curl -X POST http://localhost:8889/append -d '{\"type\":\"TEST\",\"source\":\"test\",\"correlation_id\":\"invalid id with spaces\"}' -H 'Authorization: Bearer dev-secret'",
    "expected_output": "400 Bad Request"
  }
}
```

**Implementation**:
1. Add regex validation: `/^[a-zA-Z0-9_-]+$/`
2. Reject if correlation_id contains spaces or special chars
3. Return 400 with error message: "Invalid correlation_id format"

---

### BIF-214: Implement GET /events/topics Endpoint
**Context**: No way to list all distinct topics.
**Impact**: Discover available trace categories.
**Autonomy**: `greenfield` | **Complexity**: `simple` | **Est**: 10 mins

**Acceptance Criteria**:
```json
{
  "files_modified": ["workers/annals-of-ankou/src/index.ts"],
  "verification": {
    "command": "curl -s http://localhost:8889/events/topics -H 'Authorization: Bearer dev-secret' | jq '.topics | length'",
    "expected_output": "> 0"
  }
}
```

**Implementation**:
1. Add `handleTopicsRequest()` method
2. Query: `SELECT DISTINCT topic FROM events ORDER BY topic`
3. Return JSON: `{"topics": ["global", "BIF-42", ...]}`
4. Wire up route

---

### BIF-215: Add Event Type Filtering to /history
**Context**: Can't filter by event type (e.g., only errors).
**Impact**: Targeted debugging and analysis.
**Autonomy**: `greenfield` | **Complexity**: `simple` | **Est**: 10 mins

**Acceptance Criteria**:
```json
{
  "files_modified": ["workers/annals-of-ankou/src/index.ts"],
  "verification": {
    "command": "curl -s 'http://localhost:8889/history?type=ERROR_LOGGED' -H 'Authorization: Bearer dev-secret' | jq '.[].type' | uniq",
    "expected_output": "ERROR_LOGGED"
  }
}
```

**Implementation**:
1. Parse `type` query param
2. Update SQL: `WHERE type = ?` (if provided)
3. Handle multiple types: `type=ERROR_LOGGED,JOB_CREATED`
4. Use `IN` clause for multiple values

---

## Deployment Instructions

### Option 1: Manual Linear UI
1. Copy each issue above
2. Create new issue in Linear
3. Paste title and description
4. Add labels: `sluagh:autonomous`, `type:feature`, `complexity:simple`
5. Set state: **Sluagh Ready**
6. Assign to: **Unassigned** (let agents claim)

### Option 2: Linear API Bulk Import
```bash
# Use the audit script to bulk create
node scripts/linear-bulk-create.js < docs/SWARM_BATCH_ISSUES.md
```

### Option 3: CSV Import
1. Export issues to CSV format
2. Use Linear's built-in CSV import
3. Map columns: Title, Description, Labels, State

---

## Success Metrics

After deploying this batch:
- **15 agent-ready tasks** in "Sluagh Ready" state
- **Average completion time**: <15 minutes per task
- **Autonomous completion rate**: >90% (13/15 tasks)
- **HITL escalations**: <10% (1-2 tasks may need clarification)

## Next Batch

After these quick wins, create:
- **Batch 4**: Code Quality (lint fixes, type strictness)
- **Batch 5**: Refactoring (function extraction, complexity reduction)
- **Batch 6**: Performance (caching, query optimization)
