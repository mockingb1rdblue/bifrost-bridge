This report outlines the coding patterns, practices, and architectural recommendations for the specified technologies based on the provided documentation.

---

### Vellum

Vellum focuses on prompt engineering and AI workflow orchestration. The documentation highlights specific patterns for template construction and logic handling.

#### Recommended Coding Patterns

- **Variable Substitution**:
  - Use **Rich Text Blocks** for simple substitutions. These are triggered using `{{` or `/`.
  - Use **Jinja Blocks** for complex logic, such as loops or conditional branching.
- **Jinja Templating Syntax**:
  - **Variables**: Reference variables using double curly brackets: `{{ personality_type }}`.
  - **Conditionals**: Use standard Jinja `if/else` blocks for dynamic prompt logic.
    ```jinja
    {% if personality_type == "rude" %}
    You end every message with a frowning emoji.
    {% else %}
    You end every message with a smiling emoji.
    {% endif %}
    ```
  - **JSON Handling**: Access nested properties within JSON input variables using dot notation.
    ```jinja
    You are a {{ traits.personality }} AI assistant.
    ```
- **Type Casting**: Since Vellum treats all input variables as strings by default, use Jinja filters to cast types for logic:
  ```jinja
  {% if age | float > 16 %}
  is of legal driving age.
  {% endif %}
  ```
- **Function Calling**: Define functions with a Name, Description, and Parameters. The model returns a JSON object; the developer is responsible for executing the logic and returning a `function` message to the LLM.

#### Restricted Practices

- **Avoid Over-Engineering**: Do not use Jinja blocks if a simple Rich Text block for variable substitution is sufficient.
- **Token Management**: Use Jinja comments `{# comment #}` to document prompts without consuming LLM tokens.

---

### Fly.io

Fly.io provides infrastructure for deploying applications using hardware-virtualized "Fly Machines."

#### Recommended Coding Patterns

- **Ephemeral Compute**: Use Fly Machines to run code only when needed. They are designed to start fast enough (under a second) to handle individual HTTP requests.
- **VM Forking**: Fork VMs like processes to scale into thousands of instances or handle specific tasks.
- **Sandboxing**: Run AI-generated or untrusted code in hardware-isolated sandboxes to ensure security.
- **Data Locality**: Use local NVMe for low-latency workloads and global object storage for persistent data.
- **Agent Hosting**: Deploy AI agents on dedicated VMs with isolated networking and private filesystems to support both persistent "brains" and ephemeral workers.

#### Restricted Practices

- **Untrusted Code**: Do not run AI-generated or untrusted code outside of hardware-isolated sandboxes.
- **Orchestration Complexity**: Avoid complex orchestration tools like Terraform for modern RPC systems (e.g., Elixir FLAME), as Fly.io supports these natively.

---

### LangGraph and Valibot

**Note**: The provided context does not contain information regarding specific coding patterns, ESLint rules, or restricted practices for **LangGraph** or **Valibot**.

---

### ESLint Rules

The provided documentation does not specify any custom or recommended **ESLint rules** for any of the mentioned technologies. Development is generally supported through standard SDKs, APIs, and CLI tools.
