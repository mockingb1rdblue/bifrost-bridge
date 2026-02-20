# CrewAI: High-Level Concepts and API Reference

CrewAI is a framework designed for orchestrating collaborative role-playing AI agents. It allows developers to create complex workflows where multiple agents work together to achieve specific tasks.

---

## 1. Core Concepts

### Agents

An **Agent** is an autonomous unit programmed to perform specific tasks, make decisions, and communicate with other agents.

- **Attributes**: Includes `role`, `goal`, `backstory`, `llm` (defaults to GPT-4), and `tools`.
- **Capabilities**: Agents can delegate tasks (if `allow_delegation` is True), execute code, and maintain memory.
- **Context Management**: By default, `respect_context_window=True` enables automatic summarization when token limits are reached.

### Tasks

Tasks are specific assignments given to agents. They require a `description` and an `expected_output`. Tasks can be assigned to specific agents or managed by a crew's process.

### Crews

A **Crew** represents a collaborative group of agents and a set of tasks. It defines the strategy for execution and collaboration.

- **Processes**:
  - `sequential` (default): Tasks are executed one after another.
  - `hierarchical`: Requires a `manager_llm` or `manager_agent` to coordinate execution.
- **Key Attributes**: `memory`, `cache`, `max_rpm` (overrides individual agent limits), and `knowledge_sources`.

---

## 2. Creating and Configuring Crews

The recommended approach is using **YAML configuration** for maintainability, though **Direct Code Definition** is also supported.

### YAML Configuration (Recommended)

This method uses the `@CrewBase` decorator to link YAML files to Python logic.

```python
from crewai import Agent, Crew, Task, Process
from crewai.project import CrewBase, agent, task, crew
from typing import List

@CrewBase
class ResearchCrew:
    agents_config = 'config/agents.yaml'
    tasks_config = 'config/tasks.yaml'

    @agent
    def researcher(self) -> Agent:
        return Agent(config=self.agents_config['researcher'], verbose=True)

    @task
    def research_task(self) -> Task:
        return Task(config=self.tasks_config['research_task'])

    @crew
    def crew(self) -> Crew:
        return Crew(
            agents=self.agents,
            tasks=self.tasks,
            process=Process.sequential
        )
```

### Direct Agent Interaction

Agents can also be executed independently of a crew:

```python
researcher = Agent(role="Researcher", goal="Find AI news", verbose=True)
result = researcher.kickoff("What are the latest developments in LLMs?")
```

---

## 3. Execution and Output Handling

### Execution Methods

| Method               | Type     | Description                                    |
| :------------------- | :------- | :--------------------------------------------- |
| `kickoff()`          | Sync     | Starts execution based on the defined process. |
| `akickoff()`         | Async    | Native async/await execution chain.            |
| `kickoff_async()`    | Threaded | Wraps synchronous execution in a thread.       |
| `kickoff_for_each()` | Sync     | Executes tasks for each item in a list.        |

### Handling Output

The `CrewOutput` object provides structured access to results:

```python
crew_output = crew.kickoff()

print(f"Raw: {crew_output.raw}")
if crew_output.json_dict:
    print(f"JSON: {crew_output.json_dict}")
if crew_output.pydantic:
    print(f"Pydantic: {crew_output.pydantic}")
```

---

## 4. CLI Reference

The CrewAI CLI provides tools for project management and debugging.

- **General Syntax**: `crewai [COMMAND] [OPTIONS]`
- **Task Management**:
  - `crewai log-tasks-outputs`: View task IDs for replaying.
  - `crewai replay -t <task_id>`: Replay the crew execution from a specific task.

---

## 5. API Reference (CrewAI AMP)

The CrewAI AMP REST API allows programmatic interaction with deployed crews.

### Authentication

All requests require a Bearer Token in the `Authorization` header.

```shell
curl -H "Authorization: Bearer YOUR_CREW_TOKEN" \
  https://your-crew-name.crewai.com/inputs
```

### Typical API Workflow

1.  **Discovery**: `GET /inputs` to see required parameters.
2.  **Execution**: `POST /kickoff` with inputs to receive a `kickoff_id`.
3.  **Monitoring**: `GET /{kickoff_id}/status` to poll for completion.

### HTTP Status Codes

- `200`: Success
- `401`: Unauthorized (Invalid token)
- `422`: Validation Error (Missing inputs)
- `500`: Server Error
