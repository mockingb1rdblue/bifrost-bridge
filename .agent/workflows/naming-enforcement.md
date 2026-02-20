---
description: Enforcement of Dark Mythology Naming Convention
---

# Dark Mythology Naming Enforcement

All new features, agents, and infrastructure components MUST adhere to the **Dark Mythology** alliterative naming convention defined in [DARK_MYTHOLOGY.md](file:///Users/mock1ng/Documents/Projects/Antigravity-Github/bifrost-bridge/docs/specs/DARK_MYTHOLOGY.md).

## Enforcement Steps

### 1. Pre-Implementation Check

Before creating a new component, consult the [DARK_MYTHOLOGY.md](file:///Users/mock1ng/Documents/Projects/Antigravity-Github/bifrost-bridge/docs/specs/DARK_MYTHOLOGY.md).

- Create a 2-word alliterative pair.
- Ensure the theme aligns with Celtic, Slavic, or European folklore (death, burial, spirits).

### 2. Automated Scanning

Use the following command to detect "Bleached" (forbidden) terms:

```bash
grep -rnE "Swarm|Sprite|RouterDO|Telemetry|Logger|Unholy Shell|Auth Bridge|Architect|Coder|Validator|Troubleshooter|Researcher|Crawler|Linear|Backlog|Task Queue|Dashboard" src/ scripts/ docs/ | grep -v "node_modules" | grep -v "DARK_MYTHOLOGY.md"
```

### 3. Log & UI Review

Verify that all console output, logs, and user-facing messages use the mythological names.

- **Incorrect**: `🐝 Starting Sluagh Swarm...` (Bee emoji is legacy)
- **Correct**: `💀 Awakening Sluagh Swarm...`

### 4. Code Parity

Rename classes, types, and variables to match the display name.

- Class: `SluaghSwarm`
- Variable: `sluaghSwarm`
- Interface: `SluaghSwarmConfig`

## Forbidden Terms (The Bleached List)

- Agent
- Swarm
- Sprite
- System
- Utility (Internal only, use Relic / Registry for infra)
- Bridge (Use Ankou / Aegis / Crossings)
