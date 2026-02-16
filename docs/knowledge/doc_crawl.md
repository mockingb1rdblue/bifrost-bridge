## Documentation Crawling Plan: Building Real-World Tool Patterns for Bifrost

**Goal**: Systematically crawl and extract Linear, GitHub, Fly.io, and Cloudflare API documentation to build a comprehensive knowledge base of API patterns, common workflows, error handling strategies, and real-world usage examples that Bifrost agents can reference when implementing features.

**Why This Matters**: Your agents need to know _how_ to use these APIs in practice, not just that they exist. Documentation crawling builds a persistent knowledge base that Troubleshooter agents query, Coder agents reference for implementation patterns, and Architect agents use for designing integrations. [linear](https://linear.app/developers/graphql)

---

## Phase 1: Documentation Discovery & URL Mapping

**Objective**: Build comprehensive sitemap of all documentation pages for each platform.

### Target Documentation Sources

**Linear**:

- Main docs: `https://linear.app/docs` (user-facing features) [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/372e1f95-298a-480d-9392-e8c32c402b77/bifrost_v2_realization.md.resolved)
- API docs: `https://linear.app/developers` (GraphQL API, SDK, webhooks) [linear](https://linear.app/docs/api-and-webhooks)
- GraphQL schema: `https://api.linear.app/graphql` (introspection endpoint)
- GitHub examples: `https://github.com/linear/linear` (official SDK and tools repo) [github](https://github.com/linear/linear)

**Fly.io**:

- Main docs: `https://fly.io/docs/` (platform features)
- Machines API: `https://fly.io/docs/machines/api/` (REST API reference) [aa-docs.fly](https://aa-docs.fly.dev/docs/machines/api/)
- Sprites docs: `https://fly.io/docs/machines/sprites/` (persistent VM documentation)
- OpenAPI spec: `https://docs.machines.dev/swagger/index.html` (machine-readable API spec)
- Changelog: `https://fly.io/changelog` (recent feature additions)

**Cloudflare Workers**:

- Workers docs: `https://developers.cloudflare.com/workers/` (runtime, APIs, bindings)
- Durable Objects: `https://developers.cloudflare.com/durable-objects/`
- Workers KV: `https://developers.cloudflare.com/kv/`
- Vectorize: `https://developers.cloudflare.com/vectorize/`
- R2 Storage: `https://developers.cloudflare.com/r2/`
- API reference: `https://developers.cloudflare.com/api/` (REST APIs) [uithub](https://uithub.com/cloudflare/cloudflare-docs/tree/production/src/content/docs/workers)

**GitHub**:

- GraphQL API: `https://docs.github.com/en/graphql` (queries, mutations, schemas) [docs.github](https://docs.github.com/en/graphql)
- REST API: `https://docs.github.com/en/rest` (alternative HTTP API)
- GitHub Apps: `https://docs.github.com/en/apps` (authentication, permissions, webhooks)

### Discovery Strategy

**Step 1: Sitemap Extraction** (Gemini 2.5 Flash for large context window)

Use Gemini to process each documentation site's homepage and extract all internal documentation links. Gemini's 2M token context window handles entire sitemaps in single pass.

**Process**:

1. Fetch documentation homepage HTML
2. Feed to Gemini with prompt: "Extract all documentation URLs from this HTML, organized by category (Getting Started, API Reference, Guides, Examples, etc.). Return as structured JSON."
3. Store sitemap in SQLite: `documentation_urls(platform, category, url, discovered_date)`

**Why Gemini**: Documentation sites have hundreds of interlinked pages. Gemini's large context processes entire sitemap structures, identifies category hierarchies, and extracts complete URL lists without pagination complexity. [linear](https://linear.app/developers/graphql)

**Step 2: Deduplication & Prioritization** (DeepSeek for analysis)

Some documentation pages are more valuable than others. Use DeepSeek to analyze discovered URLs and prioritize by relevance to Bifrost's use cases.

**Process**:

1. Query discovered URLs from database
2. Feed to DeepSeek with prompt: "Given Bifrost uses these APIs for [orchestration, issue management, code repository operations, persistent VMs], rank these documentation pages by relevance. High priority: API endpoints we'll call frequently, error handling guides, authentication patterns. Low priority: UI tutorials, billing documentation, marketing pages."
3. Store priority scores: `UPDATE documentation_urls SET priority_score = ? WHERE url = ?`

**Why DeepSeek**: Cost-effective for analytical tasks. Processes 1,000+ URLs for $0.05-0.10, identifies patterns in URL structure (e.g., `/api/` paths more relevant than `/changelog/`), understands context from URL path segments.

---

## Phase 2: Content Extraction & Structured Storage

**Objective**: Download documentation pages and extract structured content (code examples, API signatures, error codes, best practices).

### Extraction Strategy

**Step 1: Batch Download** (Perplexity for web scraping research)

Before implementing crawler, use Perplexity to research best practices for respectful documentation crawling.

**Perplexity Research Queries**:

- "Best practices for crawling technical documentation robots.txt compliance"
- "Cloudflare Workers rate limits for documentation site crawling"
- "How to extract code examples from documentation HTML reliably"

**Store research findings**: Document rate limits, robots.txt rules, optimal request patterns per platform.

**Step 2: Page Content Extraction** (Gemini 2.5 Flash for parsing)

For each high-priority URL, fetch HTML and extract structured content using Gemini.

**Process**:

1. Fetch page HTML respecting rate limits (1 request/second per domain)
2. Feed to Gemini with prompt: "Extract from this documentation page: (1) Page title and category, (2) All code examples with language tags, (3) API endpoint signatures and parameters, (4) Error codes and descriptions, (5) Best practice recommendations, (6) Links to related pages. Return as structured JSON."
3. Store in SQLite: `documentation_content(url, title, category, raw_html, structured_json, extraction_date)`

**Why Gemini**: Documentation HTML is messy (ads, navigation, footers). Gemini's instruction-following extracts semantic content (actual documentation) from boilerplate, understands code block syntax highlighting classes, identifies API signatures in prose ("The endpoint accepts a `query` parameter of type `string`").

**Step 3: Code Example Isolation** (Specialized extraction)

Extract all code examples into dedicated table for easy reference by Coder agents.

**Schema**:

```
code_examples(
  id,
  platform (Linear/GitHub/Fly.io/Cloudflare),
  language (TypeScript/Python/Bash/GraphQL),
  category (authentication/CRUD operations/error handling/batching),
  code_snippet,
  documentation_url (source reference),
  description (what this code does),
  extracted_date
)
```

**Process**:

1. Query `documentation_content` for all extracted structured JSON
2. Parse JSON for code example nodes
3. Classify by language and category using DeepSeek: "Is this code example about authentication, creating resources, querying data, handling errors, or batch operations?"
4. Store in `code_examples` table

**Why separate table**: Coder agents query "show me GitHub GraphQL mutation examples" without parsing full documentation pages. Enables fast pattern matching.

---

## Phase 3: Pattern Extraction & Knowledge Graph

**Objective**: Identify common API usage patterns, anti-patterns, and dependency relationships between APIs.

### Pattern Identification

**Step 1: Workflow Pattern Mining** (DeepSeek for code analysis)

Analyze extracted code examples to identify common workflows (e.g., "Create Linear issue → Link to GitHub PR → Update issue status").

**Process**:

1. Query all code examples for specific platform
2. Group by category (all "Linear issue creation" examples together)
3. Feed group to DeepSeek: "Analyze these 15 code examples for creating Linear issues. Extract common patterns: Required fields, optional parameters, error handling approaches, rate limit strategies, batch operation techniques. Identify best practices mentioned in comments or surrounding documentation."
4. Store patterns: `api_patterns(platform, operation, pattern_description, example_ids, confidence_score)`

**Why DeepSeek**: Excellent at code analysis and pattern recognition. Cost-effective for processing hundreds of examples (~$0.50-1 for entire documentation corpus). Identifies subtle patterns (e.g., "most examples wrap mutations in try-catch with specific error type checks").

**Step 2: Anti-Pattern Detection** (Gemini for documentation prose analysis)

Documentation often includes warnings ("Don't do X") or deprecated approaches. Extract these explicitly.

**Process**:

1. Query documentation pages containing keywords: "deprecated," "warning," "avoid," "don't," "instead use"
2. Feed to Gemini: "Extract all warnings, deprecated features, and anti-patterns from this documentation. For each, identify: (1) What not to do, (2) Why it's problematic, (3) Recommended alternative, (4) Migration path if applicable."
3. Store: `anti_patterns(platform, operation, anti_pattern_description, consequence, alternative, documentation_url)`

**Why Gemini**: Better at understanding natural language warnings in prose documentation. DeepSeek excels at code; Gemini excels at extracting semantic meaning from explanatory text.

**Step 3: API Dependency Mapping** (DeepSeek for cross-reference analysis)

Identify which APIs commonly work together (e.g., Linear issues often reference GitHub PRs, Fly.io Machines need Apps created first).

**Process**:

1. Analyze all code examples across platforms
2. Feed to DeepSeek: "Identify workflow dependencies: Which API calls must happen before others? Which resources must exist before creating dependent resources? Which error conditions require calling different APIs for resolution?"
3. Build dependency graph: `api_dependencies(from_operation, to_operation, dependency_type, description)`

**Example output**:

- `from_operation="Linear.createIssue"` → `to_operation="GitHub.createPullRequest"` → `dependency_type="can_reference"` → `description="Issues can link to PRs via issue.externalIds"`
- `from_operation="Fly.createMachine"` → `to_operation="Fly.createApp"` → `dependency_type="requires"` → `description="Machine must belong to existing App, create App first"`

**Why this matters**: Architect agents use dependency graph to design correct operation sequences. Avoids errors like "tried to create Machine without App."

---

## Phase 4: Error Handling & Edge Case Documentation

**Objective**: Build comprehensive database of API error codes, rate limits, timeout behaviors, and recovery strategies.

### Error Knowledge Base Construction

**Step 1: Error Code Extraction** (Gemini for structured data)

**Process**:

1. Query documentation pages containing "error," "status code," "exception," "failure"
2. Feed to Gemini: "Extract all error codes, HTTP status codes, and exception types documented on this page. For each error: (1) Error code/name, (2) Description, (3) Common causes, (4) Recommended resolution, (5) Retry strategy if applicable."
3. Store: `error_codes(platform, error_code, http_status, description, causes, resolution, retry_strategy, documentation_url)`

**Example entries**:

- `platform="Linear"` → `error_code="AUTHENTICATION_ERROR"` → `http_status=401` → `resolution="Regenerate API key in Linear dashboard → Settings → API"`
- `platform="Fly.io"` → `error_code="MACHINE_START_TIMEOUT"` → `resolution="Increase Machine CPU/RAM, check init script logs via fly logs"`

**Step 2: Rate Limit Documentation** (DeepSeek for numeric analysis)

**Process**:

1. Search documentation for "rate limit," "throttle," "requests per," "quota"
2. Feed to DeepSeek: "Extract all rate limit specifications: Requests per time period, burst limits, per-resource limits, authentication tier differences. Identify whether limits are per-app, per-user, per-IP, global."
3. Store: `rate_limits(platform, endpoint_pattern, requests_per_second, requests_per_hour, burst_limit, scope, documentation_url)`

**Example**:

- `platform="Fly.io"` → `endpoint_pattern="POST /machines/:id/start"` → `requests_per_second=1` → `burst_limit=3` → `scope="per-machine"` [fly](https://fly.io/docs/machines/api/working-with-machines-api/)

**Why this matters**: RouterDO implements rate limit respecting logic. Instead of hardcoding limits, queries `rate_limits` table for current documented limits per platform.

**Step 3: Timeout & Retry Patterns** (DeepSeek for code pattern analysis)

**Process**:

1. Extract all code examples showing retry logic, exponential backoff, timeout handling
2. Feed to DeepSeek: "Analyze these retry/timeout code examples. Extract: (1) Recommended timeout values per operation type, (2) Backoff strategies (exponential, linear, jittered), (3) Maximum retry counts, (4) Which errors should retry vs. fail immediately."
3. Store: `retry_patterns(platform, operation, timeout_seconds, backoff_strategy, max_retries, retryable_errors, documentation_url)`

---

## Phase 5: Integration Examples & Workflow Templates

**Objective**: Create reusable workflow templates that combine multiple APIs into complete features.

### Workflow Template Generation

**Step 1: Multi-API Workflow Extraction** (Gemini for complex examples)

Some documentation includes end-to-end examples ("Build a CI/CD pipeline," "Implement issue-to-PR workflow"). Extract these as templates.

**Process**:

1. Query documentation for pages with "tutorial," "guide," "example," "workflow," "integration"
2. Feed full tutorial to Gemini: "Extract the complete workflow from this tutorial. Identify: (1) All API calls in sequence, (2) Data flowing between calls, (3) Error handling at each step, (4) Conditional logic (if X fails, do Y), (5) Prerequisites and setup steps."
3. Store: `workflow_templates(name, description, platforms_involved, steps_json, error_handling_json, documentation_url)`

**Example template**: "Linear Issue to GitHub PR Workflow"

```json
{
  "name": "Linear Issue to GitHub PR Workflow",
  "platforms": ["Linear", "GitHub"],
  "steps": [
    {
      "step": 1,
      "action": "Query Linear issue",
      "api": "Linear.issue(id)",
      "extract_data": ["title", "description", "labels"]
    },
    {
      "step": 2,
      "action": "Create GitHub branch",
      "api": "GitHub.createRef()",
      "uses_data_from_step": 1,
      "branch_name": "feature/LIN-{issue.number}-{slugified.title}"
    },
    {
      "step": 3,
      "action": "Implement code changes",
      "note": "Agent implementation happens here"
    },
    {
      "step": 4,
      "action": "Create pull request",
      "api": "GitHub.createPullRequest()",
      "body_includes": "Closes {linear.issue.url}"
    },
    {
      "step": 5,
      "action": "Update Linear issue",
      "api": "Linear.issueUpdate()",
      "set_status": "In Review",
      "add_comment": "PR created: {github.pr.url}"
    }
  ]
}
```

**Step 2: Workflow Validation** (DeepSeek for correctness checking)

**Process**:

1. Query extracted workflow templates
2. For each template, feed to DeepSeek: "Validate this workflow template. Check: (1) Are API calls in correct dependency order? (2) Is required data available at each step? (3) Are error paths handled? (4) Are rate limits respected (too many sequential calls)? (5) Are there missing authentication steps?"
3. Store validation results: `UPDATE workflow_templates SET validated=true, validation_notes=? WHERE id=?`

**Why validation**: Extracted templates may have incomplete error handling or assume context not present in isolated execution. DeepSeek identifies gaps.

---

## Phase 6: Embedding Generation & Semantic Search Index

**Objective**: Enable Troubleshooter and Coder agents to semantically search documentation ("How do I batch update Linear issues?") instead of keyword matching.

### Embedding Strategy

**Step 1: Chunk Documentation** (Preprocessing)

Break large documentation pages into semantic chunks (each chunk = one concept/section).

**Process**:

1. Query `documentation_content` table
2. For each page, split by Markdown headers (`##`, `###`) or HTML section tags (`<section>`, `<article>`)
3. Store chunks: `documentation_chunks(parent_url, chunk_index, heading, content, token_count)`

**Why chunking**: Embedding models have token limits (512-8192 tokens). Documentation pages often exceed this. Chunking ensures each embedding represents single concept (e.g., "Authentication with API keys" vs. entire authentication documentation page).

**Step 2: Generate Embeddings** (Gemini Embedding API)

**Process**:

1. Query all chunks from `documentation_chunks`
2. Batch chunks (100 at a time) and send to Gemini Embedding API: `POST https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents`
3. Store embeddings: `documentation_embeddings(chunk_id, embedding_vector, model_version, generated_date)`

**Cost**: ~$0.00001 per 1K tokens. Entire documentation corpus (estimated 5M tokens) = $0.05 for embeddings. [linear](https://linear.app/developers/graphql)

**Step 3: Index in Cloudflare Vectorize** (Persistent search index)

**Process**:

1. Query embeddings from database
2. Bulk insert into Vectorize index: `await env.DOCS_INDEX.insert([{id: chunk_id, values: embedding, metadata: {platform, category, url}}])`
3. Enable hybrid search: Store both embeddings (semantic search) and keywords (exact match fallback)

**Why Vectorize**: Native integration with Cloudflare Workers (your control plane). Query latency <50ms. Free tier: 10M vectors, 30M queries/month (sufficient for Bifrost's usage).

**Step 4: Build Query Interface** (MCP Tool)

Create MCP server exposing documentation search tool.

**Tool signature**:

```typescript
{
  name: "search_documentation",
  description: "Search API documentation semantically",
  parameters: {
    query: "Natural language question about API usage",
    platforms: ["Linear", "GitHub", "Fly.io", "Cloudflare"], // filter by platform
    top_k: 5 // number of results
  },
  returns: [
    {
      chunk_content: "Documentation text",
      url: "Original documentation URL",
      platform: "Linear",
      relevance_score: 0.92
    }
  ]
}
```

**Usage by agents**:

- **Coder agent**: "search_documentation('How to create Linear issue with custom fields?')" → Returns examples with required GraphQL mutation structure
- **Troubleshooter agent**: "search_documentation('Fly.io Machine failed to start ECONNREFUSED')" → Returns error handling documentation and resolution steps
- **Architect agent**: "search_documentation('Best practices for batching GitHub API calls')" → Returns rate limit documentation and batch operation patterns

---

## Phase 7: Self-Updating Documentation System

**Objective**: Keep documentation knowledge base current without manual re-crawls.

### Automated Update Strategy

**Step 1: Change Detection** (Perplexity for changelog monitoring)

**Process**:

1. Weekly scheduled task queries Perplexity: "What changed in Linear API in last 7 days," "Fly.io changelog February 2026," "Cloudflare Workers new features this week"
2. Perplexity returns news, blog posts, changelog entries with citations
3. Extract changed API endpoints/features: Parse citations for specific API changes
4. Store: `documentation_changes(platform, change_date, change_description, source_url, needs_recrawl)`

**Why Perplexity**: Searches recent content (last 7 days) better than pre-trained models. Returns cited sources for verification.

**Step 2: Targeted Re-Crawl** (Gemini for incremental updates)

**Process**:

1. Query `documentation_changes WHERE needs_recrawl=true`
2. For each change, identify affected documentation URLs (e.g., "Linear sub-issues feature" → re-crawl `/docs/parent-and-sub-issues`)
3. Re-extract content using Phase 2 process
4. Update database: `UPDATE documentation_content SET structured_json=?, extraction_date=? WHERE url=?`
5. Regenerate embeddings for updated chunks

**Why targeted**: Full re-crawl wastes bandwidth and credits. 95% of documentation unchanged week-to-week. Update only affected pages.

**Step 3: Agent Notification** (Event sourcing integration)

**Process**:

1. When documentation update completes, publish event: `documentation_updated(platform, affected_operations, change_summary)`
2. Troubleshooter agent subscribes to these events
3. On receiving event, Troubleshooter clears relevant cache entries: "Fly.io Machine creation API changed → invalidate cached Machine creation patterns"
4. Next agent query fetches updated documentation automatically

**Why this matters**: Prevents agents from using stale patterns after API changes. Agents learn about API updates passively through event stream.

---

## Phase 8: Practical Pattern Integration (Self-Building Phase)

**Objective**: Once documentation crawled, use it to improve Bifrost's own API integration code.

### Pattern Application Workflow

**Step 1: Audit Current Code** (DeepSeek code review)

**Process**:

1. Export Bifrost's current Linear/GitHub/Fly.io API client code
2. Feed to DeepSeek with documentation patterns: "Compare this code against documented best practices from our knowledge base. Identify: (1) Missing error handling, (2) Inefficient API usage (could be batched), (3) Deprecated API calls, (4) Missing rate limit handling, (5) Hardcoded values that should be dynamic."
3. Generate improvement tasks: Create Linear issues for each identified gap
4. Store in event log: `code_audit_completed(gaps_found, issues_created)`

**Step 2: Automated Pattern Application** (Coder agent with documentation context)

**Process**:

1. Coder agent receives task: "Implement Linear batch issue update"
2. Before coding, queries documentation: `search_documentation("Linear batch mutations GraphQL")`
3. Retrieves documented patterns: "Use `issueBatchUpdate` mutation with array of issue IDs and updates"
4. Generates code matching documented pattern
5. Validator compares generated code against extracted examples: "Does this match the documented approach?"

**Step 3: Living Documentation** (Self-documenting system)

**Process**:

1. Every time agent successfully uses an API pattern, log it: `api_usage_success(platform, operation, code_used, outcome)`
2. Aggregate successful patterns quarterly: "Which documented patterns do we actually use? Which have we never used?"
3. Prioritize documentation updates: If Bifrost never uses "Linear custom views API," deprioritize re-crawling that section
4. If Bifrost uses "GitHub PR review comments" extensively, increase re-crawl frequency for that section

---

## Implementation Roadmap

### Week 1: Foundation (URL Discovery)

**Tasks**:

1. Set up SQLite schema for documentation storage (tables defined in Phases 1-4)
2. Implement Gemini-based sitemap extractor
3. Run discovery for all four platforms (Linear, GitHub, Fly.io, Cloudflare)
4. Review discovered URLs, validate coverage (manually check no major sections missing)
5. Run DeepSeek prioritization (score all URLs by relevance)

**Deliverables**:

- Database with ~500-1,000 documentation URLs across platforms
- Priority scores identifying top 200 most relevant pages
- Initial crawl targets list

**Agent involvement**: Human drives Week 1 (bootstrap), but Architect agent can review URL lists and suggest missing categories.

### Week 2-3: Content Extraction (Core Knowledge Base)

**Tasks**:

1. Implement respectful crawler (rate limiting, robots.txt compliance)
2. Extract top 200 priority pages using Gemini
3. Parse extracted JSON, populate `documentation_content` and `code_examples` tables
4. Run DeepSeek pattern extraction on code examples
5. Run Gemini anti-pattern extraction on warnings/deprecations

**Deliverables**:

- 200 documentation pages fully extracted and structured
- 300-500 code examples isolated in dedicated table
- 50-100 identified API patterns
- 20-30 documented anti-patterns

**Agent involvement**: Coder agent implements crawler (human reviews code), Validator verifies extraction quality by sampling results.

### Week 4: Advanced Analysis (Patterns & Errors)

**Tasks**:

1. Run dependency mapping analysis (identify which APIs depend on others)
2. Extract error codes and rate limits
3. Build retry pattern database
4. Extract workflow templates from tutorials
5. Validate templates using DeepSeek

**Deliverables**:

- API dependency graph (50-80 relationships)
- Comprehensive error code database (100-200 errors documented)
- Rate limit specifications (30-50 endpoint limits)
- 10-15 validated workflow templates

**Agent involvement**: Troubleshooter agent uses error database immediately (even incomplete), provides feedback on usefulness.

### Week 5: Semantic Search (Embedding Index)

**Tasks**:

1. Chunk documentation into semantic units
2. Generate embeddings via Gemini API
3. Index in Cloudflare Vectorize
4. Build MCP tool for documentation search
5. Test queries from agents

**Deliverables**:

- 2,000-3,000 documentation chunks embedded
- Vectorize index operational (<50ms query latency)
- MCP tool accessible to all agents
- 10 test queries validated (relevant results returned)

**Agent involvement**: All agents begin using documentation search tool immediately. Coder tests with implementation questions, Troubleshooter tests with error scenarios.

### Week 6: Self-Building Acceleration

**Tasks**:

1. Architect agent audits Bifrost's API client code using documentation patterns
2. Generate Linear issues for identified gaps (missing error handling, inefficient patterns, etc.)
3. Coder agent implements improvements using documentation search for reference
4. Validator ensures new code matches documented best practices

**Deliverables**:

- 20-40 code improvement issues created and processed
- API client code refactored to match documented patterns
- Measurable improvements (fewer API errors, better rate limit handling, faster batch operations)

**Agent involvement**: This is where "near-infinite velocity" begins. Agents improve their own API integration code using crawled documentation. Human approval for major changes, agents execute implementation.

### Ongoing: Automated Updates (Monthly)

**Tasks**:

1. Weekly Perplexity queries for API changes
2. Targeted re-crawl of affected documentation
3. Update embeddings for changed content
4. Notify agents via event stream

**Deliverables**:

- Documentation stays current (max 7-day staleness)
- Agents automatically learn about API updates
- Zero manual maintenance after initial setup

---

## Cost Analysis

**One-Time Crawling (Weeks 1-5)**:

- Gemini API (content extraction): 5M tokens @ $0.15/M = $0.75
- Gemini Embedding API: 5M tokens @ $0.00001/M = $0.05
- DeepSeek API (pattern analysis): 2M tokens @ $0.28/M = $0.56
- Perplexity (research queries): 20 queries @ $5/month = included in existing sub
- **Total**: ~$1.50 for complete documentation corpus

**Ongoing Updates (Monthly)**:

- Perplexity changelog monitoring: 50 queries/month = $0 (within free tier)
- Targeted re-crawl: ~100 pages/month @ $0.15/M tokens = $0.10
- Embedding updates: ~500K tokens/month = $0.005
- **Total**: ~$0.15/month maintenance

**ROI**: After Week 5, agents answer 60-80% of implementation questions from documentation knowledge base instead of calling expensive LLM APIs with full documentation context. Estimated savings: $5-10/month in reduced token costs, plus 40% faster development (agents don't wait for human to find correct API documentation).

---

## Success Metrics

**Week 6 Targets**:

- **Coverage**: 80% of Bifrost's actual API usage covered by extracted patterns
- **Accuracy**: Agents find correct documentation in top 3 search results 90% of time
- **Performance**: Documentation search queries complete <100ms end-to-end
- **Usage**: Agents query documentation 50-100 times/day (indicates reliance on knowledge base)

**Month 3 Targets**:

- **Self-Building**: Agents complete 70% of API integration tasks without human finding documentation
- **Error Reduction**: API error rate drops 40% (agents handle errors using documented resolution strategies)
- **Velocity**: Average task completion time drops 25% (less time researching, more time implementing)

**Long-Term**:

- Documentation knowledge base becomes **definitive source of truth** for Bifrost's API integrations
- Agents proactively suggest API usage improvements based on documented best practices
- Human intervention shifts from "find documentation for agents" to "approve architectural decisions"

This is how you build near-infinite velocity: Agents that learn from comprehensive, semantically searchable, automatically updated documentation knowledge bases instead of depending on human API expertise. [perplexity](https://www.perplexity.ai/search/7a850445-74f3-4123-9606-18204c773d30)

---

## Documentation Crawling: Thin-Sliced Linear Issues

### Week 1: Foundation & Discovery (Issues 1-5)

**Issue 1: Initialize Documentation SQLite Schema**
Create the database schema for the documentation crawling system as defined in Phase 1 & 8 of the crawl plan. Include tables for `documentation_urls`, `documentation_content`, `code_examples`, and `api_patterns`. [doc_crawl.md](file:///docs/knowledge/doc_crawl.md)

**Issue 2: Build Gemini-Based Sitemap Extractor**
Implement a tool that uses Gemini's large context window to parse documentation homepages and extract organized URL lists. Test on Linear and Fly.io homepages. [doc_crawl.md](file:///docs/knowledge/doc_crawl.md)

**Issue 3: Implement DeepSeek URL Prioritization**
Create a script that uses DeepSeek to rank discovered URLs based on their relevance to Bifrost's core capabilities (orchestration, Linear management, Fly.io control). [doc_crawl.md](file:///docs/knowledge/doc_crawl.md)

**Issue 4: Create Discovery Agent MCP Server Stub**
Initialize the `documentation-discovery-agent` MCP server directory. Define the basic project structure and dependencies for the discovery tools. [doc_crawl.md](file:///docs/knowledge/doc_crawl.md)

**Issue 5: Implement Perplexity Initial Search**
Build the integration for the discovery agent to query Perplexity for canonical documentation URLs for any given tool/API name. [doc_crawl.md](file:///docs/knowledge/doc_crawl.md)

### Weeks 2-4: Extraction & Knowledge (Issues 6-10)

**Issue 6: Implement Respectful Documentation Crawler**
Build the batch downloader that respects robots.txt and implements rate-limiting (1 req/sec). Ensure robust handling of connection-level errors. [doc_crawl.md](file:///docs/knowledge/doc_crawl.md)

**Issue 7: Build Gemini Content Extraction Pipeline**
Implement the Gemini-powered parsing logic to extract structured JSON (titles, code snippets, API signatures, error codes) from raw HTML documentation pages. [doc_crawl.md](file:///docs/knowledge/doc_crawl.md)

**Issue 8: Create Code Example Isolation Logic**
Develop the script to isolate code examples into a dedicated table, classified by language and category (auth, CRUD, errors). [doc_crawl.md](file:///docs/knowledge/doc_crawl.md)

**Issue 9: Implement Pattern & Anti-Pattern Extraction**
Use DeepSeek and Gemini to identify recurring API usage patterns and semantic warnings ("deprecated", "avoid") from the extracted content. [doc_crawl.md](file:///docs/knowledge/doc_crawl.md)

**Issue 10: Build API Dependency Mapper**
Develop the logic to identify cross-platform dependencies (e.g., Linear issue needing GitHub PR) from the documentation corpus. [doc_crawl.md](file:///docs/knowledge/doc_crawl.md)

### Week 5: Semantic Search (Issues 11-13)

**Issue 11: Implement Markdown/HTML Semantic Chunking**
Build the preprocessing logic to split documentation content into semantic chunks based on header hierarchy. [doc_crawl.md](file:///docs/knowledge/doc_crawl.md)

**Issue 12: Integrate Gemini Embedding Generation**
Implement batch processing to generate vector embeddings for all documentation chunks using the Gemini Embedding API. [doc_crawl.md](file:///docs/knowledge/doc_crawl.md)

**Issue 13: Deploy Cloudflare Vectorize Search Index**
Set up the `DOCS_INDEX` in Vectorize and implement the hybrid search tool (semantic + keyword) via MCP. [doc_crawl.md](file:///docs/knowledge/doc_crawl.md)

### Week 6: System Integration (Issues 14-15)

**Issue 14: Implement Self-Updating Monitor**
Build the weekly task that queries Perplexity for changelogs and triggers targeted re-crawls for updated API sections. [doc_crawl.md](file:///docs/knowledge/doc_crawl.md)

**Issue 15: Create Documentation Audit MCP Tool**
Develop a tool that allows agents to audit their own API integration code against the crawled documentation patterns. [doc_crawl.md](file:///docs/knowledge/doc_crawl.md)


---

## Documentation Links for Bifrost Stack

### Core Platform APIs

**Linear (Project Management)**

- Main documentation: [https://linear.app/docs](https://linear.app/docs) [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/372e1f95-298a-480d-9392-e8c32c402b77/bifrost_v2_realization.md.resolved)
- Developer portal: [https://linear.app/developers](https://linear.app/developers) [linear](https://linear.app/developers)
- GraphQL API docs: [https://developers.linear.app/docs/graphql/working-with-the-graphql-api](https://developers.linear.app/docs/graphql/working-with-the-graphql-api) [rollout](https://rollout.com/integration-guides/linear/api-essentials)
- GraphQL schema: [https://studio.apollographql.com/public/Linear-API/variant/current/home](https://studio.apollographql.com/public/Linear-API/variant/current/home) [studio.apollographql](https://studio.apollographql.com/public/Linear-API/variant/current/home)
- API endpoint: `https://api.linear.app/graphql` [rollout](https://rollout.com/integration-guides/linear/api-essentials)
- Webhooks: [https://linear.app/docs/api-and-webhooks](https://linear.app/docs/api-and-webhooks) [linear](https://linear.app/docs/api-and-webhooks)

**GitHub (Version Control)**

- GraphQL API: [https://docs.github.com/en/graphql](https://docs.github.com/en/graphql) [docs.github](https://docs.github.com/en/graphql)
- REST API: [https://docs.github.com/en/rest](https://docs.github.com/en/rest)
- GitHub Apps: [https://docs.github.com/en/apps](https://docs.github.com/en/apps)
- GraphQL Explorer: [https://docs.github.com/en/graphql/overview/explorer](https://docs.github.com/en/graphql/overview/explorer) [docs.github](https://docs.github.com/en/graphql/overview/about-the-graphql-api)
- Forming GraphQL calls: [https://docs.github.com/en/graphql/guides/forming-calls-with-graphql](https://docs.github.com/en/graphql/guides/forming-calls-with-graphql) [docs.github](https://docs.github.com/en/graphql/guides/forming-calls-with-graphql)

**Fly.io (Persistent VMs & Infrastructure)**

- Main docs: [https://fly.io/docs/](https://fly.io/docs/)
- Machines API: [https://fly.io/docs/machines/api/](https://fly.io/docs/machines/api/) [fly](https://fly.io/docs/machines/api/)
- Working with Machines API: [https://fly.io/docs/machines/api/working-with-machines-api/](https://fly.io/docs/machines/api/working-with-machines-api/) [fly](https://fly.io/docs/machines/api/working-with-machines-api/)
- Apps resource: [https://fly.io/docs/machines/api-apps-resource/](https://fly.io/docs/machines/api-apps-resource/) [aa-docs.fly](https://aa-docs.fly.dev/docs/machines/api-apps-resource/)
- OpenAPI spec: [https://docs.machines.dev/swagger/index.html](https://docs.machines.dev/swagger/index.html)
- API endpoint: `https://api.machines.dev` [fly](https://fly.io/docs/machines/api/working-with-machines-api/)
- Changelog: [https://fly.io/changelog](https://fly.io/changelog)

**Cloudflare Workers (Serverless Control Plane)**

- Workers overview: [https://developers.cloudflare.com/workers/](https://developers.cloudflare.com/workers/) [developers.cloudflare](https://developers.cloudflare.com/workers/)
- Durable Objects: [https://developers.cloudflare.com/durable-objects/](https://developers.cloudflare.com/durable-objects/)
- Workers KV: [https://developers.cloudflare.com/kv/](https://developers.cloudflare.com/kv/)
- Vectorize: [https://developers.cloudflare.com/vectorize/](https://developers.cloudflare.com/vectorize/)
- R2 Storage: [https://developers.cloudflare.com/r2/](https://developers.cloudflare.com/r2/)
- API reference: [https://developers.cloudflare.com/api/](https://developers.cloudflare.com/api/)
- Workers playground: [https://tutorial.cloudflareworkers.com](https://tutorial.cloudflareworkers.com) [tutorial.cloudflareworkers](https://tutorial.cloudflareworkers.com)

### LLM Provider APIs

**DeepSeek (Primary Code Generation)**

- Official API docs: [https://api-docs.deepseek.com](https://api-docs.deepseek.com) [api-docs.deepseek](https://api-docs.deepseek.com)
- API endpoint: `https://api.deepseek.com`
- Models: `deepseek-chat` (V3), `deepseek-reasoner` (R1) [datacamp](https://www.datacamp.com/tutorial/deepseek-api)
- Platform dashboard: [https://platform.deepseek.com](https://platform.deepseek.com) [apidog](https://apidog.com/blog/how-to-use-deepseek-api-r1-v3/)

**Gemini (Large Context & Embeddings)**

- API documentation: [https://ai.google.dev/gemini-api/docs](https://ai.google.dev/gemini-api/docs) [ai.google](https://ai.google.dev/gemini-api/docs)
- API reference: [https://ai.google.dev/api](https://ai.google.dev/api) [ai.google](https://ai.google.dev/api)
- API endpoint: `https://generativelanguage.googleapis.com/v1beta/models/` [ai.google](https://ai.google.dev/api)
- Embedding endpoint: `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents`

**Perplexity (Research & Documentation Search)**

- API docs: [https://docs.perplexity.ai](https://docs.perplexity.ai)
- API endpoint: `https://api.perplexity.ai`

---

## Automated Documentation Discovery System

**Purpose**: Enable Bifrost to autonomously find, validate, and index documentation for any tool/API you add to the stack, without manual URL hunting.

### System Architecture

**Two-Phase Approach**:

1. **Discovery Phase**: Find documentation URLs using AI-powered search
2. **Validation Phase**: Verify found URLs are official/canonical documentation

### Phase 1: Documentation URL Discovery (Gemini + Perplexity Hybrid)

**Goal**: Given a tool name (e.g., "Temporal.io", "LangGraph", "AutoGen"), automatically locate its official documentation site.

**Implementation Strategy**:

**Step 1: Initial Search** (Perplexity for recent/canonical sources)

**Process**:

1. User adds new tool to Bifrost stack: "Add Temporal.io for workflow orchestration"
2. System extracts tool name: `"Temporal.io"`
3. Construct Perplexity query: `"Temporal.io official documentation site API reference"`
4. Perplexity returns cited results with URLs
5. Extract documentation URLs from citations

**Why Perplexity first**: Returns current, cited sources with confidence scores. Better at finding "official" documentation vs. third-party tutorials. Pro search includes sources with domain authority indicators.

**Example query/response**:

```
Query: "Temporal.io official documentation site API reference"

Perplexity response (with citations):
"Temporal's official documentation is at https://docs.temporal.io.
The API reference is available at https://docs.temporal.io/api.
Temporal uses a polyglot SDK approach with separate documentation
for TypeScript (https://typescript.temporal.io), Python, Go, and Java."

Citations: [docs.temporal.io], [github.com/temporalio/documentation]
```

**Step 2: URL Expansion** (Gemini for sitemap analysis)

**Process**:

1. Take discovered base URL (e.g., `https://docs.temporal.io`)
2. Fetch homepage HTML
3. Feed to Gemini: "Extract all documentation section URLs from this page. Identify: Getting Started, API Reference, Guides/Tutorials, SDK docs, Examples, Changelog. Return structured JSON with categories."
4. Gemini returns organized URL list

**Why Gemini**: Large context window (2M tokens) handles entire HTML page with navigation menus, footer links, sidebars. Understands document structure semantically (differentiates "API Reference" from "Pricing" links).

**Example output**:

```json
{
  "base_url": "https://docs.temporal.io",
  "sections": {
    "getting_started": [
      "https://docs.temporal.io/getting-started",
      "https://docs.temporal.io/quickstart"
    ],
    "api_reference": ["https://docs.temporal.io/api", "https://typescript.temporal.io/api"],
    "guides": ["https://docs.temporal.io/workflows", "https://docs.temporal.io/activities"],
    "sdk": ["https://typescript.temporal.io", "https://python.temporal.io"],
    "examples": ["https://github.com/temporalio/samples-typescript"]
  }
}
```

**Step 3: Validation** (DeepSeek for URL pattern analysis)

**Process**:

1. Query discovered URLs
2. Feed to DeepSeek: "Validate these are official documentation URLs. Check: (1) Domain matches official project domain, (2) No third-party tutorial sites (medium.com, dev.to), (3) URLs are live (not 404), (4) Content type is documentation (not marketing/sales pages). Flag suspicious URLs."
3. DeepSeek analyzes patterns, flags issues

**Why DeepSeek**: Cost-effective for analytical filtering. Recognizes URL patterns (official docs usually on `docs.` subdomain or `/docs/` path). Identifies third-party domains.

**Example validation**:

```json
{
  "validated_urls": [
    {
      "url": "https://docs.temporal.io/api",
      "status": "valid",
      "confidence": 0.95,
      "reason": "Official domain, /api path, responds 200"
    },
    {
      "url": "https://medium.com/temporal-tutorials",
      "status": "rejected",
      "confidence": 0.9,
      "reason": "Third-party domain, not official documentation"
    }
  ]
}
```

---

### Phase 2: Automated Documentation Indexing (Self-Initiating Crawl)

**Goal**: Once URLs validated, automatically trigger the 8-phase documentation crawling plan without human intervention.

**Trigger Mechanism**:

**Event-Driven Architecture**:

1. User adds tool to stack: `POST /api/tools` with `{name: "Temporal.io", purpose: "workflow orchestration"}`
2. System publishes event: `tool_added(tool_name, purpose, timestamp)`
3. Documentation Discovery Agent (MCP server) subscribes to `tool_added` events
4. On receiving event, agent initiates discovery workflow

**Discovery Workflow (Automated)**:

**Step 1: URL Discovery** (2-5 minutes, fully autonomous)

```
1. Query Perplexity for official docs
2. Extract base URLs from citations
3. Fetch homepage HTML for each base URL
4. Parse with Gemini to extract section URLs
5. Validate with DeepSeek
6. Store validated URLs: INSERT INTO documentation_urls
7. Publish event: documentation_urls_discovered(tool_name, url_count)
```

**Step 2: Initiate Crawl Plan** (Auto-trigger Phases 2-8)

```
1. Query discovered URLs from database
2. Prioritize URLs using DeepSeek (as described in original plan Phase 1)
3. Create crawl job: INSERT INTO crawl_jobs(tool_name, urls, status='queued')
4. Publish event: crawl_job_created(job_id, tool_name, url_count)
5. Crawl Coordinator (separate MCP server) picks up job
6. Executes Phases 2-8 of original plan automatically
7. Publishes progress events: crawl_phase_completed(job_id, phase, duration)
```

**Step 3: Index & Notify** (Completion)

```
1. Generate embeddings for crawled content
2. Index in Vectorize
3. Update tool metadata: UPDATE tools SET docs_indexed=true, last_crawled=NOW()
4. Publish event: documentation_indexed(tool_name, chunk_count, embedding_count)
5. Notify user: "Temporal.io documentation indexed. 347 pages, 2,134 code examples available for agent queries."
```

---

### Discovery Agent Implementation

**MCP Server: `documentation-discovery-agent`**

**Tools Exposed**:

**1. `discover_documentation`**

```typescript
{
  name: "discover_documentation",
  description: "Automatically find and index documentation for a tool/API",
  parameters: {
    tool_name: "Name of tool (e.g., 'Temporal.io', 'LangGraph')",
    tool_purpose: "What this tool does (helps refine search)",
    auto_crawl: true // If true, automatically triggers full crawl
  },
  returns: {
    discovered_urls: ["https://docs.temporal.io", "..."],
    validation_status: "95% confidence official docs",
    crawl_job_id: "uuid",
    estimated_completion: "15-20 minutes"
  }
}
```

**2. `validate_documentation_url`**

```typescript
{
  name: "validate_documentation_url",
  description: "Check if URL is official documentation (not tutorial/blog)",
  parameters: {
    url: "URL to validate",
    expected_domain: "Optional: Known official domain"
  },
  returns: {
    is_valid: true,
    confidence: 0.95,
    reason: "Official domain, API reference structure detected",
    warnings: []
  }
}
```

**3. `get_crawl_status`**

```typescript
{
  name: "get_crawl_status",
  description: "Check progress of documentation crawl job",
  parameters: {
    job_id: "Crawl job identifier"
  },
  returns: {
    status: "in_progress",
    phase: "Phase 3: Pattern Extraction",
    progress: "127/347 pages processed",
    eta: "8 minutes",
    errors: []
  }
}
```

**Agent Workflow**:

**User Action**: `"Add Temporal.io to Bifrost stack for epic-scale workflows"`

**Agent Response** (autonomous sequence):

```
1. Extract tool name: "Temporal.io"
2. Call discover_documentation("Temporal.io", "epic-scale workflows", auto_crawl=true)
3. Agent internally:
   a. Query Perplexity: "Temporal.io official documentation API reference"
   b. Extract URLs from citations
   c. Fetch homepages, parse with Gemini
   d. Validate with DeepSeek
   e. Store in database
   f. Create crawl job
   g. Trigger crawl coordinator
4. Return to user: "Found Temporal.io documentation. Crawling 347 pages (job #abc-123).
   Estimated completion: 15 minutes. I'll notify you when agents can query Temporal docs."
5. 15 minutes later, publish event: documentation_indexed
6. Agent posts Linear comment: "Temporal.io documentation now available.
   Architect can reference workflow patterns, Coder can query API examples."
```

---

### Self-Expanding Documentation System

**Key Insight**: Once discovery agent exists, Bifrost can automatically document **any** tool it encounters.

**Scenarios Where This Triggers**:

**Scenario 1: Agent Encounters Unknown Tool**

**Context**: Troubleshooter researching error mentions "Prisma ORM"

**Workflow**:

1. Troubleshooter detects unknown term: "Prisma ORM"
2. Checks documentation index: `SELECT * FROM tools WHERE name LIKE '%Prisma%'` → No results
3. Calls MCP tool: `discover_documentation("Prisma ORM", "database ORM mentioned in error context")`
4. Discovery agent finds docs, initiates crawl
5. Troubleshooter continues research using other sources while crawl completes
6. Future errors involving Prisma: Documentation already indexed

**Scenario 2: Human Adds Integration**

**Context**: User decides to integrate Stripe for payments

**Workflow**:

1. User submits Linear issue: "Integrate Stripe for subscription billing"
2. Architect agent processes issue, detects new tool: "Stripe"
3. Checks documentation index: Not found
4. Calls `discover_documentation("Stripe", "subscription billing integration", auto_crawl=true)`
5. Architect designs integration while crawl runs in background
6. By time Coder agent starts implementation, Stripe docs indexed
7. Coder queries: "How to create Stripe subscription with trial period?" → Returns official examples

**Scenario 3: Dependency Discovery**

**Context**: Coder installing npm package `@temporalio/client`

**Workflow**:

1. Coder generates `package.json` with new dependency
2. Pre-commit hook (or Validator) detects new package
3. Extracts package name, queries npm registry for homepage URL
4. If homepage is documentation site, calls `discover_documentation`
5. Builds documentation index proactively
6. Future tasks using that package have docs available immediately

---

### Discovery Agent Configuration (Self-Building Bootstrap)

**How to Build This**:

**Week 1: Manual Bootstrap** (You build initial discovery agent)

**Tasks**:

1. Create MCP server structure: `documentation-discovery-agent/`
2. Implement Perplexity query function
3. Implement Gemini HTML parsing function
4. Implement DeepSeek validation function
5. Expose `discover_documentation` MCP tool
6. Test on 3 known tools (Linear, Fly.io, Cloudflare) to validate workflow

**Week 2: Self-Building Takeover** (Bifrost improves its own discovery agent)

**Tasks**:

1. Submit Linear issue: "Improve documentation discovery agent: Add URL deduplication, better error handling, retry logic"
2. Architect decomposes into 5 tasks
3. Coder implements improvements using discovered documentation patterns
4. Validator tests discovery agent on 10 diverse tools
5. System iterates: If discovery fails, Troubleshooter researches why, Coder fixes bugs

**Month 2-3: Full Autonomy**

At this point, Bifrost autonomously:

- Discovers documentation for any tool mentioned in issues
- Crawls and indexes without human intervention
- Notifies when documentation ready for agent queries
- Self-heals: If crawl fails, Troubleshooter investigates, proposes fixes, Coder implements

---

## Storage Schema for Discovery System

**New Tables**:

```sql
-- Tools in Bifrost's stack
tools (
  id UUID PRIMARY KEY,
  name TEXT, -- "Temporal.io", "Linear", "Stripe"
  purpose TEXT, -- "workflow orchestration", "project management"
  added_date TIMESTAMP,
  docs_indexed BOOLEAN DEFAULT false,
  last_crawled TIMESTAMP
)

-- Documentation URLs discovered per tool
documentation_urls (
  id UUID PRIMARY KEY,
  tool_id UUID REFERENCES tools(id),
  url TEXT,
  category TEXT, -- "api_reference", "guides", "examples", "sdk"
  priority_score FLOAT, -- 0.0-1.0, higher = more relevant
  validation_status TEXT, -- "validated", "rejected", "pending"
  validation_confidence FLOAT,
  discovered_date TIMESTAMP
)

-- Crawl jobs tracking
crawl_jobs (
  id UUID PRIMARY KEY,
  tool_id UUID REFERENCES tools(id),
  status TEXT, -- "queued", "in_progress", "completed", "failed"
  current_phase TEXT, -- "url_discovery", "content_extraction", "embedding_generation"
  progress_current INT,
  progress_total INT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT
)

-- Discovery metadata (what agent learned during discovery)
discovery_metadata (
  tool_id UUID REFERENCES tools(id),
  key TEXT, -- "official_domain", "sdk_languages", "api_type"
  value TEXT,
  discovered_date TIMESTAMP
)
```

---

## Cost Analysis: Discovery System

**Per-Tool Discovery Cost**:

- Perplexity query: $0 (within subscription, 1 query per tool)
- Gemini HTML parsing: ~50K tokens @ $0.15/M = $0.0075
- DeepSeek validation: ~10K tokens @ $0.28/M = $0.0028
- **Total per tool**: ~$0.01

**Full Crawl Cost** (Phase 2-8):

- Covered in original plan: ~$1.50 per tool

**Realistic Usage**:

- Month 1: Crawl existing stack (Linear, GitHub, Fly.io, Cloudflare, DeepSeek, Gemini) = 6 tools × $1.50 = $9
- Month 2-6: Add 1-2 new tools/month = 2 × $1.50 = $3/month average
- Ongoing updates: ~$0.15/month for all tools (targeted re-crawls)

**Total investment**:

- Initial: $9 (one-time)
- Ongoing: $3-5/month (new tools + updates)

**ROI**: Eliminates 2-4 hours/week of human documentation hunting (80-160 hours/year). At $50/hour value of human time, saves $4,000-8,000/year. Pays for itself in first month.

---

## Summary: Self-Expanding Documentation Knowledge

**What you get**:

1. **Curated documentation links** for your entire current stack (already provided above)
2. **Autonomous discovery system** that finds docs for any new tool you add
3. **Automatic crawling** triggered by discovery (Phases 1-8 of original plan)
4. **Self-healing**: If discovery fails, Troubleshooter researches alternatives, system improves itself
5. **Zero maintenance**: Once built, system maintains its own documentation index

**User experience**:

- You: "Add Temporal.io for workflow orchestration"
- Bifrost: "Found Temporal.io docs at https://docs.temporal.io. Crawling now. ETA 15 min."
- 15 minutes later: "Temporal.io documentation indexed. 2,341 code examples available."
- Architect agent (designing epic): Queries Temporal patterns, incorporates into design
- Coder agent (implementing): References official Temporal SDK examples
- **Zero human documentation hunting**

This is infrastructure for near-infinite velocity: Agents learn about any tool autonomously, no human bottleneck for "where's the documentation?" [perplexity](https://www.perplexity.ai/search/7a850445-74f3-4123-9606-18204c773d30)
