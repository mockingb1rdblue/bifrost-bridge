---
description: Strict Single-Track Development Workflow (Branch -> PR -> Squash -> Learnings)
---

# Single-Track Development Cycle

This workflow enforces a strict "one thing at a time" policy. You cannot start a new task if a branch is already open.

## 1. Pre-Flight Check (Stop if busy)

// turbo

1. Check for existing branches.
   ```powershell
   git branch
   ```
   **CRITICAL**: If you see any branch other than `hee-haw` (or `main`) and the current one you are _already_ working on, STOP.
   - You must finish or abandon the existing work first.
   - Do not open a second "WiP" branch.

## 2. Start Work (Branch)

2. Create a feature branch for your backlog item.
   ```powershell
   git checkout -b feature/<descriptive-name>
   ```
   _Replace `<descriptive-name>` with a short, kebab-case name (e.g., `001-vision-statement`)._

## 3. Execution (The Work)

3. Perform the necessary code edits, tests, and verification.
   - Commit freely to your feature branch during this phase.

## 4. Completion (Squash & Merge)

4. switch back to main.

   ```powershell
   git checkout hee-haw
   ```

5. Squash and Merge.

   ```powershell
   git merge --squash feature/<descriptive-name>
   ```

6. **Capture Learnings & Commit**
   - You MUST include a "Learnings" section in the commit body.
   - Format:

     ```text
     Feature: <Title>

     <Description of changes>

     Learnings:
     - <What did we learn about the environment?>
     - <What went wrong and how did we fix it?>
     - <Any constraints discovered?>
     ```

   ```powershell
   git commit
   ```

   _(This will open your editor. Enter the formatted message above.)_

7. Cleanup.
   ```powershell
   git branch -D feature/<descriptive-name>
   ```

## 5. Push (If Remote Exists)

8. Push changes.
   ```powershell
   git push origin hee-haw
   ```
