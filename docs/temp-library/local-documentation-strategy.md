# Local Documentation Strategy: The Swarm Library

> **Goal**: Create our own local source of truth by scraping APIs and official documentation. We will build, run, and perfect this pipeline entirely _locally_ before even considering cloud deployment (Fly.io/Cloudflare).

---

## 🧭 The Core Directives

1. **Start Local First**: No deploy commands. No Webhooks. We will write local scripts (Node/Bun/Deno/Python) that parse, scrape, and build the local knowledge base.
2. **Ingest Everything**: Based on `docs/_INGEST/readme.md`, any new raw documentation should trigger a search across all `md` in `/docs` and subfolders. We merge, refactor, and thin-slice the contents into trackable issues.
3. **Zero Configuration Hell**: We use standard `.env` keys locally (`LINEAR_API_KEY`, `GEMINI_API_KEY`, etc.) and output directly to the local filesystem or a local SQLite database (`sqlite-vec`).
4. **Performance Optimized**: Local database connections must use `WAL` mode and wrapped transactions. LLM extractions will use a progressive escalation strategy (cheapest models first).

## 📚 The Data Pipeline (Refactored for Local Execution)

This pipeline adapts "Mission 3: Documentation Discovery" from the `SWARM_BACKLOG.md` into a purely local toolkit.

### Phase 1: URL Discovery & Sitemap Crawling (Local Script)

- **Objective**: Find the official documentation and map it out.
- **Linear Hooks (Bifrost v3)**: Maps to `BIF-282 (Perplexity Initial Search)`, `BIF-280 (DeepSeek URL Prioritization)`, `BIF-279 (Gemini Sitemap Extractor)`, and `BIF-283 (Documentation Crawler)`.
- **Action**: Create a local script `scripts/library/1-discover-urls.ts`.
- **Implementation**:
  - Use **Perplexity API** (via `curl` or local SDK) to execute "find official developer documentation for X".
  - Feed the top URL into a local sitemap parser.
  - Output results to `docs/temp-library/raw/sitemaps/`.

### Phase 2: Content Extraction (Local Script)

- **Objective**: Scrape the identified URLs respectfully and convert them to clean Markdown.
- **Linear Hooks (Bifrost v3)**: Maps to `BIF-284 (Gemini Content Extraction Pipeline)`.
- **Action**: Create `scripts/library/2-extract-content.ts`.
- **Implementation**:
  - Fetch HTML locally using stream processing to handle massive docs without memory limits.
  - Implement a **Progressive LLM Strategy**: Pass raw HTML to `gemini-flash-lite` first to extract core technical documentation into Markdown. Monitor output structure; if it fails validation, escalate to `gemini-flash`.
  - Enforce strict structured Output schemas (JSON/Pydantic style) for predictable content blocks.
  - Save the resulting `.md` files into `docs/temp-library/raw/markdown/`.

### Phase 3: Code Isolation & Pattern Mining (Local Script)

- **Objective**: Separate the prose from the code, and understand the code.
- **Linear Hooks (Bifrost v3)**: Maps to `BIF-278 (Documentation SQLite Schema)`, `BIF-285 (Code Example Isolation Logic)`, `BIF-286 (Pattern & Anti-Pattern Extraction)`, and `BIF-287 (API Dependency Mapper)`.
- **Action**: Create `scripts/library/3-mine-patterns.ts`.
- **Implementation**:
  - Scan the extracted Markdown for triple-backtick code blocks.
  - Establish connection to a local SQLite database configured for high throughput (`PRAGMA journal_mode=WAL;`, `BEGIN TRANSACTION`).
  - Extract code blocks into the local `code_examples` table, and use the `sqlite-vec` extension to generate semantic embeddings for future RAG searches.
  - Use **DeepSeek V3** (local API call) to analyze the blocks: `"What is the primary pattern being demonstrated here?"`

### Phase 4: Integration & Synthesis (Local Script)

- **Objective**: Blend the new knowledge into our existing `/docs` structure and Backlog.
- **Action**: Create `scripts/library/4-synthesize-knowledge.ts`.
- **Implementation**:
  - Read `docs/_INGEST/readme.md` instructions: perform a local semantic or text search over all `/docs/**/*.md`.
  - If relevant docs exist, merge the new knowledge into them.
  - Thin-slice the actionable insights into new issues and write them locally to `docs/SWARM_BACKLOG.md` or append to `docs/issues-and-enhancements.md`.

## 🐝 How This Replaces the Cloud Version (For Now)

| Cloud Plan (SWARM_BACKLOG.md) | Local Refactor (Do This First)                              |
| :---------------------------- | :---------------------------------------------------------- |
| Cloudflare Cron Triggers      | Local `cron` or manual executions (`npm run library:sync`). |
| Cloudflare D1 (Global Reads)  | Local SQLite DB with `WAL` mode (`.data/library.sqlite`).   |
| Cloudflare Vectorize          | Local `sqlite-vec` vector embeddings.                       |
| Linear Webhooks integration   | Local periodic `npx tsx scripts/linear/sync.ts` script.     |

> **Migration Path**: The "Immutable Truths" locked in our local SQLite will simply be migrated directly via `wrangler d1 execute` when deploying to prod, seamlessly mapping local schemas to D1 and `sqlite-vec` to Vectorize.

## 🚀 Execution Steps (Next Actions)

1. [ ] **Setup Directory**: Ensure `scripts/library/` and `docs/temp-library/raw/` exist.
2. [ ] **Build `1-discover-urls.ts`**: A simple Typscript file taking a query, hitting Perplexity, and saving a JSON list of target URLs.
3. [ ] **Build `2-extract-content.ts`**: A script that iterates over the JSON, fetches, calls Gemini, and writes `.md`.
4. [ ] **Build SQLite Schema**: Initialize the local DB for the vectors and code examples.

> By doing this locally, we iterate 10x faster, debug instantly, and ensure the logic is flawless before fighting with Wrangler configurations or Fly.io volume mounts.
