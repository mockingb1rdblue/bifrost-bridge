# Pending Backlog (Blocked by Linear Limits)

This file tracks technical issues that have been thin-sliced and architected but cannot be seeded into the Linear workspace due to the **250-issue free tier limit**.

> [!IMPORTANT]
> **DO NOT DELETE THESE**. Once space is cleared in Linear (through archival or completion), these should be moved into the official backlog.

---

## 🐝 Swarm Infrastructure: Telemetry & Resilience

### 1. Idempotent Migration Enforcement
**Description**: Refactor `db.ts` to use a schema versioning table (e.g., `schema_migrations`) instead of ad-hoc `PRAGMA table_info` checks. Ensure all future `ALTER TABLE` operations are wrapped in a transaction that updates the version.

### 2. Automatic Secret Environment Validation
**Description**: Add a pre-deploy check to `maintenance-loop.sh` that verifies if the targeted Cloudflare environment exists. Fail fast if `--env production` is used but no `[env.production]` block exists in `wrangler.toml`, preventing the creation of duplicate workers.

### 3. Event Store Health Probe Chaining
**Description**: Implement a health check in `crypt-core` that pings the Event Store's `/health` endpoint before attempting to deliver a batch. If the Event Store is down (e.g., Fly.io machine stopped), trigger an alert or attempt to wake the machine via Fly API.

---

## 🔐 Infrastructure: Secret Resolution Service

### 1. Design Secret Resolver Worker Schema
**Source**: [new_auth.md](file:///docs/infrastructure/new_auth.md)
**Description**: Create a design document for a Cloudflare Worker that acts as a secure proxy for local development tools to fetch secrets without storing them locally. Define the authentication handshake between the local script and the resolver.

### 2. Implement Secret Resolver Worker Skeleton
**Source**: [new_auth.md](file:///docs/infrastructure/new_auth.md)
**Description**: Build the initial Cloudflare Worker for secret resolution. Implement an `/access` endpoint that verifies a one-time-token and returns a signed payload of necessary environment variables.

---

## 📈 Future Planning

Add high-priority architected issues here as we hit limits.

---

## Cairn Codex: Agent-First Task Orchestration Database

**Name rationale:** Cairn = stone pile marking important sites, memorial of completed work. Codex = systematic record, ancient knowledge compilation. Together: the stone record of autonomous work, building upward task by task. [openalternative](https://openalternative.co/alternatives/linear)

***

## MVP Thin-Sliced Issues (Weekend Build)

### Foundation Layer (Issues 1-8)

**Issue 1: Create Postgres Database Schema**
Create new Postgres database with four tables. Tasks table with columns: id (UUID primary key), title (text), description (text), status (text), priority (integer 1-5), effort_estimate (integer minutes), created_at (timestamp), updated_at (timestamp). Add indexes on status and priority columns. No foreign keys yet. Test by connecting with psql and inserting mock task. [github](https://github.com/makeplane/plane)

**Issue 2: Create Dependencies Table Schema**
Add Dependencies table with columns: id (UUID primary key), task_id (UUID), depends_on_task_id (UUID), dependency_type (text either hard or soft), created_at (timestamp). Add foreign key constraints linking both task_id fields to Tasks table id column. Add composite index on task_id and depends_on_task_id pair for fast lookups. [slashdev](https://slashdev.io/-how-to-build-a-custom-it-project-management-tool-in-2024)

**Issue 3: Create Agent Executions Table Schema**
Add AgentExecutions table with columns: id (UUID primary key), task_id (UUID foreign key to Tasks), agent_type (text), worker_id (text), started_at (timestamp), completed_at (nullable timestamp), duration_seconds (integer), cost_dollars (decimal), success (boolean), error_message (nullable text). Index on task_id for history queries. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 4: Create Task Metadata Table Schema**
Add TaskMetadata table with columns: id (UUID primary key), task_id (UUID foreign key to Tasks), metadata_key (text), metadata_value (text), created_at (timestamp). This enables extensible properties without schema changes. Add unique constraint on task_id and metadata_key pair to prevent duplicate keys. Index on task_id for fast retrieval. [slashdev](https://slashdev.io/-how-to-build-a-custom-it-project-management-tool-in-2024)

**Issue 5: Deploy Postgres to Fly.io**
Create Fly.io Postgres cluster using fly postgres create command. Choose smallest instance size for MVP. Note connection string including hostname, port, database name, username, password. Test connection from local machine using psql. Run schema SQL files from Issues 1-4 to create all tables. Verify tables exist with describe table commands. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 6: Create Node.js API Server Scaffold**
Initialize new Node.js project with Express framework. Install dependencies: express, pg (Postgres client), uuid, cors, dotenv. Create basic server that listens on port 3000. Add health check endpoint GET /health that returns JSON with status ok. Store database connection string in environment variable. Test server starts successfully. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 7: Create Database Connection Module**
Create database connection pool using pg library. Load connection string from environment variable. Export query function that accepts SQL string and parameters, executes query, returns results. Handle connection errors gracefully with logging. Add connection pool size limit of 10. Test by calling query function with simple SELECT query from Issues 1-4 tables. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 8: Add API Authentication Middleware**
Create middleware function that checks for Authorization header with Bearer token. Compare token against environment variable CAIRN_API_KEY. If match, call next handler. If missing or mismatch, return 401 Unauthorized. Apply middleware to all routes except health check. Test with curl sending requests with and without valid token. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

### Task CRUD Operations (Issues 9-16)

**Issue 9: Implement Create Task Endpoint**
Create POST /tasks endpoint that accepts JSON body with title, description, priority, effort_estimate. Generate UUID for new task. Set status to ready, created_at and updated_at to current timestamp. Insert into Tasks table using parameterized query. Return created task JSON with all fields including generated id. Handle validation errors if required fields missing. [slashdev](https://slashdev.io/-how-to-build-a-custom-it-project-management-tool-in-2024)

**Issue 10: Implement Get Task Endpoint**
Create GET /tasks/:taskId endpoint that accepts task ID in URL parameter. Query Tasks table for task with matching id. If found return task JSON with all fields. If not found return 404 Not Found with error message. Handle invalid UUID format errors gracefully. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 11: Implement List Tasks Endpoint**
Create GET /tasks endpoint that returns array of all tasks. Accept optional query parameters: status filter, priority filter, limit (default 100), offset (default 0) for pagination. Build SQL query dynamically based on provided filters. Order by priority descending then created_at ascending. Return JSON array of task objects. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 12: Implement Update Task Endpoint**
Create PATCH /tasks/:taskId endpoint that accepts JSON with fields to update (title, description, status, priority, effort_estimate). Load existing task by id. Merge provided fields with existing task. Set updated_at to current timestamp. Update Tasks table row. Return updated task JSON. Return 404 if task not found. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 13: Implement Delete Task Endpoint**
Create DELETE /tasks/:taskId endpoint that removes task and all related data. First delete all rows from Dependencies where task_id or depends_on_task_id matches. Then delete from AgentExecutions where task_id matches. Then delete from TaskMetadata where task_id matches. Finally delete from Tasks. Return 204 No Content on success. Wrap in database transaction so all-or-nothing. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 14: Add Task Status Transition Logic**
Create function validateStatusTransition that accepts current status and new status. Define valid transitions: ready can go to assigned, assigned can go to in_progress, in_progress can go to completed or failed, failed can go to ready (retry). Return boolean if transition valid. Modify update task endpoint to call validator before updating status field. Return 400 Bad Request if invalid transition. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 15: Implement Bulk Create Tasks Endpoint**
Create POST /tasks/batch endpoint that accepts JSON array of task objects. Loop through array and insert each task using same logic as single create. Wrap in database transaction so either all tasks created or none. Return array of created task objects with generated ids. Limit batch size to 100 tasks to prevent abuse. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 16: Add Task Search Endpoint**
Create GET /tasks/search endpoint that accepts query parameter q for text search. Search across title and description fields using Postgres ILIKE operator for case-insensitive partial matching. Return array of matching tasks ordered by relevance (exact matches first, then partial). Limit results to 50 tasks. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

### Dependency Management (Issues 17-24)

**Issue 17: Create Add Dependency Endpoint**
Create POST /tasks/:taskId/dependencies endpoint that accepts JSON with depends_on_task_id and dependency_type (default hard). Verify both task IDs exist in Tasks table. Insert into Dependencies table. Return created dependency object. Prevent creating dependency if it would create circular reference by checking if reverse path already exists. [ijcai](https://www.ijcai.org/proceedings/2023/30)

**Issue 18: Implement Get Task Dependencies Endpoint**
Create GET /tasks/:taskId/dependencies endpoint that returns all dependencies for task. Query Dependencies table where task_id matches. Join with Tasks table to include full task objects for each dependency. Return JSON array of dependency objects with both dependency metadata and full task details. [ijcai](https://www.ijcai.org/proceedings/2023/30)

**Issue 19: Create Check Task Ready Endpoint**
Create GET /tasks/:taskId/ready endpoint that checks if task ready for execution. Query all dependencies for task. For each dependency, check if depends_on_task has status completed. Return JSON with ready boolean true if all dependencies satisfied, false otherwise. Include array of unsatisfied dependency task ids if not ready. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 20: Implement Get Blocked By Endpoint**
Create GET /tasks/:taskId/blocks endpoint that returns all tasks blocked by this task. Query Dependencies table where depends_on_task_id matches task id. Join with Tasks table to get full task objects. Return JSON array showing which tasks are waiting for this one to complete. Include count of total blocked tasks. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 21: Create Delete Dependency Endpoint**
Create DELETE /tasks/:taskId/dependencies/:dependencyId endpoint that removes specific dependency. Query Dependencies table to find dependency by id and verify task_id matches URL parameter. Delete row. Return 204 No Content on success. Return 404 if dependency not found or doesn't belong to specified task. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 22: Implement Blocking Impact Calculator**
Create GET /tasks/:taskId/blocking-impact endpoint that returns how many tasks this one blocks. Recursively query Dependencies table following blocked_by chains. Count all downstream tasks that transitively depend on this task either directly or indirectly. Return JSON with blocking_count integer and array of all blocked task ids. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 23: Build Dependency Graph Endpoint**
Create GET /tasks/dependency-graph endpoint that returns full dependency structure for visualization. Query all tasks and all dependencies. Build nested JSON structure with tasks as nodes and dependencies as edges. Include task status and priority in node data. Format compatible with graph visualization libraries. [ijcai](https://www.ijcai.org/proceedings/2023/30)

**Issue 24: Create Circular Dependency Detector**
Create function detectCircularDependency that accepts task_id and new_depends_on_task_id. Perform depth-first search starting from new dependency following depends_on chains. If search reaches original task_id, circular dependency exists. Return boolean indicating if adding this dependency would create cycle. Use in add dependency endpoint to prevent invalid dependencies. [ijcai](https://www.ijcai.org/proceedings/2023/30)

### Agent Execution Tracking (Issues 25-30)

**Issue 25: Create Start Execution Endpoint**
Create POST /tasks/:taskId/executions endpoint that accepts JSON with agent_type and worker_id. Insert into AgentExecutions table with started_at set to current timestamp, completed_at null, success null. Update task status to in_progress if currently assigned. Return created execution object with generated id. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 26: Implement Complete Execution Endpoint**
Create POST /executions/:executionId/complete endpoint that accepts JSON with success boolean, cost_dollars, error_message (optional). Load execution by id. Set completed_at to current timestamp. Calculate duration_seconds from started_at to completed_at. Update all fields. If success true, update task status to completed. If success false, update task status to failed. Return updated execution object. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 27: Create Get Task Execution History Endpoint**
Create GET /tasks/:taskId/executions endpoint that returns all execution attempts for task. Query AgentExecutions table where task_id matches. Order by started_at descending (most recent first). Return JSON array of execution objects. Include summary statistics: total attempts, success count, failure count, total cost, average duration. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 28: Implement Agent Performance Metrics Endpoint**
Create GET /agents/:agentType/metrics endpoint that aggregates performance across all tasks. Query AgentExecutions filtered by agent_type. Calculate average duration, average cost, success rate percentage, total executions. Group by time period (last hour, last day, all time). Return JSON with metrics breakdown. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 29: Create Retry Task Function**
Create POST /tasks/:taskId/retry endpoint that resets task for new execution attempt. Load task by id. Verify current status is failed. Update status back to ready. Optionally increment retry_count metadata field. Clear any assigned worker_id metadata. Return updated task object ready for reassignment. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 30: Add Execution Timeout Detector**
Create GET /executions/stale endpoint that finds executions running longer than expected. Query AgentExecutions where completed_at is null and started_at older than 2 hours ago. Join with Tasks to include task effort_estimate. Flag executions exceeding 2x estimated duration. Return JSON array of stale execution objects with task details. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

### Metadata and Extensions (Issues 31-36)

**Issue 31: Create Set Metadata Endpoint**
Create POST /tasks/:taskId/metadata endpoint that accepts JSON with key and value strings. Check if metadata_key already exists for task. If exists, update value. If not exists, insert new row. Return metadata object. This enables storing arbitrary task properties without schema changes. [slashdev](https://slashdev.io/-how-to-build-a-custom-it-project-management-tool-in-2024)

**Issue 32: Implement Get Metadata Endpoint**
Create GET /tasks/:taskId/metadata endpoint that returns all metadata for task. Query TaskMetadata table where task_id matches. Return JSON object with keys as properties and values as property values. Also accept optional key query parameter to retrieve single metadata value. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 33: Create Batch Get Metadata Endpoint**
Create POST /tasks/metadata/batch endpoint that accepts JSON array of task ids. Query TaskMetadata for all provided task ids in single query. Return JSON object where keys are task ids and values are metadata objects for that task. This reduces API roundtrips when loading many tasks. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 34: Add Common Metadata Helpers**
Create convenience endpoints for frequently used metadata. POST /tasks/:taskId/assign that accepts worker_id and sets assigned_worker metadata plus updates status to assigned. POST /tasks/:taskId/estimate that accepts effort_minutes and updates effort_estimate field. These wrap underlying metadata operations. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 35: Implement Tag System via Metadata**
Create POST /tasks/:taskId/tags endpoint that accepts JSON array of tag strings. Store as metadata with key tags and value as JSON array string. Create GET /tasks/by-tag/:tagName endpoint that queries TaskMetadata for rows where key is tags and value contains specified tag string. Return array of matching tasks. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 36: Create Custom Field Schema Endpoint**
Create GET /schema/custom-fields endpoint that returns list of all metadata keys currently in use across all tasks. Query distinct metadata_key values from TaskMetadata table. Return array of strings. This helps discover what custom fields exist without hardcoding. Include usage count per field. [slashdev](https://slashdev.io/-how-to-build-a-custom-it-project-management-tool-in-2024)

### Webhooks and Events (Issues 37-42)

**Issue 37: Create Webhook Registry Table**
Add Webhooks table with columns: id (UUID primary key), url (text), event_types (text array), active (boolean default true), secret (text for signature verification), created_at (timestamp). Create POST /webhooks endpoint to register new webhook. Store webhook configuration in database. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 38: Implement Event Emission Function**
Create function emitEvent that accepts event_type and event_data JSON. Query Webhooks table for active webhooks subscribed to this event type. For each webhook, make HTTP POST request to webhook URL with event data as JSON body. Add timestamp and event id to payload. Run webhook calls asynchronously so they don't block main response. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 39: Add Webhook Signatures**
Modify emitEvent to generate HMAC signature using webhook secret and event payload. Include signature in X-Webhook-Signature header. Create verification endpoint POST /webhooks/verify that webhook receivers can use to test signature validation. This prevents webhook spoofing. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 40: Trigger Webhooks on Task Changes**
Modify update task endpoint to call emitEvent after successful update. Emit events: task.created, task.updated, task.completed, task.failed, task.deleted. Include full task object and old values for updated fields in event data. Allow filtering webhooks by event type during registration. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 41: Create Webhook Delivery Log**
Add WebhookDeliveries table with columns: id (UUID), webhook_id (UUID foreign key), event_type (text), delivered_at (timestamp), status_code (integer), response_body (text), error_message (nullable text). Log every webhook attempt. Create GET /webhooks/:webhookId/deliveries endpoint to view delivery history for debugging. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 42: Implement Webhook Retry Logic**
Modify emitEvent to retry failed webhook deliveries. If POST request returns 5xx error or times out, retry up to 3 times with exponential backoff (30 seconds, 2 minutes, 5 minutes). Mark webhook inactive after max retries exhausted. Log all attempts to WebhookDeliveries table. [nature](https://www.nature.com/articles/s41598-025-21709-9)

### Basic Web UI (Issues 43-48)

**Issue 43: Create Static HTML Task List Page**
Create single HTML file with embedded CSS and JavaScript. Add table displaying tasks with columns: title, status, priority, created date. Fetch tasks from GET /tasks API on page load using JavaScript fetch. Render rows dynamically. No framework needed—vanilla JavaScript. Serve from Express static file middleware. [github](https://github.com/makeplane/plane)

**Issue 44: Add Task Detail View**
Extend HTML page with modal or side panel that shows full task details when row clicked. Fetch individual task via GET /tasks/:taskId API. Display all fields including description, timestamps, effort estimate. Add buttons for status transitions (Start, Complete, Fail). Wire buttons to PATCH /tasks/:taskId API calls. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 45: Implement Task Creation Form**
Add form to HTML page with inputs for title, description, priority dropdown, effort estimate number field. On submit, POST to /tasks endpoint with form data. Clear form and refresh task list on success. Show validation errors if API returns 400. Basic HTML form validation for required fields. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 46: Add Dependency Visualization**
Create second HTML page that renders dependency graph using D3.js or vis.js library loaded from CDN. Fetch graph data from GET /tasks/dependency-graph endpoint. Render tasks as nodes with colors indicating status. Render dependencies as arrows. Make nodes clickable to show task details. [github](https://github.com/makeplane/plane)

**Issue 47: Create Simple Dashboard**
Add third HTML page showing aggregate statistics. Fetch metrics from multiple API endpoints (task counts by status, agent performance, recent completions). Display as cards with large numbers and labels. Add auto-refresh every 30 seconds. Use Chart.js from CDN for simple bar/line charts. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 48: Add Authentication to Web UI**
Create login page that prompts for API key. Store key in browser localStorage after validation. Include stored key in Authorization header for all API requests from UI pages. Redirect to login if API returns 401. Add logout button that clears localStorage and redirects to login. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

***

## Maximal Swarm Features (Beyond MVP)

### Advanced Orchestration (Issues 49-60)

**Issue 49: Implement Task Prioritization Engine**
Create POST /tasks/prioritize endpoint that accepts prioritization algorithm name (highest_priority, blocker_impact, effort, balanced, critical_path). Query all ready status tasks. Apply selected algorithm to calculate priority scores. Store scores in metadata. Return sorted task array. Add score calculation timestamp to track freshness. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 50: Build Worker Pool Registry**
Add Workers table with columns: id (UUID), worker_type (text), capacity (integer max concurrent tasks), current_load (integer active tasks), status (active/idle/disabled), last_heartbeat (timestamp), metadata (JSON for extensibility). Create CRUD endpoints for worker management. Track which workers handle which agent types. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 51: Create Smart Task Assignment Endpoint**
Create POST /tasks/:taskId/assign-optimal endpoint that finds best available worker for task. Query task requirements from metadata (agent type needed, effort estimate). Query Workers table for capable workers with available capacity. Apply load balancing to select least loaded worker. Create execution record and update task status. Return assigned worker details. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 52: Implement Batch Assignment Processor**
Create POST /tasks/assign-batch endpoint that accepts count parameter (how many tasks to assign). Query ready tasks sorted by current prioritization. For each task, call optimal assignment logic. Stop when count reached or no workers available. Return array of assignment results with task ids and assigned workers. This enables orchestrator to assign work in bulk. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 53: Add Worker Heartbeat System**
Create POST /workers/:workerId/heartbeat endpoint that updates last_heartbeat timestamp and current_load. Workers call this every 60 seconds while active. Create GET /workers/stale endpoint that finds workers where last_heartbeat older than 5 minutes. Mark stale workers as disabled status. This detects crashed workers. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 54: Build Preemption Logic**
Create POST /tasks/:taskId/preempt endpoint that interrupts lower priority work to assign high priority task. Accept target_worker_id parameter. Load worker's current task. If current task has lower priority than new task, update current task back to ready status, end its execution as preempted. Assign new task to worker. Log preemption event. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 55: Implement Task Splitting**
Create POST /tasks/:taskId/split endpoint that divides task into subtasks. Accept JSON array of subtask definitions (title, description, effort_estimate). Create new task for each subtask with parent_task_id metadata linking to original. Create dependencies so subtasks don't block each other unless specified. Update parent task status to split. Return array of created subtask ids. [ijcai](https://www.ijcai.org/proceedings/2023/30)

**Issue 56: Add Parallel Execution Tracking**
Extend AgentExecutions to track parallel subtask coordination. Add parent_execution_id field linking subtask executions to parent. Create GET /executions/:executionId/subtasks endpoint showing progress across parallel work. Calculate completion percentage based on subtask statuses. This enables multi-agent coordinated tasks. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 57: Build Failure Recovery Strategies**
Create FailureStrategies table storing recovery rules per failure type. Add strategy_id to tasks via metadata. When task fails, query matching strategy (retry with same agent, reassign to different agent type, split into smaller tasks, escalate to manual). Apply strategy automatically. Log which strategy applied for learning. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 58: Implement Cost Budget Tracking**
Add Budgets table with columns: id (UUID), project_id (text), period (text like monthly or weekly), allocated_dollars (decimal), spent_dollars (decimal), alert_threshold (decimal percentage). Create budget tracking that increments spent amount when executions complete. POST budget alerts when threshold exceeded. Query budget status before expensive assignments. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 59: Create Velocity Metrics Tracker**
Add VelocitySnapshots table storing point-in-time metrics: timestamp, tasks_completed_last_hour, tasks_completed_last_day, average_task_duration, active_worker_count. Create background job that calculates and stores snapshot every 15 minutes. Create GET /metrics/velocity/trend endpoint returning time series for dashboard visualization. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 60: Build Capacity Projection System**
Create GET /capacity/projection endpoint that analyzes velocity trends and current queue depth. Calculate tasks per hour completion rate. Divide ready queue size by rate to estimate hours until queue empty. Factor in worker availability. Return JSON with projected_completion_time, bottleneck_workers, and recommended_actions array. [arxiv](https://arxiv.org/html/2502.02311v1)

### Intelligence Layer (Issues 61-72)

**Issue 61: Implement Task Similarity Detector**
Create POST /tasks/:taskId/similar endpoint that finds similar historical tasks. Extract keywords from title and description. Query completed tasks with matching keywords. Calculate similarity score based on keyword overlap, effort estimate proximity, agent type match. Return array of similar tasks with their execution outcomes for learning. [slashdev](https://slashdev.io/-how-to-build-a-custom-it-project-management-tool-in-2024)

**Issue 62: Build Success Predictor**
Create GET /tasks/:taskId/predict-success endpoint that estimates success probability. Load similar historical tasks using similarity detector. Calculate success rate across similar tasks. Factor in assigned agent's historical performance on similar work. Return JSON with success_probability percentage, confidence level, and contributing factors. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 63: Add Effort Estimation Refinement**
Create POST /tasks/:taskId/refine-estimate endpoint that improves effort estimate using historical data. Find similar completed tasks. Calculate actual duration distribution. Adjust task's effort_estimate to historical average. Store confidence interval in metadata. Update estimate automatically when similar tasks complete. [slashdev](https://slashdev.io/-how-to-build-a-custom-it-project-management-tool-in-2024)

**Issue 64: Implement Agent Specialization Tracker**
Create GET /agents/:agentType/specializations endpoint that identifies what work types agent excels at. Query agent's execution history grouped by task metadata tags or keywords. Calculate success rate and efficiency per work type. Return ranked list of specializations with performance metrics. Use for intelligent agent selection. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 65: Build Bottleneck Detection System**
Create GET /bottlenecks endpoint that identifies workflow constraints. Analyze dependency graph to find tasks blocking many others. Analyze worker pool to find overloaded workers. Analyze task types queuing frequently. Return JSON with bottleneck_tasks, bottleneck_workers, and bottleneck_types arrays with severity scores. [ijcai](https://www.ijcai.org/proceedings/2023/30)

**Issue 66: Create Optimization Recommender**
Create GET /recommendations endpoint that suggests workflow improvements. Combine bottleneck data, agent specialization data, failure pattern analysis. Generate specific recommendations: "Assign authentication tasks to Bifrost agent (95% success rate) instead of Jules (60% success rate)", "Task X blocks 15 tasks—prioritize immediately". Return prioritized recommendation array. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 67: Implement Learning Feedback Loop**
Create POST /outcomes/:executionId/feedback endpoint accepting human rating (thumbs up/down). Store feedback in new OutcomeFeedback table linking to execution. Use feedback to weight agent selection—prefer agents with positive feedback history. Create GET /agents/by-satisfaction endpoint ranking agents by feedback scores. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 68: Add Cost Optimization Analyzer**
Create GET /cost/optimize endpoint that identifies expensive patterns. Find tasks with high cost but low complexity (should use cheaper agent). Find tasks being retried multiple times (waste). Calculate potential savings if optimal agent selected. Return optimization opportunities with projected monthly savings. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 69: Build Time-of-Day Pattern Detector**
Create GET /patterns/temporal endpoint analyzing when work succeeds/fails. Group executions by hour of day and day of week. Calculate success rates per time slot. Identify patterns like "failures spike on Monday mornings" or "fastest completions happen 2-4 AM". Store patterns for scheduling optimization. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 70: Implement Anomaly Detection**
Create background job running every hour that detects unusual patterns. Calculate baseline metrics (average task duration, success rate, cost per task). Flag executions deviating significantly (2+ standard deviations). Store anomalies in Anomalies table with severity and description. Alert on critical anomalies. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 71: Create Experiment Framework**
Add Experiments table storing A/B test configurations. Create POST /tasks/:taskId/assign-experimental endpoint that randomly assigns task to control or treatment group (different agents, different strategies). Track outcomes per group. Calculate statistical significance. Enable data-driven optimization decisions. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 72: Build Self-Improving Prioritization**
Create background job that evaluates prioritization algorithm performance. For completed tasks, check if they were prioritized correctly (high priority tasks completed fast, blocking tasks unblocked downstream work quickly). Adjust algorithm weights based on outcomes. Store weight adjustments history. This creates autonomous optimization. [nature](https://www.nature.com/articles/s41598-025-21709-9)

### Enterprise Features (Issues 73-80)

**Issue 73: Implement Multi-Tenancy**
Add tenant_id column to all tables. Update all queries to filter by tenant. Create Tenants table with configuration per tenant. Create tenant-scoped API keys. This enables running multiple isolated project workspaces in same database. Essential if you ever consult using this system. [slashdev](https://slashdev.io/-how-to-build-a-custom-it-project-management-tool-in-2024)

**Issue 74: Add Role-Based Access Control**
Create Users and Roles tables. Define permissions (read_tasks, create_tasks, assign_tasks, delete_tasks, admin_all). Check permissions in middleware before allowing operations. Create endpoints for user/role management. Enable team collaboration with appropriate access restrictions. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 75: Build Audit Log System**
Create AuditLog table capturing all mutations: who, what, when, old values, new values. Log task creation, updates, deletions, assignments, completions. Create GET /audit endpoint with filtering by user, date range, entity type. Essential for compliance and debugging "who changed this task's priority" questions. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 76: Implement Data Export**
Create GET /export endpoints that return CSV, JSON, or SQL dump of filtered data. Enable exporting tasks, executions, dependencies for external analysis. Add scheduled exports posted to S3 or email. Useful for backup and integration with external analytics tools. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 77: Add GraphQL API**
Supplement REST API with GraphQL endpoint at /graphql. Define schema matching database structure. Enable clients to query exactly what they need in single request. Particularly useful for complex UI needs like "get task with dependencies, executions, and metadata in one query". [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 78: Create Real-Time Subscriptions**
Implement WebSocket endpoint at /ws for real-time updates. When tasks change, push updates to subscribed clients. Enable live dashboard that updates without polling. Use for orchestrator to react immediately to task completions without checking every 30 seconds. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 79: Build Report Builder**
Create visual report builder UI where users define custom queries: "show me all tasks completed by Bifrost agent last week costing over $0.10". Store report definitions. Schedule automated report generation and delivery. Enable stakeholder visibility without writing SQL. [sapient](https://sapient.pro/blog/how-to-build-a-custom-project-management-platform)

**Issue 80: Implement Plugin System**
Define plugin interface allowing custom code execution on events (before_task_create, after_task_complete). Store plugins as JavaScript code in database. Execute in sandboxed environment. Enable extending Cairn Codex without core code changes. Example plugins: "notify Discord when high priority task fails", "auto-assign tasks matching pattern to specific agent". [slashdev](https://slashdev.io/-how-to-build-a-custom-it-project-management-tool-in-2024)

***

This gives you weekend MVP (Issues 1-48) to escape Linear's limits, then 32 advanced issues that transform Cairn Codex into the most powerful agent orchestration system you've ever seen—purpose-built for autonomous swarms, not human project managers. [slashdev](https://slashdev.io/-how-to-build-a-custom-it-project-management-tool-in-2024)

