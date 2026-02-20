# Context Engine Specification

> [!IMPORTANT]
> **Status**: Approved for Implementation
> **Phase**: 6 (Audit & Refactor)
> **Source**: Refactored from `_INBOX/context_engine.md`

## Overview

The **Context Engine** (codenamed "Liminal Library") is a distributed, semantic indexing system designed to give Bifrost agents "Augment-style" codebase intelligence without external dependencies or recurring costs. It leverages a dual-plane architecture (Fly.io for compute/storage, Cloudflare for routing) to maintain a persistent, semantic map of the entire project.

## Core Architecture

### 1. The Indexer ("Scribe's Specter")
- **Type**: Persistent Fly.io Sprite
- **Function**: Maintains the semantic index of the codebase.
- **Storage**: SQLite with `vec0` extension (vector search) on persistent volume.
- **Protocol**: 
    - Watches `bifrost-events` for code changes (commits, merges).
    - Parses files using Tree-sitter for semantic chunking (functions, classes).
    - Generates embeddings using DeepSeek V3 or Gemini (batch mode).
    - Upserts vectors to SQLite.

### 2. The Query Interface ("Threshold's Test")
- **Type**: MCP Server (Cloudflare Worker)
- **Function**: Exposes the index as a tool to agents.
- **Tool Schema**:
    ```typescript
    {
      name: "semantic_code_search",
      parameters: {
        query: "natural language description",
        scope: "repo_name" | "all",
        time_filter: "optional timestamp",
        result_count: 5
      }
    }
    ```

### 3. The Knowledge Graph ("Ossuary Archive")
- **Type**: Dependency Graph (SQLite Adjacency List)
- **Function**: Maps relationships between modules.
- **Logic**: 
    - Parses `package.json`, imports, and exports.
    - Enables "2-hop" retrieval: Querying "Auth" returns `auth.ts` PLUS `middleware/auth.ts` and `user.model.ts`.

## Implementation Roadmap

### Phase 1: Infrastructure (Week 1-2)
- [ ] Deploy `bifrost-indexer` Sprite on Fly.io.
- [ ] Implement SQLite `vec0` schema.
- [ ] Build basic ingestion pipeline (scan `src/`, chunk, embed).

### Phase 2: MCP Integration (Week 2-3)
- [ ] Create `bifrost-context-mcp` Worker.
- [ ] Implement `semantic_code_search` tool.
- [ ] Connect MCP to Cursor/Cline.

### Phase 3: Advanced Context (Week 3-4)
- [ ] Implement Tree-sitter based chunking (vs lines).
- [ ] Build dependency graph parser.
- [ ] Enable cross-repo search (linear-worker + bifrost-bridge).

## Cost Analysis
- **Indexing**: ~$0.0001/1K tokens (DeepSeek).
- **Storage**: ~$0.00 (Fly.io Volume included in free tier or low cost).
- **Compute**: minimal (event-driven).
- **Comparison**: Augment ($hundreds/mo) vs Bifrost (<$5/mo).

## Naming Convention
- **System**: Liminal Library
- **Indexer**: Scribe's Specter
- **Search**: Veil Vault
