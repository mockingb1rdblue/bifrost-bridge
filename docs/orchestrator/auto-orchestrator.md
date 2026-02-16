## Orchestration Layer: Dynamic Work Assignment System

You need a **continuous scheduling engine** that sits above the Manager and actively monitors both the work queue and worker capacity, making real-time assignment decisions based on priority algorithms, dependency graphs, and worker availability. This is a reactive system that responds to state changes—task completion, failure, new work arrival, worker capacity changes—and constantly reoptimizes assignments. [nature](https://www.nature.com/articles/s41598-025-21709-9)

## Core Orchestrator Responsibilities

### Work Queue State Management

The orchestrator maintains a live view of all available work from Linear. When webhooks fire or polling detects changes, it rebuilds the queue structure. Each task has status (ready, blocked, assigned, in-progress, completed, failed), priority score, blocking relationships (this task cannot start until task X completes), and dependency metadata (needs output from task Y). [arxiv](https://arxiv.org/html/2502.02311v1)

The orchestrator differentiates between "ready" tasks (all dependencies satisfied, nothing blocking) and "blocked" tasks (waiting on other work). It tracks the blocking graph—if task A depends on tasks B and C, then A remains blocked until both B and C complete. When B finishes, the orchestrator immediately recalculates A's status. If C also finished, A moves to ready state and becomes eligible for assignment. [ijcai](https://www.ijcai.org/proceedings/2023/30)

The queue is never static. Every completion event triggers a cascade—finishing one task might unblock five others. Every failure event triggers reassessment—if a task fails, do its dependent tasks also fail or can they proceed with partial results? The orchestrator continuously rebuilds the priority-sorted ready queue. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

### Worker Pool Management

The orchestrator tracks worker availability and capacity for each agent system. Jules might handle 5 concurrent tasks, Cursor agents limited to 1 task per human operator availability, Bifrost swarm might support 10 concurrent tasks across Sprites. Each worker has current load (how many tasks assigned), active tasks array, and estimated completion times for in-flight work. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

When a worker completes a task, the orchestrator marks that worker available and immediately checks if new work should be assigned. When a worker fails a task, the orchestrator determines whether to retry with same worker, reassign to different agent system, or escalate to manual review. Worker capacity isn't fixed—Bifrost swarm can spawn additional Sprites during high load periods, so the orchestrator queries actual capacity dynamically. [nature](https://www.nature.com/articles/s41598-025-21709-9)

The orchestrator also considers worker specialization from historical performance. If Bifrost Coder has 95% success rate on authentication tasks but only 70% on database migrations, that influences assignment decisions. A ready task might wait for the optimal worker to become available rather than assigning to suboptimal but currently idle worker. [arxiv](https://arxiv.org/html/2502.02311v1)

### Priority Algorithms: Multiple Modes

The orchestrator implements several assignment strategies that you select via configuration or Linear project labels. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

**Highest Priority First mode:** Sort ready queue by Linear priority field (Urgent > High > Medium > Low) then by issue creation date for tiebreaking. Assign top task from queue to next available optimal worker. Simple and predictable—critical work always goes first. Risk: easy tasks might wait behind difficult high-priority work that's taking hours. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

**Blocker Resolution mode:** Calculate each task's "blocking impact score"—how many other tasks are waiting on this one. A task that blocks 8 other tasks gets higher effective priority than a task blocking zero others, even if Linear priority is lower. This maximizes downstream unblocking. When task completes, recalculate all blocking impact scores since the graph changed. [ijcai](https://www.ijcai.org/proceedings/2023/30)

**Easy Wins mode:** Sort ready queue by estimated effort (from Linear estimates or historical agent completion times). Assign smallest tasks first to maximize completion velocity. This is the "attack mode" you mentioned—burn through 20 simple tasks in the time one complex task takes. Builds momentum and clears queue depth. Useful when you have many idle workers and want to show visible progress. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Balanced Hybrid mode:** Combine multiple factors into composite score. Formula: `(priorityWeight * normalizedPriority) + (blockerWeight * blockingImpactScore) + (effortWeight * (1 - normalizedEffort))`. Configurable weights let you tune behavior. Default might be 40% priority, 30% blocker impact, 30% effort consideration. This prevents any single dimension from dominating. [arxiv](https://arxiv.org/html/2502.02311v1)

**Critical Path mode:** Analyze the full dependency graph to identify the critical path—the longest sequential chain of dependencies from current state to project completion. Tasks on the critical path get maximum priority because delays there extend total project duration. Off-critical-path tasks can wait without impacting timeline. Requires graph analysis algorithm but prevents bottlenecks. [ijcai](https://www.ijcai.org/proceedings/2023/30)

You switch modes via Linear project settings or by detecting project phase. Early in sprint use Highest Priority to tackle must-haves. Mid-sprint switch to Blocker Resolution to prevent dependency pileup. Near deadline switch to Easy Wins to maximize completed ticket count. The orchestrator applies whichever algorithm is active for current project context. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

### Live Adjustment on Completion

When a worker reports task completion, the orchestrator triggers immediate reassessment. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

First, update task status to completed and record outcome metrics (duration, cost, validation result). Second, query dependency graph for tasks that were blocked by this completed task. Mark those tasks as ready if all their dependencies are now satisfied. Third, recalculate priority scores for all ready tasks since blocking impact may have changed. [arxiv](https://arxiv.org/html/2502.02311v1)

Fourth, check if the now-available worker should immediately receive new assignment. Run the active priority algorithm on updated ready queue. If the top task matches worker capabilities, assign it. If worker is suboptimal for top task, check next N tasks in queue to find good match. Balance between "always assign highest priority" versus "wait for optimal worker" based on queue depth and urgency. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

Fifth, broadcast completion event to any parallel workflows. If this was subtask 2 of 5 in a coordinated multi-agent job, update the parent task progress and check if subsequent phases can start. If this was the final subtask, mark parent complete and process its downstream dependencies. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

The orchestrator maintains a completion event log for analytics—task ID, worker, duration, timestamp. This feeds the Manager's learning system for future routing decisions. [nature](https://www.nature.com/articles/s41598-025-21709-9)

### Live Adjustment on Failure

Failure triggers more complex logic than completion. [nature](https://www.nature.com/articles/s41598-025-21709-9)

First, determine failure type. Did the worker timeout? Did validation fail? Did API errors prevent execution? Each type suggests different handling. Timeouts might retry with same worker and longer timeout. Validation failures might reassign to Bifrost Troubleshooter agent. API errors might pause all assignments to that worker until infrastructure recovers. [nature](https://www.nature.com/articles/s41598-025-21709-9)

Second, check retry policy. Task metadata includes maxRetries count. If attempts < maxRetries, orchestrator can retry immediately or after backoff delay. If retries exhausted, mark task failed and escalate. Escalation options: assign to different agent system (Jules failed so try Bifrost swarm), add to manual review queue, create Linear comment requesting human intervention. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

Third, handle dependent tasks. If task A fails and tasks B and C depend on A's output, do B and C automatically fail or go back to blocked state? This depends on dependency type. Hard dependencies propagate failure—B and C also fail. Soft dependencies keep waiting—maybe A gets retried successfully. The orchestrator traverses the dependency graph applying failure propagation rules. [ijcai](https://www.ijcai.org/proceedings/2023/30)

Fourth, reassess worker health. If a worker fails 3 tasks in 10 minutes, temporarily remove from assignment pool. Log anomaly for investigation. Route future work to healthy workers. After cooling period (15 minutes) or manual reset, restore worker to pool. This prevents cascading failures where broken worker keeps receiving assignments. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

Fifth, recalculate queue priorities with failure context. Failed tasks that are on critical path might jump to top priority for immediate retry. Tasks that failed due to environmental issues (API rate limits) might drop priority until conditions improve. The orchestrator applies failure-aware scoring. [arxiv](https://arxiv.org/html/2502.02311v1)

### Attack Mode Specification

Attack mode is an aggressive variant of Easy Wins with additional heuristics. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

The orchestrator filters for tasks labeled "quick-win" or with Linear estimates under 15 minutes. It sorts by effort ascending and assigns ALL available workers simultaneously. No waiting for optimal match—if a worker is idle and can technically handle the task, assign it. Maximize parallel throughput over individual task optimization. [nature](https://www.nature.com/articles/s41598-025-21709-9)

Attack mode also implements "greedy worker stealing". If high-effort task has been assigned to Bifrost swarm for 30 minutes, the orchestrator checks if 5 easy tasks appeared in queue during that time. It might spawn additional Sprite workers to handle the easy tasks in parallel rather than letting them queue behind the long-running task. This requires dynamic worker scaling which Fly.io Sprites support. [sciencedirect](https://www.sciencedirect.com/science/article/pii/S240589632102293X)

Attack mode disables some quality gates. Normal mode might require Validator agent review before marking complete. Attack mode trusts Coder agents and marks complete immediately after execution. This trades some quality for speed—acceptable when clearing low-risk backlog items. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

Attack mode also uses a momentum heuristic. After completing 10 tasks in 30 minutes, the orchestrator slightly lowers the effort threshold. Tasks initially estimated at 18 minutes now qualify as "easy" since the system is demonstrating high throughput. This creates a flywheel effect where success breeds more aggressive assignment. [arxiv](https://arxiv.org/html/2502.02311v1)

You activate attack mode via Linear project label "mode:attack" or time-based rule (Friday afternoons clear backlog before weekend). The orchestrator switches algorithms immediately and starts burning through ready queue with all available workers. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

### Dynamic Work Discovery

The orchestrator doesn't just wait for Linear webhooks—it actively polls for new work. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

Every 60 seconds, query Linear API for issues in "ready" state that aren't already tracked. This catches work added through bulk import, issues moved between projects, or tasks that became ready due to external dependency resolution (human completed manual step). When new work appears, integrate into queue and immediately evaluate if it should preempt current assignments. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

The orchestrator also discovers blocked work that became ready. If task X is blocked waiting on external PR review, orchestrator periodically checks GitHub API to see if PR merged. When external dependency resolves, task moves to ready state and enters assignment consideration. [ijcai](https://www.ijcai.org/proceedings/2023/30)

The orchestrator can also generate synthetic tasks based on patterns. If 5 repository updates complete but no "update monorepo dependencies" task exists, the orchestrator creates one automatically and adds to queue. This requires pattern recognition but enables true autonomous operation—the system identifies work that needs doing. [nature](https://www.nature.com/articles/s41598-025-21709-9)

### Coordination with Manager

The orchestrator and Manager have distinct responsibilities. Manager decides WHICH agent system handles each task (Jules vs Cursor vs Bifrost). Orchestrator decides WHEN to assign tasks and TO WHICH specific worker within that system. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

When orchestrator determines a task should be assigned, it calls Manager's selectBestAgent function to get routing decision. Manager returns "assign to Bifrost swarm." Orchestrator then determines which specific Bifrost Sprite worker gets the assignment based on current load balancing. Orchestrator tracks per-worker state while Manager tracks per-agent-system capabilities. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

If Manager says "manual review required," orchestrator moves task to special queue but continues processing other ready work. Orchestrator's job is maximizing throughput across the entire system—it doesn't get blocked by individual manual review tasks. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

The orchestrator also provides feedback to Manager. If priority algorithm consistently assigns work to Bifrost swarm and Jules workers sit idle, report this utilization pattern. Manager might adjust scoring to better balance load. If attack mode causes validation failure rate to spike, orchestrator signals Manager to recalibrate quality thresholds. [arxiv](https://arxiv.org/html/2502.02311v1)

### State Synchronization

The orchestrator maintains its own state separate from Manager but synchronized. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

Orchestrator state includes: ready queue (priority-sorted task IDs), blocked queue (tasks with unsatisfied dependencies), assigned work (worker ID → task ID mapping), dependency graph (task relationships), worker pool status (capacity and current load per worker), active algorithm mode, and assignment history (recent decisions for debugging). [ijcai](https://www.ijcai.org/proceedings/2023/30)

State persists in its own Durable Object (`OrchestratorDO`) with different durability requirements than Manager. Orchestrator state changes frequently (every task completion/failure) so it uses in-memory caching with periodic flush to storage. Manager state changes less frequently (routing decisions, configuration updates) so it can write-through on every change. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

The orchestrator subscribes to Manager events via event log. When Manager completes routing decision, orchestrator receives notification and updates its worker pool mapping. When Manager learns new performance characteristics, orchestrator adjusts effort estimates for future scheduling. [nature](https://www.nature.com/articles/s41598-025-21709-9)

### Implementation as Durable Object with Scheduled Events

Deploy orchestrator as Cloudflare Durable Object with alarm-based scheduling. Set recurring alarm every 30 seconds to trigger assignment cycle. Alarm handler: load state, query ready queue, check worker availability, run active priority algorithm, make assignments, update state, schedule next alarm. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

This model ensures orchestrator continuously operates even without external triggers. If webhook delivery fails or worker forgets to report completion, the alarm-based cycle detects stale state and corrects. The orchestrator is self-healing through continuous monitoring rather than reactive event processing alone. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

The Durable Object also exposes HTTP endpoints for external events. POST `/orchestrator/complete` called by workers when tasks finish. POST `/orchestrator/fail` for failure reporting. POST `/orchestrator/mode` to switch priority algorithms. GET `/orchestrator/status` returns current queue state and worker utilization. These endpoints update internal state and trigger immediate assignment recalculation without waiting for next alarm cycle. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

This architecture creates a living system—the orchestrator never stops evaluating whether current work assignments are optimal given changing queue state, worker availability, and project priorities. It continuously seeks to maximize throughput while respecting dependencies, priorities, and quality gates you've configured. [arxiv](https://arxiv.org/html/2502.02311v1)

---

## Orchestrator Layer: Thin-Sliced Linear Issues

### Foundation & State Management (Issues 1-8)

**Issue 1: Create OrchestratorDO Durable Object Stub**
Create new Cloudflare Durable Object class named OrchestratorDO in a new file. Set up basic HTTP request handler that receives POST requests and returns 200 OK status. Add the durable object binding to Wrangler configuration file. Deploy to Cloudflare and test by sending a curl POST request to verify it responds. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 2: Define Orchestrator State Schema**
Create TypeScript interface for OrchestratorState with these fields: readyQueue as array of task IDs, blockedQueue as array of task IDs, assignedWork as Map connecting worker IDs to task IDs, workerPool as Map connecting worker IDs to capacity numbers, currentMode as string, and lastUpdate as timestamp. Create function that returns empty initialized state object. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 3: Implement State Load and Save**
Create two functions for state persistence in the Durable Object. First function loads state from Durable Object storage and returns the state object, returning empty state if nothing stored yet. Second function saves state object to Durable Object storage. Call load function when Durable Object starts up. Test by saving mock state and verifying it persists across requests. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 4: Create Task Status Data Structure**
Define TypeScript interface for TaskStatus with fields: taskId, status as enum (ready, blocked, assigned, in-progress, completed, failed), priority as number one through five, estimatedEffort in minutes, assignedWorker as nullable string, startTime as nullable timestamp, dependencies as array of task IDs, and blockingCount as number. Create function that builds TaskStatus from Linear issue JSON. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 5: Build Ready Queue Manager**
Create function addToReadyQueue that accepts state object and task ID, checks if task is already in ready queue, and adds it if not present. Create function removeFromReadyQueue that accepts state object and task ID and removes it. Create function getReadyQueueTasks that returns array of all task IDs currently in ready queue. Test by adding and removing mock task IDs. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 6: Build Blocked Queue Manager**
Create function addToBlockedQueue that accepts state object, task ID, and array of blocking task IDs. Store the task in blocked queue with its blocking dependencies. Create function removeFromBlockedQueue that removes task by ID. Create function getBlockedTasks that returns array of all blocked task IDs with their dependencies. [ijcai](https://www.ijcai.org/proceedings/2023/30)

**Issue 7: Create Worker Pool Tracker**
Create function registerWorker that accepts state object, worker ID, worker type (Jules, Cursor, or Bifrost), and capacity number. Add worker to state workerPool Map with available capacity equal to max capacity. Create function getAvailableWorkers that returns array of worker IDs where current load is less than max capacity. Create function getWorkerLoad that returns how many tasks currently assigned to specific worker. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 8: Implement Assignment Tracking**
Create function assignTaskToWorker that accepts state, task ID, and worker ID. Add entry to state assignedWork Map linking worker to task. Increment worker's current load counter. Update task status to assigned. Create function unassignTask that removes task from assignedWork Map and decrements worker load. Test by assigning and unassigning mock tasks. [nature](https://www.nature.com/articles/s41598-025-21709-9)

### Dependency Graph Management (Issues 9-15)

**Issue 9: Build Dependency Graph Storage**
Create new state field dependencyGraph as Map where keys are task IDs and values are objects containing dependsOn array (tasks this one needs) and blockedBy array (tasks waiting for this one). Create function storeDependencies that accepts task ID and array of dependency task IDs and stores in graph structure. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 10: Implement Dependency Detection from Linear**
Create function extractDependencies that parses Linear issue JSON to find dependencies. Check issue relations array for "blocks" and "blocked by" relationship types. Extract related issue IDs. Return object with dependsOn array and blockedBy array. Handle cases where relations array is null or empty. [ijcai](https://www.ijcai.org/proceedings/2023/30)

**Issue 11: Create Readiness Checker**
Create function isTaskReady that accepts state, task ID, and dependency graph. Look up all dependencies for the task. Check if all dependency tasks have status completed. Return true if all dependencies satisfied or no dependencies exist, false otherwise. This determines if blocked task can move to ready. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 12: Build Blocking Impact Calculator**
Create function calculateBlockingImpact that accepts task ID and dependency graph. Count how many other tasks have this task in their dependsOn array. Return the count as blocking impact score. Higher score means completing this task unblocks more downstream work. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 13: Implement Dependency Graph Updater**
Create function updateDependencyGraph that accepts state, completed task ID. Find all tasks in dependency graph that have completed task in their dependsOn array. Remove completed task from their dependsOn arrays. For each modified task, call isTaskReady to check if it should move from blocked to ready queue. [ijcai](https://www.ijcai.org/proceedings/2023/30)

**Issue 14: Create Failure Propagation Logic**
Create function propagateFailure that accepts state, failed task ID, and failure propagation mode (hard or soft). If hard mode, find all tasks that depend on failed task and mark them as failed. If soft mode, keep dependent tasks in blocked state. Return array of affected task IDs that had status changes. [ijcai](https://www.ijcai.org/proceedings/2023/30)

**Issue 15: Build Critical Path Analyzer**
Create function findCriticalPath that accepts dependency graph and returns array of task IDs representing longest chain from current incomplete tasks to project end. For each task, calculate maximum depth by recursively following its blockedBy relationships. Tasks with highest depth are on critical path. Return sorted array of task IDs by depth descending. [arxiv](https://arxiv.org/html/2502.02311v1)

### Priority Algorithm Implementation (Issues 16-23)

**Issue 16: Create Simple Priority Sorter**
Create function sortByPriority that accepts array of task status objects and returns new array sorted by priority field descending (Urgent first, then High, Medium, Low, None). For tasks with same priority, sort by creation timestamp ascending (older first). This is the Highest Priority First algorithm. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

**Issue 17: Implement Blocker Resolution Sorter**
Create function sortByBlockerImpact that accepts array of task status objects and dependency graph. For each task, call calculateBlockingImpact to get blocking score. Sort tasks by blocking impact score descending (highest impact first). For ties, use priority as tiebreaker. Return sorted array. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 18: Create Easy Wins Sorter**
Create function sortByEffort that accepts array of task status objects and returns array sorted by estimatedEffort ascending (smallest effort first). Tasks with no effort estimate should sort to end of list. This implements Easy Wins mode for maximum velocity. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 19: Build Balanced Hybrid Scoring**
Create function calculateBalancedScore that accepts task status object, dependency graph, and weights object (priorityWeight, blockerWeight, effortWeight). Calculate three normalized scores between zero and one: priority score (map 1-5 to 0-1), blocker score (blocking impact divided by max impact in queue), effort score (one minus normalized effort). Multiply each score by its weight, sum them, return composite score. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 20: Implement Hybrid Sorter**
Create function sortByBalancedScore that accepts array of task status objects, dependency graph, and weights object. For each task call calculateBalancedScore. Sort tasks by composite score descending (highest score first). Return sorted array. This allows configurable multi-factor prioritization. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 21: Create Critical Path Sorter**
Create function sortByCriticalPath that accepts array of task status objects and dependency graph. Call findCriticalPath to get critical path task IDs. Tasks on critical path get priority boost by adding 1000 to their score. Sort by boosted scores descending. Return sorted array prioritizing critical path work. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 22: Build Algorithm Selector**
Create function selectSortingAlgorithm that accepts mode string (priority, blocker, effort, balanced, critical) and returns appropriate sorting function reference. Store current mode in orchestrator state. Create function applyCurrentAlgorithm that reads mode from state and calls corresponding sort function on ready queue. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

**Issue 23: Implement Mode Switching**
Create HTTP endpoint POST /orchestrator/mode that accepts JSON body with mode field. Validate mode is one of five valid algorithm names. Update state currentMode field. Log mode change event. Return success response with new mode. Test by switching modes and verifying next assignment cycle uses new algorithm. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

### Worker Matching and Assignment (Issues 24-31)

**Issue 24: Create Worker Capability Matcher**
Create function canWorkerHandleTask that accepts worker object (with type field) and task profile. Call Manager's constraint checking functions (julesCanHandle, cursorCanHandle, bifrostCanHandle) based on worker type. Return boolean indicating if this specific worker is capable of handling task. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 25: Implement Load Balancing Selector**
Create function selectLeastLoadedWorker that accepts array of capable worker IDs and state object. For each worker ID call getWorkerLoad to get current task count. Return worker ID with lowest current load. This spreads work evenly across available workers. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 26: Build Optimal Worker Finder**
Create function findOptimalWorker that accepts task profile and state. Query all registered workers from worker pool. Filter to workers where canWorkerHandleTask returns true. From capable workers, call selectLeastLoadedWorker to pick best candidate. Return worker ID or null if no workers available. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 27: Create Assignment Attempt Function**
Create function attemptAssignment that accepts state, task ID, and worker ID. First check if worker still has available capacity. If yes, call assignTaskToWorker to update state, then call Manager's executeAssignment to trigger actual work. Log assignment event. Return success boolean and any error message. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 28: Implement Assignment Batch Processor**
Create function processAssignmentBatch that accepts state and sorted task queue. Loop through tasks in order. For each task, call findOptimalWorker. If worker found, call attemptAssignment. Stop after processing ten tasks or when no more workers available. Return array of assigned task IDs and array of unassigned task IDs. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 29: Build Worker Availability Checker**
Create function areWorkersAvailable that accepts state and worker type filter (optional). Count workers where current load is less than max capacity. If type filter provided, only count workers of that type. Return true if any workers available, false if all at capacity. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 30: Create Worker Stealing Logic**
Create function shouldStealWorker that accepts state and high priority task. Check if all workers are busy with tasks that have been running longer than 20 minutes. Check if new task has higher priority than lowest priority currently running task. Return true if conditions met for interrupting lower priority work. [sciencedirect](https://www.sciencedirect.com/science/article/pii/S240589632102293X)

**Issue 31: Implement Priority Preemption**
Create function preemptLowPriorityTask that accepts state, high priority task, and worker ID. Call unassignTask to free the worker from current task. Move preempted task back to ready queue with increased retry count. Assign high priority task to now-available worker. Log preemption event with reasoning. [nature](https://www.nature.com/articles/s41598-025-21709-9)

### Event Handling and Live Updates (Issues 32-39)

**Issue 32: Create Completion Event Handler**
Create HTTP endpoint POST /orchestrator/complete that accepts JSON with taskId, workerId, duration, cost, and success fields. Call unassignTask to free worker. Update task status to completed. Call updateDependencyGraph to unblock dependent tasks. Log completion event. Immediately trigger assignment cycle to assign new work to freed worker. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 33: Implement Failure Event Handler**
Create HTTP endpoint POST /orchestrator/fail that accepts JSON with taskId, workerId, failureReason, and retriable fields. Call unassignTask to free worker. If retriable is true and task retries less than max (three), move task back to ready queue with incremented retry count. Otherwise move to failed state. Call propagateFailure if needed. Log failure event. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 34: Build Retry Policy Manager**
Create function determineRetryAction that accepts task status object and failure reason. Check task retry count against max retries (three attempts). If under limit, return retry action. Check failure reason - if timeout return retry with longer timeout, if validation failure return reassign to different worker type. Return recommended action object. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 35: Create Status Polling Endpoint**
Create HTTP endpoint GET /orchestrator/status that returns JSON with ready queue length, blocked queue length, assigned tasks count, available workers count, current algorithm mode, and last update timestamp. This provides real-time visibility into orchestrator state. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 36: Implement Queue Refresh Function**
Create function refreshQueueFromLinear that calls Linear API to query all issues in Ready status for configured project. Compare returned issues against current ready and blocked queues. Add any new tasks found. Remove any tasks that no longer exist. Update task priorities if changed in Linear. Return counts of added and removed tasks. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 37: Build Blocked Task Resolution Scanner**
Create function scanForUnblockedTasks that loops through blocked queue. For each blocked task, call isTaskReady to check if dependencies now satisfied. If ready, call removeFromBlockedQueue and addToReadyQueue. Keep count of how many tasks moved from blocked to ready. Log when tasks become unblocked. [ijcai](https://www.ijcai.org/proceedings/2023/30)

**Issue 38: Create Stale Assignment Detector**
Create function detectStaleAssignments that queries all tasks in assigned or in-progress status. Check elapsed time since assignment. If task has been assigned longer than expected duration plus buffer (two times estimated effort), flag as potentially stale. Return array of stale task IDs for investigation. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 39: Implement Health Check Recovery**
Create function recoverStaleAssignments that accepts array of stale task IDs from detector. For each stale task, call failure handler to unassign and potentially retry. Check worker status - if worker appears stuck, temporarily remove from worker pool. Log recovery actions taken. Return count of recovered assignments. [nature](https://www.nature.com/articles/s41598-025-21709-9)

### Attack Mode Implementation (Issues 40-45)

**Issue 40: Define Attack Mode Criteria**
Create function isAttackModeEligible that accepts task status object. Check if task has label "quick-win" or if estimatedEffort is less than 15 minutes. Return boolean indicating if task qualifies for attack mode processing. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 41: Build Attack Mode Filter**
Create function filterAttackModeTasks that accepts full ready queue array. Loop through tasks and call isAttackModeEligible on each. Return new array containing only eligible tasks sorted by effort ascending. This creates attack mode subqueue. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 42: Implement Aggressive Assignment Strategy**
Create function assignAllAvailableWorkers that accepts attack mode task queue and state. Loop through all available workers regardless of type. For each worker find first task from queue that worker can handle. Immediately assign without waiting for optimal match. Continue until no workers available or queue empty. Return count of assignments made. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 43: Create Momentum Threshold Adjuster**
Create function adjustEffortThreshold that accepts state and completion velocity (tasks per hour). If velocity exceeds target (20 per hour), increase effort threshold by 20 percent (so 15 minute cutoff becomes 18 minutes). If velocity drops below target, decrease threshold by 10 percent. Update state with new threshold. Return adjusted threshold value. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 44: Build Dynamic Worker Scaling Trigger**
Create function shouldScaleWorkers that accepts state and queue depth. If ready queue has more than 30 tasks and all workers are busy and current mode is attack, return true to trigger scaling. Check if scaling recently occurred (within last 10 minutes) to avoid thrashing. Return scaling recommendation with target worker count. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 45: Implement Attack Mode Activator**
Create function activateAttackMode that accepts state. Set state currentMode to attack. Disable quality gates by setting state requiresValidation to false. Call adjustEffortThreshold with aggressive target. Call shouldScaleWorkers to potentially spawn additional workers. Log attack mode activation with timestamp. Create deactivation function that reverses these settings. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

### Scheduled Execution and Automation (Issues 46-50)

**Issue 46: Create Assignment Cycle Orchestrator**
Create function runAssignmentCycle that is the main orchestrator loop. Load state, call scanForUnblockedTasks to move blocked tasks to ready, call applyCurrentAlgorithm to sort ready queue, call processAssignmentBatch to assign work to available workers, save state, return summary of actions taken. This is the core scheduling logic. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 47: Implement Alarm-Based Scheduling**
Add alarm handler to OrchestratorDO that triggers every 30 seconds using Durable Object alarm API. Alarm handler calls runAssignmentCycle. After cycle completes, schedule next alarm for 30 seconds later. This creates continuous autonomous operation without external triggers. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 48: Build Periodic Queue Refresh**
Modify alarm handler to call refreshQueueFromLinear every 60 seconds (every other alarm trigger). Track last refresh timestamp in state. This discovers new work from Linear without relying solely on webhooks. Increment counter for refresh cycles completed. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 49: Create Worker Health Monitor**
Create function monitorWorkerHealth that runs during assignment cycle. For each worker in pool, check failure rate in last 10 assignments using event log. If failure rate exceeds 30 percent, call function to temporarily disable worker. Check if disabled workers have cooled down (15 minutes elapsed) and re-enable them. Return array of worker status changes. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 50: Implement Metrics Collection Loop**
Create function collectMetrics that runs during alarm cycle. Calculate current throughput (tasks per hour), average task duration, worker utilization percentage, queue wait time, and cost rate. Store metrics in state metrics history array (keep last 100 readings). Expose metrics through status endpoint. Use metrics to feed Manager's learning system. [arxiv](https://arxiv.org/html/2502.02311v1)

### Integration with Manager (Issues 51-55)

**Issue 51: Create Manager Query Interface**
Create function queryManagerForRouting that accepts task profile and calls Manager's selectBestAgent endpoint. Parse Manager response to get recommended agent type (Jules, Cursor, Bifrost). Store routing recommendation in task metadata. Return agent type or null if manual review required. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 52: Build Agent-to-Worker Mapping**
Create function findWorkerForAgentType that accepts agent type from Manager and state. Query worker pool for workers matching that agent type. Apply load balancing selection among matching workers. Return specific worker ID that should handle task. This bridges Manager's system-level routing to Orchestrator's worker-level assignment. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 53: Implement Feedback to Manager**
Create function sendUtilizationFeedback that runs every 5 minutes during alarm cycle. Calculate utilization percentage per agent type (Jules workers, Cursor workers, Bifrost workers). If any type below 30 percent utilization, send feedback to Manager suggesting rebalancing. Post utilization data to Manager's feedback endpoint. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 54: Create Manual Review Queue Integration**
Create function handleManualReviewTask that accepts task marked for manual review by Manager. Move task to special manual review queue in orchestrator state. Do not assign to workers. Create Linear comment on task explaining it's awaiting manual review. Remove from automatic processing until human overrides status. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

**Issue 55: Build Override Processor**
Create HTTP endpoint POST /orchestrator/override that accepts taskId and explicit assignment instructions (specific worker ID or agent type). Bypass normal routing and assignment logic. Directly assign task to specified target. Log override event with user identifier. This allows manual intervention in orchestrator decisions. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

### Monitoring and Observability (Issues 56-60)

**Issue 56: Create Queue Depth Tracker**
Create function trackQueueDepth that runs every assignment cycle. Record current ready queue size, blocked queue size, and time-in-queue for oldest task. If queue depth exceeds threshold (50 tasks), emit alert event. Store queue depth history for trend analysis. Return queue health status object. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 57: Build Velocity Dashboard Data**
Create function calculateVelocityMetrics that analyzes completed tasks in last hour, last 4 hours, and last 24 hours. Calculate tasks per hour for each time window. Compare to target velocity (20 tasks/hour). Calculate trend direction (accelerating or decelerating). Return velocity dashboard object. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 58: Implement Bottleneck Detector**
Create function detectBottlenecks that analyzes dependency graph and current assignments. Identify tasks that are blocking many others but assigned to overloaded workers. Identify tasks on critical path experiencing delays. Return array of bottleneck warnings with suggested actions (reassign, split task, add workers). [ijcai](https://www.ijcai.org/proceedings/2023/30)

**Issue 59: Create Live Assignment Visualization Data**
Create HTTP endpoint GET /orchestrator/visualization that returns JSON formatted for real-time dashboard. Include worker states (idle, busy, overloaded) with assigned task IDs, ready queue snapshot with priorities, blocked queue with dependency counts, and in-progress tasks with elapsed time. Update every 10 seconds for live monitoring. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 60: Build Alert System for Anomalies**
Create function detectAnomalies that runs during assignment cycle. Check for warning conditions: all workers at capacity for longer than 10 minutes, failure rate exceeding 20 percent, queue depth growing faster than completion rate, any single task taking longer than 3x estimated duration. Emit alerts to Linear as comments on monitoring issue. Return array of active alerts. [nature](https://www.nature.com/articles/s41598-025-21709-9)

***

Each issue is independently implementable by an LLM with clear inputs, outputs, and testable success criteria. No issue requires understanding the entire system - just focus on the specific data transformation or state update described. Issues build naturally with later issues calling functions from earlier issues, creating composable complexity without overwhelming any single implementation step. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)