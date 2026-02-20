# Vellum AI: High-Level Feature Summary and API Patterns

Vellum is an end-to-end AI development platform designed to bridge the gap between technical and non-technical teams. It provides a unified environment for experimenting with, evaluating, deploying, and monitoring AI-powered applications.

---

## 1. Core Platform Features

Vellum’s capabilities are organized into four primary pillars of AI development:

### Build & Orchestration

- **Prompt Engineering:** A collaborative sandbox for defining and iterating on prompts across various open and closed-source models. It supports dynamic templates using **Rich Text Blocks** (simple variable substitution) and **Jinja Blocks** (complex logic, loops, and conditionals).
- **Workflows:** A visual, low-code builder for constructing complex AI systems, including agents, chatbots, and data extraction pipelines.
- **Agent Builder:** Specialized tools and best practices for building autonomous or semi-autonomous AI agents.
- **Document Search & RAG:** Integrated pipelines for semantic search and Retrieval-Augmented Generation (RAG).

### Testing & Evaluation

- **Quantitative Evaluation:** Rigorous testing of AI systems using defined metrics and test suites rather than "vibe checks."
- **Scenarios:** The ability to test prompts against various input values to compare model outputs side-by-side.
- **Monitoring:** Production-grade tracking of performance, usage metrics, and token consumption.

### Deployment & Management

- **Version Control:** Built-in systems for managing prompts, orchestration logic, and model configurations.
- **Multimodality:** Support for processing images (JPEG, PNG, GIF, WEBP) and documents (PDFs) within prompts and workflows.

---

## 2. Prompt Engineering Patterns

Vellum treats prompts as dynamic templates rather than static strings.

### Templating Logic

- **Variable Substitution:** Reference input variables using `{{ variable_name }}`.
- **Jinja Support:** Allows for advanced logic, such as:
  ```jinja
  {% if personality_type == "rude" %}
  You end every message with a frowning emoji.
  {% else %}
  You end every message with a smiling emoji.
  {% endif %}
  ```
- **Function Calling:** Developers can define function signatures (name, description, parameters). The model returns a JSON object representing a function call, which the application developer then executes before feeding the result back to the LLM.

---

## 3. API Patterns and Integration

Vellum provides SDKs (e.g., Python) to integrate these features into external applications. The primary pattern involves executing a "Deployment" rather than calling a raw model, which allows for versioning and prompt management without code changes.

### Standard Prompt Execution

The core pattern uses the `execute_prompt` method, mapping input variables defined in the Vellum UI to values at runtime.

### Multimodal API Pattern

When dealing with images or documents, Vellum uses an `ArrayChatMessageContent` structure to combine different media types within a single message.

#### Example: Sending an Image via Python SDK

```python
import os
from vellum import (
    ArrayChatMessageContent,
    ChatHistoryInput,
    ChatMessage,
    ImageChatMessageContent,
    StringChatMessageContent,
    Vellum,
    VellumImage,
)

client = Vellum(api_key=os.environ["VELLUM_API_KEY"])

image_link = "https://example.com/image.jpg"
response = client.execute_prompt(
    prompt_deployment_name="my-multimodal-prompt",
    inputs=[
        ChatHistoryInput(
            name="chat_history",
            value=[
                ChatMessage(
                    role="USER",
                    content=ArrayChatMessageContent(
                        value=[
                            StringChatMessageContent(value="What's in the image?"),
                            ImageChatMessageContent(value=VellumImage(src=image_link)),
                        ]
                    ),
                )
            ],
        ),
    ],
)
print(response.outputs[0].value)
```

#### Example: Sending a PDF via Python SDK

```python
from vellum import (
    ArrayChatMessageContent,
    ChatHistoryInput,
    ChatMessage,
    DocumentChatMessageContent,
    StringChatMessageContent,
    Vellum,
    VellumDocument,
)

# PDF Pattern
pdf_link = "https://example.com/document.pdf"
response = client.execute_prompt(
    prompt_deployment_name="pdf-analysis-prompt",
    inputs=[
        ChatHistoryInput(
            name="chat_history",
            value=[
                ChatMessage(
                    role="USER",
                    content=ArrayChatMessageContent(
                        value=[
                            StringChatMessageContent(value="Summarize this PDF:"),
                            DocumentChatMessageContent(value=VellumDocument(src=pdf_link)),
                        ]
                    ),
                )
            ],
        ),
    ],
)
```

---

## 4. Technical Specifications

- **Image Limits:** Maximum 32MB per payload; supports JPEG, PNG, GIF, and WEBP.
- **Image Detail Settings:** `low` (512x512 resolution for speed) or `high` (tiled segments for detail).
- **Document Limits:** PDFs must be publicly accessible and under 32MB.
- **Variable Types:** All prompt variables are treated as strings by default but can be cast using Jinja filters (e.g., `| float`). JSON inputs are supported for accessing nested key/value pairs.
