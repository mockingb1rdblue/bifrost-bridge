# Sluagh Project: Integration Protocol

This protocol outlines the engineering integration for the Sluagh project, utilizing the provided documentation for **Vellum** and **Fly.io**.

_Note: The provided context did not contain information regarding LangGraph, Perplexity, or Valibot. Consequently, these components are excluded from this technical synthesis to maintain strict adherence to the source material._

---

## 1. Architectural Overview

The Sluagh project architecture leverages **Vellum** as the AI orchestration and evaluation layer and **Fly.io** as the high-performance, sandboxed execution environment.

### Core Components

- **Orchestration (Vellum):** Manages prompt engineering, visual workflows, and RAG (Retrieval-Augmented Generation) pipelines.
- **Infrastructure (Fly.io):** Provides hardware-virtualized "Fly Machines" for deploying application code and isolated sandboxes for executing AI-generated code.

---

## 2. AI Development & Orchestration (Vellum)

Vellum serves as the central platform for building and monitoring AI features.

### Workflow & Agent Construction

- **Visual Builder:** Use Vellum’s visual Workflow builder to construct complex AI systems, including chatbots and data extraction pipelines.
- **Agent Builder:** Utilize the Agent Builder for creating sophisticated agents, following best practices for subject matter expertise integration.
- **RAG Pipeline:** Implement document search and semantic retrieval directly within Vellum to provide context to AI models.

### Evaluation and Deployment

- **Quantitative Evaluation:** Before production deployment, AI systems must pass through Vellum’s evaluation suites using specific metrics to move beyond "vibe checks."
- **Version Control:** Manage prompts and orchestration logic through Vellum’s built-in versioning system.
- **Monitoring:** Track production performance and usage metrics to ensure system reliability.

---

## 3. Infrastructure & Execution (Fly.io)

Fly.io provides the compute layer, specifically optimized for AI agents and untrusted code execution.

### Fly Machines for Agent Hosting

- **Isolation:** Deploy AI agents on dedicated VMs with KVM hardware isolation.
- **Ephemeral Workers:** Use Fly Machines for tasks requiring fast startup (under one second). Machines can be forked like processes to handle individual requests.
- **Resource Management:** Assign dedicated CPU, memory, and private filesystems to each agent instance.

### Sandboxed Code Execution

For features requiring the execution of AI-generated code:

- **Hardware-Isolated Sandboxes:** Run untrusted code in secure environments.
- **State Management:** Utilize the ability to checkpoint entire environments, run code, and restore the environment if the code causes a failure.
- **Efficiency:** Implement a pay-as-you-go model, billing by the second for actual CPU and memory consumption.

---

## 4. Integration Interface

To connect the AI logic (Vellum) with the execution environment (Fly.io), the project will utilize API-based communication.

### Tool Definition Example

When exposing Fly.io-hosted services to AI models (such as a documentation search tool), the following JSON manifest structure should be used for model-awareness:

```json
{
  "schema_version": "v1",
  "name_for_human": "Documentation Search",
  "name_for_model": "doc_search",
  "description_for_human": "Search through documentation using Elixir and Phoenix.",
  "description_for_model": "You are an expert documentation researcher. When answering questions, use this tool to search for relevant documentation.",
  "auth": {
    "type": "none"
  },
  "api": {
    "type": "openapi",
    "url": "https://<fly-app-name>.fly.dev/openapi.yaml",
    "is_user_authenticated": false
  }
}
```

### Networking & Security

- **Private Networking:** Use Fly.io’s built-in private networking and automatic end-to-end encryption for communication between distributed components.
- **Global Distribution:** Deploy Fly Machines in up to 18 regions (e.g., Sydney, São Paulo) to maintain sub-100ms latency for global users.

---

## 5. Implementation Workflow

1.  **Develop:** Define prompts and workflows in **Vellum**.
2.  **Test:** Run quantitative evaluations in **Vellum** test suites.
3.  **Containerize:** Package application logic for **Fly.io** (using native Docker support or framework-specific generators for Node.js, Python, etc.).
4.  **Deploy:** Launch Fly Machines via the Fly CLI to host the application and agent workers.
5.  **Monitor:** Use **Vellum’s** monitoring tools to track AI performance and **Fly.io’s** operational tools for hardware health.
