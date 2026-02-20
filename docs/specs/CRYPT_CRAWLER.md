# Documentation Crawler Specification

> [!IMPORTANT]
> **Status**: Approved for Implementation
> **Phase**: 6 (Audit & Refactor)
> **Source**: Refactored from `_INBOX/doc_crawl.md`

## Overview

The **Documentation Crawler** (codenamed "Crypt Crawler") is an autonomous system for systematic ingestion, analysis, and indexing of external API documentation (Linear, Fly.io, Cloudflare, etc.). It transforms static HTML docs into a semantic knowledge base that agents can query to solve implementation challenges without hallucination.

## Workflow Phases

### Phase 1: Discovery ("Tomb Trawler")

1.  **Sitemap Extraction**: Use Gemini 2.5 Flash to parse homepages and extract all documentation links.
2.  **Deduplication**: DeepSeek analyzes URLs to prioritize API references over marketing pages.
3.  **Validation**: Verify URLs are canonical and accessible.

### Phase 2: Extraction ("Grave Grafter")

1.  **Content Scraping**: Fetch HTML (respecting `robots.txt` and rate limits).
2.  **Structuring**: Gemini extracts:
    - Code examples (with language tags)
    - API signatures
    - Error codes
    - Best practices
3.  **Storage**:
    - `documentation_content` (raw/structured)
    - `code_examples` (isolated snippets)

### Phase 3: Pattern Mining ("Bone Builder")

1.  **Workflow Analysis**: DeepSeek analyzes code examples to find common patterns (e.g., "Auth -> Query -> Mutate").
2.  **Anti-Pattern Detection**: Gemini identifies "Warnings" and "Deprecations".
3.  **Dependency Mapping**: Map which APIs require others (e.g., `createMachine` requires `createApp`).

### Phase 4: Semantic Indexing ("Veil Vault")

1.  **Chunking**: Split docs by header/concept.
2.  **Embedding**: Generate vectors via Gemini Embedding API.
3.  **Storage**: Cloudflare Vectorize.
4.  **Interface**: MCP Tool `search_documentation(query, platform)`.

## Data Schema

### `documentation_urls`

- `url`: string (PK)
- `platform`: string (Linear, Fly, etc)
- `category`: string
- `priority`: number (0-100)

### `code_examples`

- `id`: uuid
- `language`: string
- `content`: text
- `context`: text
- `tags`: string[]

### `api_patterns`

- `name`: string
- `steps`: json[]
- `dependencies`: string[]

## Agent Integration

- **Coder**: Queries for implementation patterns.
- **Troubleshooter**: Queries for error codes and resolution steps.
- **Architect**: Queries for system capabilities and limits.

## Continuous Updates ("Revenant Rhythm")

- Weekly Perplexity scan for changelogs.
- Targeted re-crawl of changed sections.
- Event broadcast: `bifrost.docs.updated` triggers agent cache invalidation.
