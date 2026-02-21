You can treat this as a surgical extraction of responsibilities from `router-do.ts` until the 300‑line limit is just a side effect of the architecture, not something you micromanage. [perplexity](https://www.perplexity.ai/search/7a988e9a-58db-4a5e-9ff4-c1916e8fb6ab)

## Step 1: Classify what the router is doing

First pass, don’t move code yet; just annotate and outline. Walk through `router-do.ts` top to bottom and mark each logical block with a short comment tag like `// [LIFECYCLE]`, `// [ROUTES-http]`, `// [JOBS]`, `// [WEBHOOK-linear]`, `// [LLM]`, etc. In a scratch file or comment at the top, list those tags and the rough line ranges so you see the implicit module graph that already exists. The goal of this pass is to answer: “What are the domains this router is secretly implementing?” so that every later cut is domain‑aligned instead of “split by file size.” [perplexity](https://www.perplexity.ai/search/7a988e9a-58db-4a5e-9ff4-c1916e8fb6ab)

## Step 2: Decide the module boundaries and names

From that tag list, choose 4–7 modules that reflect real domains rather than technical layers, for example `state-lifecycle`, `job-orchestration`, `swarm-tasks`, `llm-routing`, `webhooks-linear`, `webhooks-github`, and `maintenance/alarms`. For each, write a one‑sentence responsibility statement in a `ROUTER_NOTES.md` (or at the top of the file for now), e.g., “`job-orchestration` owns queueing, polling, and completion of jobs; it does not know HTTP.” Also decide the direction of dependencies (e.g., “router depends on services, services can depend on clients/utilities, but not on router”) so you don’t recreate the ball of mud in smaller files. [perplexity](https://www.perplexity.ai/search/e538f2e9-7e89-460c-9cdf-fb7dca2f0ecd)

## Step 3: Make the router a pure wiring layer

Next pass, enforce the rule: the Durable Object/router file should do three things only—decode requests, delegate to domain services, and translate results back to HTTP/DO responses. Introduce interfaces for each domain service at the top of the file or in a `router/contracts.ts`, like `JobService`, `SwarmService`, `LlmRouter`, `WebhookHandler`, defined in terms of methods the router actually needs. Then, within `router-do.ts`, start replacing inline logic with calls to imaginary methods on those interfaces without creating new files yet, e.g., `await this.jobService.enqueueJob(input)` instead of a 40‑line inline sequence. [perplexity](https://www.perplexity.ai/search/7a988e9a-58db-4a5e-9ff4-c1916e8fb6ab)

## Step 4: Extract services into modules

Once the interface surface is stable, create a `services/` (or `domains/`) directory next to the router and carve modules out by responsibility, such as `services/job-service.ts`, `services/swarm-service.ts`, `services/llm-router.ts`, `services/webhooks/linear.ts`, etc. For each imaginary service you used in Step 3, move the corresponding inline implementation from `router-do.ts` into the new file and implement the interface there, preserving behavior but freeing the router from internal details. Keep each service file under ~200 lines by peeling off cross‑cutting logic (validation, parsing, mapping) into `utils/` or `mappers/` submodules when they start getting heavy. [perplexity](https://www.perplexity.ai/search/e538f2e9-7e89-460c-9cdf-fb7dca2f0ecd)

## Step 5: Isolate state and external clients

Right now your router probably talks directly to `this.state`, storage, and external APIs like Linear, GitHub, or LLM providers. Introduce small, explicit abstractions: a `StateRepository` (or a couple of repos by aggregate) that hides Durable Object storage concerns, and `clients/` modules for each external integration with minimal method surfaces. Refactor services so they depend on these repositories/clients, not `this.state` or bare `fetch`, which lets you test them and, later, rearrange them into a mesh or different worker without touching the core logic. [perplexity](https://www.perplexity.ai/search/e538f2e9-7e89-460c-9cdf-fb7dca2f0ecd)

## Step 6: Clean up construction and dependency wiring

As soon as you have multiple services, repositories, and clients, create a thin composition module (e.g., `router/dependencies.ts`) whose only job is to new up everything and return an object graph. In `router-do.ts`, the Durable Object constructor should just call `buildRouterDependencies(this.state, env)` (or similar) and stash the resulting services; the rest of the class only uses interfaces. This keeps the router file focused on wiring requests to interfaces and keeps construction logic from bloating it back over 300 lines over time. [perplexity](https://www.perplexity.ai/search/7a988e9a-58db-4a5e-9ff4-c1916e8fb6ab)

## Step 7: Enforce the 300‑line rule going forward

Once you’ve done the extraction, measure `router-do.ts`; it should now be mostly route registration, method dispatch, and error handling—and likely well under 300 lines. Add a simple check to your CI or a local script (even a one‑liner using `wc -l` or a tiny Node script) that fails if router files exceed 300 lines, and document this rule in your worker SOP so future changes must add behavior via services, not the router itself. You can also add a quick “smoke” unit test that instantiates the router with stub services, which both protects the wiring and makes it painful to reintroduce tight coupling. [perplexity](https://www.perplexity.ai/search/e538f2e9-7e89-460c-9cdf-fb7dca2f0ecd)

If you paste a rough outline of the current major route groups (even just a list like “/jobs, /swarm, /llm, /webhooks, /maintenance”), I can help you define the exact module list and minimal interfaces so you can execute this in two or three low‑risk passes.