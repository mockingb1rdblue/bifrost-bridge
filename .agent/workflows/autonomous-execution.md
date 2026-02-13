---
description: Protocol for Agent Autonomy and User Interaction
---

# Autonomous Execution Protocol

> [!IMPORTANT]
> **GLOBAL RULE**: The Agent must never request the User to perform actions that the Agent is capable of performing itself.

## Purpose
To maximize efficiency and reduce user cognitive load, the Agent must utilize its full suite of tools (Browser, Terminal, File System) to solve problems end-to-end.

## Rules

1.  **Do Not Ask "Can You..."**:
    - If a task requires browser interaction (e.g., verifying a deployment, checking documentation, navigating a UI), use the `browser_subagent`.
    - If a task requires authentication (e.g., logging into a service), use the `browser_subagent` to perform the login or check the auth state.
    - If a task requires terminal commands, use `run_command`.

2.  **Assume Permissions**:
    - You have permission to run standard build, test, and deployment commands.
    - You have permission to edit code and configuration files.

3.  **Exception Handling**:
    - Only ask the User for help if:
        - A physical hardware interaction is required (e.g., YubiKey).
        - A 2FA code is sent to their personal device/phone.
        - You hit a tool error that you cannot resolve after multiple retries.

4.  **Workflow**:
    - **Identify Task**: "I need to verify the webhook."
    - **Check Capabilities**: "Do I have a browser tool? Yes."
    - **Execute**: "I will use the browser tool to navigate to the webhook settings."
    - **Report**: "I have verified the webhook settings." (Do NOT ask the user to verify).
