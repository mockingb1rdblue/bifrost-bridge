---
description: How to pick up this project from scratch and verify the environment
---
# 🚀 Resume Workflow: Bifrost Bridge

Use this workflow when starting a new chat session to understand the project state and verify the environment.

## 1. Context Acquisition
- **Read Strategy**: `README.md` (Root)
- **Check Architecture**: `docs/PROJECT_SUMMARY.md` (if used) or `docs/reference/`
- **Check Backlog**: `docs/backlog/` contains sliced tasks from the original vision.

## 2. Environment Verification (The "Doctor" Check)
Run the Network Detective to ensure the "Corporate Survival Kit" is active (certs, proxy bypass).

```bash
python scripts/bifrost.py detect
```
**Success Criteria**:
- Cloudflare DNS/Workers: OK
- SSL Inspection: "INTERCEPTED" (Expected) or "Standard"
- If execution fails: Run `python scripts/bifrost.py extract-certs`

## 3. Worker Status
Check which proxies are live.

```bash
python scripts/bifrost.py workers
```

## 4. Development Tools
This project uses a **Portable PowerShell** environment to bypass execution policies.
- **Do not** try to run `pwsh` or `powershell` directly if you need to run `wrangler`.
- **Use**: `python scripts/bifrost.py shell` to enter the safe environment.
- **Or**: `python scripts/bifrost.py deploy <worker>` to deploy.

## 5. Active Tasks
Check the artifacts from previous sessions (if available) or the latest commits.
- **Linear Integration**: See `scripts/verify_linear.py` and `scripts/populate_linear_demo.py`.
- **Perplexity**: See `src/perplexity-client.ts`.

## 6. Pro-Tips
- **Bifrost Runner**: `scripts/bifrost.py` matches commands to the correct tools/environment. preferring it over direct `npx` calls on Windows avoids quoting/path issues.
- **Secrets**: Use `bifrost.py secret` to manage Cloudflare secrets safely.
