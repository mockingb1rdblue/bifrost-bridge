# Linear Developer Platform: GraphQL API and SDK Summary

Linear provides a robust developer ecosystem designed to extend the platform's capabilities, particularly for teams building software in the AI era. The system is built to support both human developers and AI agents through a combination of a GraphQL API, a TypeScript SDK, and the Model Context Protocol (MCP).

## 1. Core Developer Tools

### GraphQL API

The primary interface for programmatically interacting with Linear is its **GraphQL API**. This API allows developers to:

- Extend Linear's core functionality.
- Integrate with external tools and custom workflows.
- Access and manipulate data across the product development lifecycle (Intake, Planning, Building, and Monitoring).

### TypeScript SDK

For developers working within the JavaScript/TypeScript ecosystem, Linear provides an official **TypeScript SDK**. This SDK simplifies interactions with the GraphQL API, providing a more idiomatic way to build integrations and automate tasks within the Linear environment.

## 2. Linear MCP (Model Context Protocol)

A significant recent update (February 4, 2026) introduced expanded support for the **Linear MCP server**. This protocol is specifically designed to bridge the gap between product management and AI development tools.

- **Supported Entities:** Initiatives, project milestones, and updates.
- **Tool Integration:** Enables progress communication and data retrieval from AI-driven tools such as **Cursor** and **Claude**.
- **Purpose:** Allows AI agents to have context regarding the product roadmap and strategic objectives.

## 3. AI Agent Integration

Linear is "purpose-built for the AI era," supporting the deployment of AI agents (e.g., Codex, GitHub Copilot, Cursor) that work alongside human teams.

- **Task Delegation:** Agents can be assigned to issues, search codebases, and initialize logic.
- **Structural Diffs:** The platform provides visual representations of code changes designed to handle high-volume output from AI coding agents.
- **Example Logic Transition:** The platform supports reviewing complex transitions, such as moving from blocking checks (e.g., `isFullySynced`) to asynchronous handling (e.g., `SyncStatus`).

## 4. Automations and Synchronization

The developer platform facilitates seamless synchronization between development environments and project management:

- **Git Automations:** Synchronizes code repositories directly with Linear issues.
- **Triage and Intake:** Automated handling of incoming requests via the **Linear Agent**, which routes, labels, and prioritizes feedback.

## 5. Resources for Developers

- **Documentation:** Detailed guides on features and integrations are available at `linear.app/docs`.
- **API Reference:** Specific technical details for the GraphQL API and TypeScript SDK are hosted at `developers.linear.app`.
- **Community:** A Slack community of over 20,000 users is available for sharing best practices and technical troubleshooting.
