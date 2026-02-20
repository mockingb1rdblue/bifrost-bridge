# AI Router Architecture Specification

> [!IMPORTANT]
> **Status**: Approved for Implementation
> **Phase**: 6 (Audit & Refactor)
> **Source**: Refactored from `113_AI_Router_Architecture.md`

## Overview

The **AI Router** (codenamed "Dullahan Dispatcher") is a self-optimizing, cost-aware proxy server hosted on Fly.io. It acts as the single "OpenAI-compatible" endpoint for all development tools (VS Code, Cursor, scripts), routing requests to the most cost-effective provider (DeepSeek, Gemini, Local) based on task complexity and budget.

## Core Architecture

### 1. The Proxy ("Dullahan")
- **Scale-to-Zero**: Runs on Fly.io, auto-stops when idle.
- **Protocol**: OpenAI-compatible `v1/chat/completions` endpoint.
- **Storage**: SQLite for logs and optimization data strings.

### 2. Routing Policy Engine

#### Tier 1: Tactical Coding (DeepSeek V3)
- **Trigger**: Prompt < 4k tokens, task type "edit", "debug", "refactor".
- **Cost Target**: < $0.10 / day.
- **Provider**: `deepseek-chat`.

#### Tier 2: Reasoning & Planning (DeepSeek R1 / Gemini)
- **Trigger**: "Plan a refactor", "Analyze architecture", or Prompt > 4k tokens.
- **Provider**: `deepseek-reasoner` or `gemini-pro-latest`.
- **Strategy**: Use huge context windows only when necessary.

### 3. The "Global Brain" Pipeline
For large refactors, the router uses a 3-phase split:
1.  **Indexing**: Maps file sizes/dependencies (no code).
2.  **Planning**: Sends Map to R1/Gemini -> Returns JSON Plan.
3.  **Execution**: Sends only relevant file slices to V3 for editing.

### 4. Background Hardening Agent
- **Trigger**: Idle time + cached prompts available.
- **Tasks**: Scan for `TODO`, generate tests, auto-merge green PRs.
- **Activity Awareness**: Pauses if user is active in VS Code.

## Human-in-the-Loop (HITL)
- **High Risk**: Deleting tables, bulk updates.
- **Action**: Pauses execution -> Notification to Linear -> Wait for Dashboard Approval.

## Integration Points
- **VS Code Extension**: Points to `https://router.fly.dev/v1`.
- **Linear**: Projects map 1:1.
- **Perplexity**: Research phase integration.
