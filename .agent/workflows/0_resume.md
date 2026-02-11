---
description: How to pick up this project from scratch and verify the environment
---
# 🚀 Resume Workflow: Bifrost Bridge

Use this workflow when starting a new chat session to understand the project state and verify the environment.

## 1. Context Acquisition
- **Read Strategy**: `README.md` (Root)
- **Check Architecture**: `docs/PROJECT_SUMMARY.md` (if used) or `docs/reference/`
- **Check Backlog**: `docs/backlog/` contains sliced tasks from the original vision.

## 2. Environment Verification & Bootstrap
Run the Universal Runner's setup to ensure all portable tools (PowerShell, Node.js) are installed and global paths are recorded.

```bash
# Aggregated setup (Python, Git, Node, pwsh)
python scripts/bifrost.py setup
```

**Success Criteria**:
- `python`, `git`, `node`, `npx`, and `pwsh` are available globally.
- If behind a proxy, `extract-certs` has been run.

## 3. Environment Dominance (Windows Caching)
Corporate Windows environments often "cache" environment variables (e.g., if VS Code remains open). 
- **The Bifrost Fix**: The portable shell (`python scripts/bifrost.py shell`) is configured to **force a refresh** from the Registry on startup.
- **Manual Override**: If tools are missing, run:
  ```powershell
  $env:PATH = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
  ```

## 4. Worker Status
Check which proxies are live.

```bash
python scripts/bifrost.py workers
```

## 5. Development Tools
- **Safe Environment**: Always use `python scripts/bifrost.py shell`. It bypasses execution policies and loads the `.env`.
- **Global Access**: Once `setup` is run, you can use these tools from any terminal, but the `shell` command is the "gold standard" for this project.

## 6. Pro-Tips
- **Bifrost Runner**: `scripts/bifrost.py` matches commands to the correct tools/environment. preferring it over direct `npx` calls on Windows avoids quoting/path issues.
- **Secrets**: Use `bifrost.py secret` to manage Cloudflare secrets safely.
