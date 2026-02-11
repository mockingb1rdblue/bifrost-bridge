# Corporate Survival Guide: Path Dominance & Automation

This guide documents the "Bifrost" patterns used to maintain a stable development environment in restricted corporate settings (no admin, SSL interception, environment caching).

## 1. Environment Variables: The Caching Trap
**Problem**: Even after updating Registry paths, terminal windows (especially inside VS Code) often fail to "see" the new values. This happens because Windows apps cache environment variables at startup and pass the *stale* cache to sub-processes.

**The Solution (Path Dominance)**:
The portable shell (`.tools/pwsh/profile.ps1`) ignores the session cache and forces a refresh from the source:
```powershell
$MachinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
$env:PATH = "$UserPath;$MachinePath"
```

## 2. Registry Path Priority
**Problem**: Windows "App Execution Aliases" (placeholders for Python/Node) often take priority at the system level over your local versions.

**The Solution**:
Always place project tools at the **beginning** of the User PATH. The `bifrost` setup script ensures that:
- `Python314`
- `Git/cmd`
- `.tools/nodejs`
- `.tools/pwsh`
...all sit before `C:\Windows\System32` or `WindowsApps`.

## 3. Persistent Global Setup
For a fresh clone, you must record the following paths in your **User Registry** to ensure global tool access:

| Tool | Registry Path Entry |
| :--- | :--- |
| **Python** | `C:\Users\<UID>\AppData\Local\Programs\Python\Python314` |
| **Git** | `C:\Users\<UID>\AppData\Local\Programs\Git\cmd` |
| **Node.js** | `<ProjectRoot>\.tools\nodejs` |
| **pwsh** | `<ProjectRoot>\.tools\pwsh` |

## 4. SSL Interception
**Problem**: Corporate proxies (Zscaler, etc.) replace SSL certificates, breaking `npm` and `python` requests.

**The Solution**:
1. Run `python scripts/bifrost.py extract-certs` to generate `.certs/corporate_bundle.pem`.
2. Set `NODE_EXTRA_CA_CERTS` and Python's SSL context to trust this bundle (automated in `bifrost.py`).
