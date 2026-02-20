# Root Configs Audit Report

## Critical Issues

**1. Permissive TypeScript ESLint Configuration**

The ESLint configuration sets `@typescript-eslint/no-explicit-any` to `'warn'` instead of `'error'` and disables `@typescript-eslint/no-require-imports`. This weakens type safety significantly.[1] To align with strict security posture, explicit `any` types should trigger build failures, not warnings. Additionally, disabling `no-require-imports` bypasses module resolution validation.

**2. Scripts Directory Included in tsconfig.json Compilation**

The `tsconfig.json` includes `"scripts/**/*"` in compilation, which means utility scripts run through the same strict type checking as production code. However, if these scripts are intended to be one-off utilities, including them in the main compilation context creates maintenance overhead and potential security surface area. The extract-certs script in particular warrants isolated handling given its access to certificate materials.

**3. Missing npm Lockfile Security Validation**

There is no reference to lockfile-lint or validation tools in the build pipeline. Given the project's emphasis on "Zero Local Secrets" and autonomous operations, the lockfile (package-lock.json or yarn.lock) should be validated against trusted registries to prevent lockfile injection attacks.[2] This is especially critical for a toolkit distributed to other developers.

**4. Post-Install Script Risk**

The npm scripts use direct `npx` execution (e.g., `npx tsx`, `npx ts-node`) without explicit post-install script controls. While not inherently dangerous, best practice is to explicitly disable post-install scripts in `.npmrc` to prevent supply-chain attack vectors during dependency installation.[2]

## Improvements

**1. Harden ESLint Rules**

Change the following rules in `eslint.config.js`:

```typescript
'@typescript-eslint/no-explicit-any': 'error',  // Enforce type safety
'@typescript-eslint/no-require-imports': 'error',  // Validate module resolution
'@typescript-eslint/no-unused-vars': 'error',  // Prevent silent failures
```

The `'warn'` severity allows non-compliant code to merge and accumulate technical debt.[1]

**2. Enable skipLibCheck Selectively**

The `"skipLibCheck": true` setting masks potential type definition issues in dependencies, contradicting the "Zero Secrets" philosophy.[1] Consider switching to `false` and leveraging type guards for external libraries where needed:

```json
"skipLibCheck": false,
"noImplicitAny": true,
"strict": true
```

**3. Implement Lockfile Validation in CI/CD**

Add to package.json:

```json
"scripts": {
  "validate:lockfile": "lockfile-lint --path package-lock.json --type npm --allowed-hosts npm yarn --validate-https"
}
```

Run this check in CI/CD pipelines before installation.[2]

**4. Add npm Security Audit to Build**

Include `"audit": "npm audit --audit-level=high"` in scripts and fail the build on high-severity vulnerabilities.

**5. Separate Script TypeScript Configuration**

Create a `scripts/tsconfig.json` with relaxed settings for utilities, excluding it from the main compilation:

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "skipLibCheck": true,
    "noImplicitAny": false
  },
  "include": ["**/*"]
}
```

Update main `tsconfig.json` to exclude scripts:

```json
"exclude": ["node_modules", "workers", "scripts"]
```

## Refactoring Plan

| Priority | Item | Action | Compliance Goal |
|----------|------|--------|-----------------|
| P0 | ESLint severity | Change `any`/`require-imports` to `'error'` | Strict TS compliance |
| P0 | Lockfile validation | Integrate `lockfile-lint` into CI/CD pipeline | Zero supply-chain injection risk |
| P1 | skipLibCheck | Set to `false` and add type guards for problematic dependencies | Type safety enforcement |
| P1 | Post-install scripts | Create `.npmrc` with `ignore-scripts=true`; explicitly run needed scripts via npm hooks | Supply-chain hardening |
| P2 | Script isolation | Separate scripts into own tsconfig with relaxed rules | Build clarity |
| P2 | Error handling audit | Implement generic error responses per best practice[1] to prevent certificate/secret leakage in error messages | Zero Secrets guarantee |

**Implementation Timeline**: Address P0 items before next release. Scripts isolation (P2) can follow in next sprint. Lockfile validation should be operational within current sprint to prevent transitive dependency risks in distributed packages.