# Jules Integration (BIF-30): Brain-Hands Coordination Protocol

## 1. Overview

The **Bifrost Router** acts as the high-level "Brain," orchestrating complex refactors and features. **Jules** is the execution-focused "Hands," a specialized agent that applies specific code changes ("Slices") based on a global plan.

## 2. Coordination Flow

1.  **Plan Generation (Brain)**: The Router receives a high-level request, indexes the codebase, and generates a `Plan` (a sequence of `JulesTask` objects).
2.  **Task Dispatch**: The Router moves tasks into the `Jules Queue` (managed by the `RouterDO`).
3.  **Task Execution (Hands)**: Jules polls the Router for the next `JulesTask`, fetches the required file slices, applies the changes, and verifies the edit.
4.  **Feedback Loop**: Jules posts an `Engineering Log` (diff, success/failure, lessons) back to the Router and the associated Linear issue.
5.  **HITL Intercession**: If a task is flagged as `High Risk` or fails, the Router triggers a Human-In-The-Loop (HITL) block in Linear.

## 3. Data Structures

### JulesTask

```typescript
interface JulesTask {
  id: string;
  issueId: string; // Reference to Linear issue
  type: 'edit' | 'refactor' | 'test' | 'doc';
  title: string;
  description: string;
  files: string[]; // Paths to files involved in this slice
  status: 'pending' | 'active' | 'completed' | 'failed' | 'blocked';
  priority: number;
  isHighRisk: boolean;
  handoverContext?: string; // Guidance from the Brain (R1/Gemini Pro)
}
```

### EngineeringLog (Hands-to-Brain)

```typescript
interface EngineeringLog {
  taskId: string;
  whatWasDone: string;
  diff: string;
  whatWorked: string[];
  whatDidntWork: string[];
  lessonsLearned: string[];
}
```

## 4. Jules Interaction API (`custom-router`)

| Endpoint        | Method | Description                                              |
| --------------- | ------ | -------------------------------------------------------- |
| `/jules/next`   | GET    | Jules polls for the next available task.                 |
| `/jules/update` | POST   | Jules updates task status and posts the Engineering Log. |
| `/jules/slices` | GET    | Jules fetches the raw content of the files in the task.  |

## 6. GitHub Automation (The "Voice")

Jules requires a **GitHub App** to comment, approve, and merge PRs autonomously. This avoids the security risks of Personal Access Tokens (PATs) and provides higher rate limits.

### Capabilities

- **Review**: Analyze PR diffs and post structured reviews (Approve / Request Changes / Comment).
- **Gatekeeping**: Block merges on high-risk changes until HITL approval.
- **Autonomy**: Auto-merge low-risk PRs (e.g., docs, minor tests) if tests pass.

### Required Secrets

The following secrets must be added to the `custom-router` environment:

| Secret                   | Description                                 | How to Get                                                     |
| ------------------------ | ------------------------------------------- | -------------------------------------------------------------- |
| `GITHUB_APP_ID`          | The unique ID of the GitHub App.            | App Settings > General                                         |
| `GITHUB_PRIVATE_KEY`     | The PEM private key for signing JWTs.       | App Settings > Private keys > Generate a private key           |
| `GITHUB_INSTALLATION_ID` | The ID of the app installation on the repo. | URL after installing app (e.g. `settings/installations/12345`) |

### Setup Guide: Creating the "Jules" GitHub App

1.  Go to **GitHub Settings > Developer Settings > GitHub Apps > New GitHub App**.
2.  **Name**: `Bifrost-Jules-Agent` (or similar).
3.  **Homepage URL**: `https://github.com/mockingb1rdblue/bifrost-bridge` (or your repo).
4.  **Webhook URL**: (Optional for now, can perform active polling).
5.  **Permissions**:
    - `Pull requests`: **Read & Write** (Required for comments/reviews).
    - `Contents`: **Read & Write** (Required for verification commits/merges).
    - `Metadata`: **Read-only** (Default).
6.  **Subscribe to events**: `Pull request`, `Pull request review`.
7.  **Create App** and note the **App ID**.
8.  **Generate a Private Key** (download the `.pem` file).
9.  **Install App**: Go to "Install App" sidebar -> Install on your specific repository.
10. **Note Installation ID**: Look at the URL: `github.com/settings/installations/123456` -> `123456` is the ID.
