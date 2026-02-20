# The Grand Audit: Technical Debt & Hardening Report

> **Date**: 2026-02-18
> **Auditor**: Veil Vault (Perplexity Sonar) & Antigravity
> **Status**: 🔴 CRITICAL FINDINGS

## Executive Summary

The codebase follows a modern "Zero Local Secrets" architecture but suffers from **critical compliance lapses** in legacy scripts and root configurations. While the core TypeScript workers are generally robust, the surrounding tooling (scripts, debug utilities) exposes the project to credential leakage and supply-chain attacks.

## 🚨 Critical Compliance Failures (P0)

### 1. Hardcoded Secrets (Protocol Violation)

- **Violation**: "Zero Local Secrets" Global Rule.
- **Evidence**:
  - `.env` file exists with cleartext `PERPLEXITY_API_KEY`, `PROXY_API_KEY`, and `FLY_TOKEN`.
  - `scripts/legacy/cleanup-duplicates.js` contains `API_KEY = 'test-key-default'`.
  - `scripts/debug/configure-linear-swarm.js` contains hardcoded test keys.
- **Risk**: Immediate compromise if source is leaked or `.env` is accidentally committed (despite `.gitignore`).
- **Remediation**:
  - **IMMEDIATE**: Rotate all exposed keys.
  - **IMMEDIATE**: Delete `.env` and enforce `wrangler secret put` / environment variables.
  - **IMMEDIATE**: Rewrite legacy JS to TS with strict env validation (`zod`).

### 2. Supply-Chain Vulnerabilites

- **Evidence**:
  - No lockfile validation using `lockfile-lint`.
  - Permissive ESLint rules (`no-explicit-any: warn`) allow type-stripping.
  - Post-install scripts are not disabled in `.npmrc`.
- **Risk**: Malicious dependency injection or build-time script execution.

- [ ] [GG-06] **Script Migration**: Migrate all scripts to `relics/node_modules` pattern.
- [x] [GG-07] **Punycode Deprecation**: Resolved via `overrides` to `ajv@^8.12.0`.
- [x] [GG-08] **Stale Compatibility**: All workers updated to `2026-02-18`.
- [x] [GG-09] **Outdated Dependencies**: Safe updates applied. Major versions (OpenAI v6, Chalk v5) deferred.

## 🏗️ Component Analysis

### 1. Root Configuration

- **ESLint**: Too permissive. Needs `no-explicit-any: error` and `no-require-imports`.
- **TSConfig**: Includes `scripts/` in the main build, polluting the type space.
- **NPM**: Missing `npm audit` gate in CI/CD.

### 2. Scripts & Automation

- **Legacy Decay**: `scripts/legacy/*.js` are untyped, use `execSync` improperly, and contain hardcoded secrets.
- **Type Safety**: `debug_linear_issues.ts` uses non-null assertions (`!`) and vague string matching for auth logic.
- **Redundancy**: Certificate loading logic is duplicated across multiple scripts.

### 3. Workers (The Swarm)

#### A. Annals of Ankou (Registry/Telemetry)

- **Critical**: `req` vs `request` typo in route handler (Runtime Crash Risk).
- **Secrets**: Logs `process.env` to console (Violation).
- **Auth**: Weak string equality check (Timing Attack).
- **Types**: Excessive use of `any` in request handlers.

#### B. Bifrost Bridge (Logic Core)

- **Security**: `apiToken` in constructor (Memory Exposure).
- **Errors**: Generic `Error` throwing, no custom error hierarchy.
- **Validation**: `spawnSprite` accepts unvalidated URLs.

#### C. Crypt Core (The Vault)

- **Compliance**: Missing `strict: true` in tsconfig.
- **Secrets**: `env: any` usage invalidates Zero Secrets guarantees.
- **Safety**: No runtime validation of required environment variables.

#### D. Linear Proxy (The Gatekeeper)

- **Security**: Global mutable state (`RATE_LIMITS`) violates Worker architecture.
- **Docs**: `DEPLOY.md` contains merge conflicts and encourages `.dev.vars` (Policy Violation).
- **Type Safety**: Empty `worker-configuration.d.ts` vs Zod schema (Source of Truth conflict).

#### E. Perplexity Proxy (Veil Vault)

- **Architecture**: Global mutable state (`RATE_LIMITS`) violates Worker isolation.
- **Security**: `Math.random()` used instead of `crypto.randomUUID()`.
- **Config**: Hardcoded `compatibility_date` (2024-01-01).

#### F. Worker Bees (The Swarm)

- **Secrets**: Hardcoded `FALLBACK_KEY`.
- **Types**: `Job` interface uses `any` payload.
- **Logic**: Dev mode detection is flaky and insecure.

### 4. Documentation (The Pillars)

- **Security**: `OPERATIONAL_MANUAL.md` examples suggest insecure credential handling (`wrangler login`).
- **Risk**: `activate-env.sh` usage is a privilege escalation vector.
- **Gaps**: Missing documented failover for "Crypt Core" vs "Specter Sanctums".

## 🛡️ Remediation Plan (Draft)

1.  **Operation Clean Slate**:
    - Rotate compromised keys (PPLX, Fly).
    - Delete `.env`.
    - Refactor `src/cli.ts` to strictly require env vars or fetch from 1Password/Doppler (or just Cloudflare).

2.  **Strict Mode**:
    - Update `eslint.config.js` to error on `any`.
    - Isolate `scripts/tsconfig.json`.

3.  **Legacy Purge**:
    - Rewrite `legacy/*.js` to strict TypeScript or DELETE if obsolete.
    - Update `scripts/infra/audit_tech_debt.ts` to be a permanent fixture.
