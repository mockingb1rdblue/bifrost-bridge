# Swarm Backlog (The Single Source of Truth)

> [!IMPORTANT]
> This is the **Active Mission Board** for the Sluagh Swarm. All work is tracked here.
> **Format**: `[ID] Task Description` (Status: pending `[ ]` | active `[/]` | done `[x]`)

### Mission 1: The Cairn Codex (Project Management)
- [/] **[CC-01] Schema Design**: Define `ProjectSpec` and schemas. (See [CAIRN_CODEX.md](specs/CAIRN_CODEX.md))
- [/] **[CC-02] Linear SDK Wrapper**: Create `LinearOrchestrator` class. (See [CAIRN_CODEX.md](specs/CAIRN_CODEX.md))
- [/] **[CC-03] Natural Language Parser**: Implement `ProjectSpecParser` with Perplexity.
- [ ] **[CC-04] MCP Tool**: Expose `create_structured_project` tool.
- [ ] [CC-03] **Dependency Logic**: Implement graph resolution logic (blocking/soft dependencies).
- [ ] [CC-04] **Status Workflow**: Implement state machine for task transitions (Pending -> Active -> Done).
- [ ] [CC-05] **Auth Layer**: Implement simple API key auth for Swarm Agents.
- [ ] [CC-06] **Web Interface (MVP)**: Minimal React/HTML dashboard for human oversight.
- [ ] [CC-07] **Migration**: Script to export existing Linear backlog and import to Codex.

### Mission 2: Liminal Library (Context Engine)
- [ ] **[LL-01] Indexer Sprite**: Deploy Fly.io Sprite for `bifrost-indexer`. (See [LIMINAL_LIBRARY.md](specs/LIMINAL_LIBRARY.md))
- [ ] **[LL-02] Vector Storage**: Configure SQLite `vec0` on persistent volume.
- [ ] **[LL-03] MCP Query Interface**: Build `semantic_code_search` tool.
- [ ] [LL-01] **Indexer Sprite**: Deploy `bifrost-indexer` Sprite on Fly.io (Storage-optimized).
- [ ] [LL-02] **Chunking Engine**: Implement tree-sitter based semantic chunking (TypeScript/Python).
- [ ] [LL-03] **Embedding Pipeline**: Integrate Gemini/DeepSeek API for vector generation.
- [ ] [LL-04] **Vector Storage**: Implement `sqlite-vec` or similar local vector store on Sprite volume.
- [ ] [LL-05] **MCP Server**: Build `bifrost-context-mcp` Cloudflare Worker for agent queries.
- [ ] [LL-06] **Git Awareness**: Implement diff-based incremental re-indexing.

### Mission 3: Documentation Discovery
- [ ] **[DD-01] Crawler Logic**: Implement Gemini-based sitemap extractor. (See [CRYPT_CRAWLER.md](specs/CRYPT_CRAWLER.md))
- [ ] **[DD-02] Pattern Miner**: Build DeepSeek analysis pipeline for code examples.
- [ ] **[DD-03] Auto-Updater**: Cron job for "Revenant Rhythm" (weekly re-crawl).
- [ ] [DD-01] **URL Discovery**: Implement Perplexity-based "official docs" finder.
- [ ] [DD-02] **Sitemap/Crawl**: Implement respectful crawler (Gemini-guided sitemap parsing).
- [ ] [DD-03] **Content Extraction**: Build HTML-to-Markdown extractor using Gemini 2.0 Flash.
- [ ] [DD-04] **Code Isolation**: Extract code blocks into dedicated `code_examples` DB.
- [ ] [DD-05] **Pattern Mining**: DeepSeek analysis of code blocks for utilization patterns.
- [ ] [DD-06] **Auto-Update**: Scheduled "What changed?" queries via Perplexity.

## 🐝 Mission: Sluagh Swarm Resilience
*Hardening the worker fleet against entropy.*

- [ ] [SSR-01] **Idempotent DB**: Refactor `db.ts` to use proper `schema_migrations` table.
- [ ] [SSR-02] **Event Health**: Add `Eulogy Engine` health check before batch delivery.
- [ ] [SSR-03] **Circuit Breakers**: Implement exponential backoff for all external API calls.
- [ ] [SSR-04] **Telemetry**: Enhance Sluagh Task logging with "Retry Count" and "Error Signature".

## 🔐 Mission: Operational Hygiene & Security
*Zero Local Secrets and Environment Integrity.*

- [ ] [OPS-01] **Env Validation**: Update `maintenance-loop.sh` to pre-validate Cloudflare environments.
- [ ] [OPS-02] **Secret Resolver**: Design "Abyssal Artifact Resolution" worker (secure proxy for local dev).
- [ ] [OPS-03] **Env Warning Fix**: Implement `wrangler` wrappers to enforce `--env` flags (Cloudflare warning).
- [ ] [OPS-04] **Audit**: Monthly secret rotation drill (manual trigger).
- [ ] [OPS-05] **Secret Rotation Automator**: Implement Dual-Key Rotation worker on Cron Trigger.

## 🔮 The Icebox (Future Visions)

- [ ] **Research Proxy**: Deploy Cloudflare Worker for Perplexity access ([VEIL_VAULT.md](specs/VEIL_VAULT.md)).
- [ ] **Router**: Deploy "Dullahan" smart router ([DULLAHAN_DISPATCH.md](specs/DULLAHAN_DISPATCH.md)).
- [ ] **Chrome Testing**: Implement visual verification pipeline ([GHOST_EYE.md](specs/GHOST_EYE.md)).
- [ ] **Neural Mesh**: LangGraph-based multi-agent collaboration (v3 Roadmap).
- [ ] **Corporate Bridge**: SharePoint/Jira indexing via Power Automate.
- [ ] **Self-Hosting**: Move generic LLM calls to local models (DeepSeek R1 distilled).

## 💀 Grave Grievances (High-Severity Tech Debt)
*Transferred from legacy Grave_Grievances.md*

- [ ] [GG-01] **Durable Object Deadlock**: ReaperDO deadlocks during high telemetry bursts. Needs non-blocking logging.
- [ ] [GG-02] **Ghost Workers**: `recover-artifacts.ps1` drift creates ghost workers on Cloudflare.
- [ ] [GG-03] **Legacy Naming**: `src/` code still references "Bifrost" and "Worker Bees". Needs deep refactor.
- [ ] [GG-04] **Test Flakiness**: `integration.test.ts` fails due to Fly.io volume locks during rapid restarts.
- [ ] [GG-05] **Sluagh Verify**: Implement `sluagh:verify` phase in the registry.
- [ ] [GG-06] **Script Migration**: Migrate all scripts to `relics/node_modules` pattern.

## 🏺 Historical Relics (Restored Knowledge)
*Restored from strict vacuum audit. Contains valuable implementation details not fully captured in summaries.*

- [Backlog Archive](file:///Users/mock1ng/Documents/Projects/Antigravity-Github/bifrost-bridge/docs/relics/archive/backlog) (50+ files including Router Architecture, Corporate Proxy Code, and Vision Statements)
