# Swarm Library Bulk Ingestion Queue

> **Goal:** Extend the local SQLite knowledge base (`.data/library.sqlite`) by discovering sitemaps for the missing tech stack recommendations from Perplexity, and then executing the streaming HTML-to-Markdown extraction pipeline over all discovered sitemaps.
> **Context:** All API keys are securely managed via Cloudflare KV. Commands MUST use the `secure:exec` wrapper to function.

## Phase 1: Discover Missing Recommendation Sitemaps

Execute the `1-discover-urls.ts` script for each of the core missing technologies recommended by Perplexity.

- [ ] Discover LangGraph Sitemaps
  - **Command:** `npm run secure:exec scripts/library/1-discover-urls.ts "LangGraph TypeScript"`
- [ ] Discover CrewAI Sitemaps
  - **Command:** `npm run secure:exec scripts/library/1-discover-urls.ts "CrewAI"`
- [ ] Discover Vellum Sitemaps
  - **Command:** `npm run secure:exec scripts/library/1-discover-urls.ts "Vellum AI API"`
- [ ] Discover Zod & Valibot Sitemaps
  - **Command:** `npm run secure:exec scripts/library/1-discover-urls.ts "Zod TypeScript validation"`
  - **Command:** `npm run secure:exec scripts/library/1-discover-urls.ts "Valibot"`
- [ ] Discover Linear SDK Sitemaps
  - **Command:** `npm run secure:exec scripts/library/1-discover-urls.ts "@linear/sdk"`
- [ ] Discover GitHub Actions & Octokit Sitemaps
  - **Command:** `npm run secure:exec scripts/library/1-discover-urls.ts "GitHub Actions API"`
  - **Command:** `npm run secure:exec scripts/library/1-discover-urls.ts "Octokit REST.js"`
- [ ] Discover OpenTelemetry Sitemaps
  - **Command:** `npm run secure:exec scripts/library/1-discover-urls.ts "OpenTelemetry Node.js"`

---

## Phase 2: Bulk HTML-to-Markdown Extraction

Once _all_ sitemaps exist as `.json` files inside `docs/temp-library/raw/sitemaps/`, execute the extraction script.
_Note: This script iterates over all local sitemaps and streams raw HTML into Gemini Flash Lite to extract structured Markdown chunks directly into `immutable_chunks` within the SQLite DB._

- [ ] Run the Extraction Script
  - **Command:** `npm run secure:exec scripts/library/2-extract-content.ts`
  - _Verify:_ Ensure there are no Node out-of-memory crashes. The script uses data streams, but watch the console.

---

## Phase 3: Pattern Mining & Embedding Generation

After HTML is converted to Markdown prose and Code Blocks, we must embed them using `gemini-embedding-001` to enable local cosine-similarity vector searches.

- [ ] Run the Pattern Miner
  - **Command:** `npm run secure:exec scripts/library/3-mine-patterns.ts`
  - _Verify:_ The script should log "Embedding prose for..." and output the total number of blocks extracted. Ensure `library.sqlite` increases in file size as vector BLOBs are ingested.
