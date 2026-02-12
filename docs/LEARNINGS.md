# Bifrost Bridge & Antigravity Learnings

## 1. Antigravity Terminal Persistence

**Problem**: Terminal profiles defined in `.antigravity/config` were acceptable but often overridden or ignored by the global VS Code/Antigravity context, leading to "default shell" fallbacks that lacked our portable tools.
**Solution**:

- We successfully injected the `PwshDev` profile directly into the **Global User Settings** (`AppData/Roaming/Antigravity/User/settings.json`).
- **Critical Configuration**:
  ```json
  "terminal.integrated.profiles.windows": {
      "PwshDev": {
          "path": ".../pwsh.exe",
          "args": ["-NoExit", "-Command", "...start checks..."],
          "env": { "PATH": "..." }
      }
  },
  "terminal.integrated.defaultProfile.windows": "PwshDev"
  ```
- **Key Insight**: Using `-c` (command) caused the terminal to execute and close immediately (appearing frozen). Changing to `-NoExit -Command` ensures the shell remains interactive.

## 2. Portable Python & Linter Type Safety

**Problem**: Strict linters (Pylance/Pyre) in the editor flag standard Python dynamic typing (like `sys.argv` slicing or `ssl.getpeercert()`) as errors because they can't infer the types from the portable runtime context.
**Solution**:

- **Explicit Casting**: We had to wrap `sys.argv[2:]` in `list(...)` to satisfy list indexing checks.
- **Type Hinting**: We explicitly typed dictionaries (e.g., `issuer: dict[str, str] = {}`) to prevent "Argument cannot be assigned to None" errors.
- **Defensive Coding**: Checked `if hasattr(e, 'read')` before calling it on Exceptions.

## 3. ESLint in 2026 (Modernization)

**Problem**: The project lacked linting, and legacy `.eslintrc` configurations are deprecated.
**Solution**:

- Integrated **ESLint v9** with "Flat Config" (`eslint.config.js`).
- Installed `typescript-eslint` for proper TS support.
- Added `npm run lint` and `npm run lint:fix` scripts.
- **Lesson**: `require()` imports in TypeScript files (`logger.ts`) need to be converted to `import * as x from 'x'` to comply with modern module standards.

## 4. Environment "Dominance"

**Concept**: The portable environment must strictly "prepend" itself to the PATH every time it launches.
**Implementation**:

- The `PwshDev` profile runs a startup check (`python --version`, etc.) every session.
- `bifrost.py` has a `refresh_environment()` function that forcibly reloads Registry keys into the current process to recover from system updates that might clobber variables.
