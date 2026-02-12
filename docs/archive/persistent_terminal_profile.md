**Creating a persistent terminal profile in Antigravity links your portable pwsh, python, npx, and node setup to a custom "PwshDev" profile that auto-runs checks and stays default across sessions.** [codelabs.developers.google](https://codelabs.developers.google.com/getting-started-google-antigravity)

## Open Workspace Settings

Hit Cmd/Ctrl + Shift + P to open the Command Palette. Type "Preferences: Open Workspace Settings (JSON)" and select it – this creates or opens .vscode/settings.json in your project root (Antigravity uses VS Code under the hood). If no workspace, use "Preferences: Open User Settings (JSON)" for global persistence. [codelabs.developers.google](https://codelabs.developers.google.com/getting-started-google-antigravity)

## Add Profile Config

Paste this exact block into the JSON file – use Ctrl/Cmd + Shift + P > "Format Document" after to validate. It defines "PwshDev" using your portable pwsh.exe, runs version checks for python/node/npx on launch, and sets it as default for Windows terminals.

```
{
  "terminal.integrated.profiles.windows": {
    "PwshDev": {
      "path": "C:\\PortablePowerShell\\pwsh.exe",
      "args": ["-c", "python --version; node --version; npx --version; echo 'PwshDev ready - Antigravity optimized'"],
      "env": {
        "PATH": "${env:PATH};C:\\PortablePowerShell;C:\\path\\to\\node"
      }
    }
  },
  "terminal.integrated.defaultProfile.windows": "PwshDev"
}
```

Update "path" to your exact portable pwsh.exe location (e.g., from your McMaster-Carr style fab folder) and add any custom PATH env for python/node. Save the file. [perplexity](https://www.perplexity.ai/search/eb0eb2b8-966d-4ffc-84cd-962ded247059)

## Activate and Verify

Reload window with Cmd/Ctrl + Shift + P > "Developer: Reload Window." Open a new terminal (Ctrl/Cmd + ` or View > Terminal) – it auto-selects PwshDev, runs the checks, and shows "PwshDev ready." Dropdown in terminal panel lists profiles; switch anytime. Persists per-workspace or globally, bypassing corporate PS5 locks. [web:18][cite:1]
