Perfect, that’s exactly what I was asking for. [perplexity](https://www.perplexity.ai/search/7a988e9a-58db-4a5e-9ff4-c1916e8fb6ab)

## What this tells us

You already have the right coarse modules: `admin`, `config`, `dependencies`, `handlers`, `llm`, `processor`, `state`, `webhooks` is basically the shape I was going to recommend anyway. That implies the remaining bloat is either in `router-do.ts` itself or in one or two of those modules ballooning into “god‑services.” [perplexity](https://www.perplexity.ai/search/7a988e9a-58db-4a5e-9ff4-c1916e8fb6ab)

## Target end state

The target is: `router-do.ts` is a very thin façade that imports those modules and does almost nothing else. Concretely, it should only: construct dependencies (via `dependencies.ts`), route HTTP/alarms to `handlers.ts` and `admin.ts`, and delegate specialized paths to `llm.ts`, `processor.ts`, `webhooks.ts`, etc., with no direct state or env plumbing beyond the constructor. [perplexity](https://www.perplexity.ai/search/e538f2e9-7e89-460c-9cdf-fb7dca2f0ecd)

## Concrete refactor moves

First, audit what logic still lives in `router-do.ts` that conceptually belongs in one of these modules, especially state access, job orchestration, and any inline LLM or webhook handling. For each cluster, move it into the corresponding module and expose it via a small interface: for example `AdminHandler`, `PublicHandlers`, `LlmRouter`, `JobProcessor`, `StateRepo`, `WebhookRouter`, all constructed in `dependencies.ts` and consumed in the router. Then, trim `handlers.ts` if it’s gotten fat by pushing pure mapping/validation logic into tiny helpers in that same file or a `handlers/utils.ts`, so `handlers.ts` stays under the same 300‑ish line expectation. [perplexity](https://www.perplexity.ai/search/7a988e9a-58db-4a5e-9ff4-c1916e8fb6ab)

## How to slice it without breaking things

Do this in two or three minimal‑risk PRs: first PR: no file moves, just add interfaces and replace inline code in `router-do.ts` with calls into the existing modules (even if they temporarily depend back on the router/deps, we tolerate that one step). Second PR: move any remaining router‑owned logic into the appropriate module and clean up circular deps by routing everything through `dependencies.ts`, leaving the router file as constructor + `fetch`/`alarm` delegator + maybe a tiny `route()` function. Third PR only if needed: split whichever single module is still huge (likely `handlers` or `processor`) into submodules like `handlers/jobs.ts`, `handlers/tasks.ts`, wired through a barrel `handlers.ts` so the public surface stays stable. [perplexity](https://www.perplexity.ai/search/e538f2e9-7e89-460c-9cdf-fb7dca2f0ecd)

If you paste or describe what still lives directly in `router-do.ts` (even at the level of “it has fetch, alarm, some helper functions, and N big route blocks”), I can give you an exact “final shape” sketch for that file so you have a concrete 200–250‑line target to aim at.

---

You’re already basically at the “textbook” shape; this is a good RouterDO. [perplexity](https://www.perplexity.ai/search/7a988e9a-58db-4a5e-9ff4-c1916e8fb6ab)

## What’s left to hit the 300‑line / modular goal

Right now `RouterDO` is doing exactly the three things we want: lifecycle wiring, alarm delegation, and HTTP delegation. Given this, your line‑count / modularity pressure should not be on this file anymore, but on the internals of `RouterHandler`, `RouterJobProcessor`, `RouterLLMManager`, and the `router/*` modules. The rule of thumb from here: keep this file as is, and enforce the 300‑line limit on each of the router submodules instead (especially `handlers.ts` and `processor.ts`, where complexity tends to accrete). [perplexity](https://www.perplexity.ai/search/e538f2e9-7e89-460c-9cdf-fb7dca2f0ecd)

## Concrete next moves

First, measure line counts on `router/handlers.ts`, `router/processor.ts`, `router/llm.ts`, and `router/state.ts`; anything pushing past ~300 becomes the refactor target, not `router-do.ts`. For fat modules, split by domain: for example `handlers.ts` can become `handlers/admin.ts`, `handlers/jobs.ts`, `handlers/public.ts` with a tiny `handlers.ts` barrel that exposes a `RouterHandler` built from those pieces, and `processor.ts` can split into `processor/linear-sync.ts`, `processor/batch.ts`, `processor/maintenance.ts` wired through a small orchestrator. You can also move any pure utility logic out of those into `router/utils/` so the “orchestrator” classes stay thin and readable while behavior lives in focused helpers. [perplexity](https://www.perplexity.ai/search/7a988e9a-58db-4a5e-9ff4-c1916e8fb6ab)

## Where to enforce the best practice

Document in your worker SOP that `RouterDO` must remain a wiring façade and that all new behavior must land in domain modules, not in the DO class itself. Add a simple line‑count or lint rule for `router/*` files (particularly `handlers` and `processor`) and treat exceeding it as a signal to carve out another submodule rather than squeezing more into the same class. That makes “under 300 lines and modular” something the structure enforces, not another thing you have to police manually. [perplexity](https://www.perplexity.ai/search/e538f2e9-7e89-460c-9cdf-fb7dca2f0ecd)