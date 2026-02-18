# Bifrost Bridge Scripts Audit Report

## Critical Issues

**Hardcoded Credentials & Secret Exposure**

Multiple debug and configuration scripts expose secrets directly in code. Files `debug-labels.js`, `cleanup-duplicates.js`, and `configure-linear-swarm.js` hardcode `API_KEY = 'test-key-default'` as plaintext constants[1]. This violates the "Zero Secrets" compliance requirement. Additionally, scripts reference `.certs/corporate_bundle.pem` paths and `LINEAR_API_KEY` environment variables without validation or rotation mechanisms, creating exposure vectors for credential compromise.

**Missing Type Safety in Legacy JavaScript**

The `legacy/` directory contains untyped JavaScript files (`audit-swarm.js`, `cleanup-duplicates.js`, `configure-linear-swarm.js`) that lack compile-time guards. These files use `execSync()` and shell interpolation without input validation, creating injection risks. TypeScript's **strict type modes** would catch these issues during development[1], whereas the current state defers all validation to runtime, increasing defect escape risk.

**Incomplete Error Handling & Unsafe Type Defaults**

TypeScript files like `debug_linear_issues.ts` use fallible patterns without exhaustive error handling. The `LinearClient` initialization references `apiKey!` with a non-null assertion rather than strict validation, and the "Smart Key Logic" branching on URL substring matching (`includes('workers.dev')`) relies on implicit string types rather than discriminated unions, creating maintenance risk and hidden failure modes.

**Redundant Certificate Loading**

`debug_linear_issues.ts` loads `NODE_EXTRA_CA_CERTS` twice identically (lines with `fs.existsSync(certPath)` repeated), indicating either incomplete refactoring or copy-paste debt.

---

## Improvements

**Transition from Legacy JavaScript to Strict TypeScript**

Following the pattern of reducing bugs fastest, replace all legacy `.js` files in the `legacy/` and `debug/` directories with strict TypeScript equivalents using `strict`, `noImplicitAny`, `strictNullChecks`, and `noUncheckedIndexedAccess` compiler flags[1]. This catches unsafe anys and narrows ambiguous values early during development, preventing defect-prone branches from reaching production.

**Externalize & Validate API Credentials**

Implement **API boundaries and DTO validation** using `zod` or `io-ts` for runtime validation of configuration payloads[1]. Secrets should be injected via environment variables with explicit schema validation:

```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  ROUTER_URL: z.string().url(),
  LINEAR_API_KEY: z.string().min(1, 'LINEAR_API_KEY required'),
  PROXY_API_KEY: z.string().optional(),
  LINEAR_TEAM_ID: z.string().min(1)
});

const config = ConfigSchema.parse(process.env);
```

This ensures non-conforming payloads fail fast with precise error messages before code executes[1].

**Apply Type-Aware Lint Rules in CI**

Implement ESLint rules requiring explicit return types and forbidding non-null assertions (`noExtraSecretAssertions`) or `any` types. This enforces consistent type imports and detects unsafe patterns like the "Smart Key Logic" conditional[1]. Block merges on severity thresholds to encourage continuous reducing technical debt via steady enforcement.

**Replace Shell Interpolation with Typed Abstractions**

In files like `audit-swarm.js`, replace raw `execSync()` + string interpolation with typed command builders to prevent injection:

```typescript
// Instead of shell template strings, use typed execution
const result = await executeCommand('lsof', ['-i', ':8787', '-t']);
```

**Consolidate Duplicate Logic**

Remove the duplicated certificate loading block in `debug_linear_issues.ts` and create a shared utility function with a single source of truth.

---

## Refactoring Plan

**Phase 1: Risk-Based Module Prioritization** (Weeks 1–2)

Score modules by incident history, churn, coupling, and complexity[1]. Prioritize:
- `scripts/infra/recover-secrets.sh` and related secret-handling scripts (critical security surface)
- `debug/` directory (exposed credentials, unsafe execution)
- `legacy/` JavaScript files (untyped, error-prone)

**Phase 2: Strangler Pattern with Typed Seams** (Weeks 3–6)

Introduce typed adapters at boundaries using the **Strangler Fig Pattern**[2]. For each legacy script:
1. Create a new TypeScript equivalent with strict types and DTO validation.
2. Route execution to the new implementation via a compatibility layer.
3. Log mismatches and validate behavior equivalence in parallel.
4. Gradually shift traffic to the new implementation, shrinking blast radius.

Example: Replace `cleanup-duplicates.js` with `cleanup-duplicates.ts`, validating the API contract via `zod` before execution.

**Phase 3: Type-First Refactors via Inference** (Weeks 7–10)

Capture inferred types from existing code to reveal real contracts[1]. For `LinearClient` initialization patterns:
- Replace implicit "Smart Key Logic" with explicit discriminated unions:
  ```typescript
  type AuthConfig = 
    | { mode: 'direct'; apiKey: string }
    | { mode: 'proxy'; proxyUrl: string; apiKey: string };
  ```
- Tighten signatures and remove ambiguous fallbacks.
- Use editor refactors to propagate changes safely across modules.

**Phase 4: Debt Register & SLO-Driven Cadence** (Ongoing)

Establish a **debt register linked to type-safety gaps**[1], cataloging:
- Untyped modules (`audit-swarm.js`, legacy scripts)
- Unsafe `any` or non-null assertions
- Hardcoded credentials and secret vectors
- Missing error handling paths

Reserve **10–15% of sprint capacity** for debt work aligned with error budgets and reliability goals. Use SLO burn alerts to trigger focused debt sprints on high-risk modules[1]. Publish outcomes tied to incident reduction metrics to maintain stakeholder trust.

**Phase 5: Institutionalize with ADRs** (Weeks 11+)

Document **Architecture Decision Records** capturing decisions on:
- Credential management patterns (environment variables + validation schemas)
- Error handling in async code (exhaustive handlers, typed Result unions)
- Module execution safety (no shell interpolation, typed CLI builders)

Link code samples and establish patterns library for consistent use across the swarm scripts[1].

---

## Compliance & Security Sign-Off

- [ ] Zero hardcoded secrets; all credentials injected via environment variables with schema validation
- [ ] 100% of source code in strict TypeScript (migrate `legacy/` and `debug/` directories)
- [ ] All external API calls validated via DTO schemas (`zod`/`io-ts`)
- [ ] Debt register populated with risk-scored modules; burn-down tracked quarterly
- [ ] SLO-driven cadence established; 10% sprint capacity reserved for debt reduction
- [ ] No shell interpolation in command execution; use typed abstractions