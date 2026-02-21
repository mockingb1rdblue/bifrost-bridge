This is a two-layer problem: a one-time audit tool to establish a baseline, and a permanent guard that runs on every commit going forward. Here's the full plan.

## Architecture of the guard system

Think of it as three rings:

- **Ring 1 — Static analysis rules**: enforced by tools that already exist in your stack (`tsc`, `eslint`, custom lint rules). These catch violations at save time or in CI.
- **Ring 2 — Structural audit script**: a Node/TypeScript script you write once, that counts lines, greps for forbidden patterns, and reads manifests. This is what establishes your baseline and can be run ad hoc.
- **Ring 3 — CI gate**: the audit script and linter together form a pass/fail step in your GitHub Actions (or equivalent) pipeline. No slice ships if any gate fails.

***

## Ring 1 — Static analysis rules

### TypeScript compiler (already in place)
You already have `strict: true` and `noUncheckedIndexedAccess: true` in `tsconfig.json`.  That's your first guard. Add `npx tsc --noEmit` as a required step in every CI run and it becomes a hard gate, not a suggestion. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/c7bdc82a-29f5-45bb-9476-10022720e217/tsconfig.json)

### ESLint with custom rules
Add ESLint with the following rules targeting your specific SOP violations:

- **`no-process-env` rule (or `n/no-process-env`)**: Explicitly bans `process.env` reads everywhere except files matching the path pattern `**/config/index.ts` or `**/config.ts`. This enforces Slice 1 and Slice 2 compliance automatically for any future file that tries to sneak an env read in. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)
- **`no-restricted-imports` rule**: Configured to prevent any file outside `config/` from importing environment access utilities directly, and to prevent any handler from importing another handler directly (forcing factory usage after Slice 11).
- **`max-lines` rule**: Set to 300 as a warning at 250 and an error at 300. This is the single most important mechanical enforcement of your modularity goal. You can add per-file exceptions for `worker-configuration.d.ts` (generated)  and for `router-do.ts` until Slice 8 is complete, then remove the exception. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/5ef61c93-2161-4ac3-8aa4-a352c4edfbec/worker-configuration.d.ts)
- **`@typescript-eslint/no-explicit-any` rule**: Turn it to `warn` now, `error` after the refactor slices are done. This catches the loose typing in handlers and sync services that will accumulate if unchecked. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/f2eb23a8-91af-4336-bb81-c7f99c5a8421/linear.ts)

You already have `zod` and `vitest` in your `package.json` — ESLint adds minimal overhead and can reuse the same workspace. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/12ea8684-ba63-494f-ad47-ad0afdc28f27/package.json)

### ESLint ignore overrides as tech-debt markers
For every file that violates the rules but hasn't been refactored yet, add an ESLint override in `eslint.config.ts` with a comment: `// TECH DEBT: Slice N`. This makes the inventory visible in code, not just in a doc. When a slice ships, you delete the override. The override list IS your remaining debt list.

***

## Ring 2 — Structural audit script

Write a single script at the repo root: `scripts/audit-workers.ts` (or `.js`). It does three things:

### 1. Line count enforcement
Walks every `.ts` file under `workers/*/src/`, skips `*.d.ts` and `*.test.ts`, and reports any file over 300 lines. Exits with code 1 if any violations exist. Exempt list is stored in a small JSON file `scripts/audit-exemptions.json`, where each entry requires a `sliceTarget` field (e.g., `"sliceTarget": "Slice 8"`). This means exemptions are self-documenting and you can see exactly which slices unblock which files.

### 2. Forbidden pattern scan
Runs the same checks as your existing `grep` verify steps from the plan:

- `process.env` outside `config/` modules. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/97bb103a-2133-4ae8-850c-1753a327ea25/agent.ts)
- Raw `fetch(` calls outside `infra/` or `clients/` directories (after Slice 9 ships for worker-bees). [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/89f6da41-2756-40a6-917a-924f96150cc3/ingestor.ts)
- `console.error` or `console.log` outside `infra/` or `observability/` (a stricter future rule once you build the observability module).
- Any file importing directly from `router-do.ts` by path (enforcing the façade pattern after Slice 3+).

### 3. Worker manifest check
After Slice 12, reads `src/worker-manifest.ts` in each worker directory and validates it has the required fields: `id`, `role`, `capabilities`, `version`. Reports missing manifests as failures.

The audit script outputs a table that maps directly to your Worker Health Inventory:

```
worker         | role           | health | violations
crypt-core     | RouterDO       | 0      | 47 files >300 lines, process.env in router-do.ts
worker-bees    | Agent executor | 0      | process.env in agent.ts, ingestor.ts
```

***

## Ring 3 — CI gate

Your CI workflow (GitHub Actions or Cloudflare's built-in hooks) enforces all of this on every push and every PR:

### Required checks in order
1. `npx tsc --noEmit` across all workers — fails fast on type errors. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/c7bdc82a-29f5-45bb-9476-10022720e217/tsconfig.json)
2. `npm run lint` running ESLint with the rules above — fails on `process.env` violations, `max-lines` errors, restricted imports.
3. `node scripts/audit-workers.ts` — structural audit; fails on violations not in the exemptions list.
4. `npm test` running vitest — existing tests must pass. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/75681c10-fa76-4ae8-aaf3-589bfee51f9f/vitest.config.ts)

### PR labeling (optional but high-value)
Add a GitHub Action that reads the audit script output and auto-labels any PR touching a file with a known exemption with a `tech-debt` label. Any PR that removes an exemption gets a `debt-retired` label. This makes progress visible in your PR history without any extra effort.

### Branch protection
Require all four checks to pass before merge on `main`. No exceptions. This is the social contract that makes the guard real: the CI gate doesn't care that you're in a hurry.

***

## How the guard evolves as you ship slices

The key insight is that the exemptions list shrinks with every slice you ship, and the ESLint overrides list mirrors it. Here's the lifecycle per slice:

- **Before you start a slice**: the violating files are in `audit-exemptions.json` and in `eslint.config.ts` overrides.
- **During the slice**: you refactor. The files shrink below 300 lines. `process.env` moves to `config/`.
- **At the end of the slice**: you remove the exemption entries for those files. The CI gate now enforces the new state permanently.
- **For new workers**: they start with no exemptions and must comply from day one.

This means the audit script is actually your progress tracker — the number of remaining exemptions maps directly to how many slices are left.

***

## Tooling choices rationale

You already have vitest, wrangler, TypeScript strict mode, and zod in your stack.  This plan adds exactly two things: ESLint (well-understood, zero runtime cost) and one custom Node script. It avoids adding another framework like Nx or Turborepo for now, which would be premature before the monorepo stabilizes. When you go mesh and workers multiply, that's when Turborepo's task graph and remote caching become worth the overhead — but that's a future slice. [ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/48675164/75681c10-fa76-4ae8-aaf3-589bfee51f9f/vitest.config.ts)

***

## Suggested `package.json` script additions

Add these to your workspace root `package.json` scripts (words only, no code):

- `lint` — runs ESLint across `workers/*/src`
- `audit` — runs `scripts/audit-workers.ts`
- `check` — runs `tsc --noEmit`, `lint`, and `audit` in sequence; this is what CI calls
- `check:watch` — runs `check` in watch mode for local development; you want violations red in your terminal as you code

After all 12 slices ship, `npm run check` with zero violations and zero exemptions is your definition of "done state." The guard then maintains that state indefinitely for all current and future workers.