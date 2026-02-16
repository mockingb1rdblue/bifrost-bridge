## Orchestrator Manager Architecture: Multi-Mode Task Assignment

You need a **meta-orchestrator layer** that sits above your existing execution systems (Jules, Cursor agents, custom Bifrost swarm) and makes intelligent routing decisions based on task characteristics, agent capabilities, and strategic preferences. This is a hybrid hierarchical architecture where the manager evaluates options but doesn't execute—it delegates to whichever system is optimal for each specific task. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

## Core Manager Responsibilities

### Task Analysis & Classification

When Linear issues arrive via webhook or manual trigger, the manager performs upfront analysis before assignment. It examines task metadata including issue description, labels, estimated complexity, required file scope, dependencies on other tasks, and time sensitivity. This creates a capability profile—what skills does this task need and what constraints exist. [nature](https://www.nature.com/articles/s41598-025-21709-9)

For example, a task labeled "refactor authentication across three repos" requires cross-repository awareness, architectural thinking, and coordinated changes. A task labeled "fix failing unit test in payment service" needs deep file context but narrow scope. The manager builds this profile before considering routing options. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

### Agent Capability Modeling

The manager maintains a capability matrix for each available execution system. This isn't static configuration—it learns from historical performance tracked in your `bifrost-events` log. [arxiv](https://arxiv.org/html/2502.02311v1)

**Jules agent profile:** Excels at atomic file operations with clear diffs. Works within single repository contexts. Fast turnaround for focused changes. Struggles with architectural decisions spanning multiple services. Cost-effective for routine modifications. Requires Linear integration already configured. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Cursor agents profile:** Strong at exploratory coding with IDE context. Good for greenfield features where the path isn't clear upfront. Handles ambiguity better than Jules. Higher latency because of interactive chat model. Best when developer can provide real-time guidance or clarification. Requires local environment access. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Bifrost custom swarm profile:** Specialized agents (Architect, Coder, Validator, Troubleshooter) operate autonomously without human intervention. Architect plans multi-step work. Coder implements across repositories using Persistent Sprites with warm context. Validator ensures quality gates. Troubleshooter handles failures. Highest autonomy but most complex orchestration overhead. Optimal for large tasks where $0.05/task cost justifies coordination complexity. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

The manager also tracks performance metrics per system: average completion time, success rate, token cost, human intervention frequency, and validation pass rate. Over time it learns "Jules completes simple bug fixes in 8 minutes with 92% success rate" versus "Bifrost swarm handles architecture changes in 45 minutes with 85% success rate but zero human involvement." [arxiv](https://arxiv.org/html/2502.02311v1)

### Decision Logic: Hybrid Routing Strategy

The manager implements a **two-phase decision process** with fallback hierarchy. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

**Phase 1: Constraint filtering.** Eliminate options that can't handle the task. If the task requires cross-repository changes and Jules only operates in single repos, remove Jules from consideration. If Cursor agents require local environment but corporate network blocks necessary tools, remove Cursor. If the task is marked "urgent" and Bifrost swarm has 30-minute average latency, deprioritize it. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

**Phase 2: Optimization scoring.** For remaining viable options, calculate a weighted score across multiple dimensions. Cost efficiency matters—Jules at $0.02/task versus Bifrost swarm at $0.05/task. Speed matters—can this wait 45 minutes or needs completion in 10 minutes. Autonomy matters—if you're unavailable for next 8 hours, systems requiring human intervention score lower. Quality matters—validation pass rate from historical data. Learning value matters—new task types might route to Bifrost swarm specifically to build capability. [sciencedirect](https://www.sciencedirect.com/science/article/pii/S240589632102293X)

The scoring formula is configurable via Linear labels or project settings. A project labeled "cost:critical" weighs cost 3x more than speed. A project labeled "experimental" weighs learning value highest. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

### Multi-Agent Parallel Execution

The manager can also split tasks or assign them to multiple systems simultaneously for different purposes. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

A complex architectural change might route to both Bifrost Architect (for planning) and Cursor agent (for interactive validation with human). The Architect generates a multi-step implementation plan, Cursor agent discusses it with you to refine edge cases, then Bifrost Coder swarm executes the agreed plan. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

A critical bug fix might route to Jules for fast initial attempt while simultaneously routing to Bifrost Troubleshooter as backup. If Jules completes successfully within 15 minutes, cancel the Troubleshooter job. If Jules fails or times out, Troubleshooter takes over with fuller context including what Jules tried. [arxiv](https://arxiv.org/html/2502.02311v1)

A refactoring task across 12 files might split into atomic chunks where Jules handles 8 simple files (function renames, import updates) while Bifrost Coder handles 4 complex files requiring architectural understanding. The manager coordinates completion—merge Jules changes first, then Bifrost changes that depend on them. [nature](https://www.nature.com/articles/s41598-025-21709-9)

### Configuration Override System

You need manual override capability at multiple levels. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

**Global defaults:** Set project-level preferences in Linear metadata. "This project always uses Bifrost swarm unless task is labeled 'jules:preferred'." Default routing logic applies when no specific override exists.

**Task-specific overrides:** Linear labels provide explicit routing instructions. Label a task "cursor:required" and manager routes to Cursor regardless of scoring. Label "swarm:only" to exclude Jules and Cursor. Label "any" to let manager choose freely. Label "none" to hold task in queue without assignment—manual review required. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

**Hybrid mode specifications:** Labels like "architect:bifrost,coder:jules" tell manager to use Bifrost Architect for planning phase but Jules agents for execution. Manager coordinates handoff between systems. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Temporal overrides:** Schedule-based routing where weekend tasks route to fully autonomous Bifrost swarm but weekday tasks can use Cursor agents with your interactive guidance. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

The override hierarchy flows: explicit task labels beat project defaults beat global configuration beat manager's autonomous optimization. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

### None/Manual Mode

When you want complete control, tasks labeled "manual:review" or "none" enter a holding queue. The manager still performs analysis and capability matching but doesn't execute routing. Instead it presents recommendations in Linear comments: "This task matches Bifrost swarm profile (cross-repo, architectural) with 78% confidence. Estimated cost $0.08, completion time 40min. Alternative: Split into 3 Jules tasks at $0.06 total, 25min sequential." You manually trigger assignment after review. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

This mode is critical during system tuning. Run 20 tasks through manual review, compare manager recommendations against actual outcomes, adjust scoring weights, then enable autonomous mode. [nature](https://www.nature.com/articles/s41598-025-21709-9)

### Feedback Loop & Continuous Learning

The manager monitors execution outcomes and updates its models. When a task completes, it records actual cost, actual duration, whether validation passed, whether human intervention was needed, and compares against predicted values. High variance signals the model needs tuning. [nature](https://www.nature.com/articles/s41598-025-21709-9)

If Jules attempts are failing 40% of the time on a specific task pattern (e.g., "update dependencies across monorepo"), the manager learns to route those to Bifrost swarm instead. If Cursor agent tasks are consistently completing faster than estimated, update latency model. [nature](https://www.nature.com/articles/s41598-025-21709-9)

The manager can also trigger self-improvement tasks. If it identifies a task type where no existing system performs well, it creates a Linear issue: "Build new specialist agent for database migration tasks—current systems show 60% success rate but pattern appears frequently." Your Bifrost Architect agent eventually picks this up and implements the new capability. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

## Manager Implementation as Durable Object

Deploy the manager as a Cloudflare Durable Object (`ManagerDO`) sitting alongside your existing `RouterDO`. When Linear webhooks fire, they hit the manager first. The manager performs analysis, makes routing decision, then invokes appropriate downstream system—either proxies request to Jules/Cursor APIs or spawns Bifrost swarm orchestration via your existing `custom-router`. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

The manager maintains state including historical performance data, current queue of pending tasks, active task assignments per system (to avoid overload), and configuration overrides per project. Because it's a Durable Object, this state persists and remains consistent even under high webhook volume. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

## Routing Decision Tree Example

**Task arrives:** "Implement rate limiting middleware for API gateway [Priority: High] [Scope: 3 files] [Repos: api-service, shared-middleware]"

**Manager analysis:** Cross-repository (2 repos), medium complexity, architectural component, high priority suggests speed matters, 3 files suggests focused scope not sprawling refactor.

**Constraint filter:** Jules excluded (cross-repo). Cursor viable if local environment available. Bifrost swarm viable always.

**Optimization scoring:** Cursor scores 0.65 (fast if you're available for 30min session, but requires interaction). Bifrost swarm scores 0.82 (autonomous, handles cross-repo, Architect can design pattern then Coder implements, predicted 35min completion, $0.06 cost).

**Decision:** Route to Bifrost swarm. Spawn Architect agent for middleware design, then Coder for implementation across both repos.

**Execution:** Manager updates Linear issue with comment "Assigned to Bifrost Swarm (Architect → Coder pipeline). Estimated completion: 35min, cost: $0.06." Triggers orchestration. Monitors progress via `bifrost-events` log.

**Outcome:** Task completes in 38 minutes at $0.07 cost. Validation passes. Manager records: prediction accuracy 92% (time), 86% (cost). Updates Bifrost swarm capability model with confirmed cross-repo performance. [arxiv](https://arxiv.org/html/2502.02311v1)

This architecture gives you full flexibility—autopilot when desired, manual control when needed, and hybrid modes for complex scenarios where different systems handle different phases. The manager becomes smarter over time through your Multi-Armed Bandit learning already planned in Bifrost v3, continuously optimizing which system handles which work.

---

## Manager Architecture: Thin-Sliced Linear Issues

### Foundation Layer (Issues 1-5)

**Issue 1: Create ManagerDO Durable Object Stub**
Create new Cloudflare Durable Object class `ManagerDO` in `src/manager/ManagerDO.ts`. Implement basic HTTP handler that receives webhook payload and returns 200 OK. Deploy to Cloudflare Workers. Add Wrangler config for durable object binding. Test with curl POST request containing mock Linear webhook JSON. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 2: Build Task Metadata Parser**
Create function `parseTaskMetadata(linearIssue)` that extracts relevant fields from Linear webhook payload. Return structured object with issue ID, title, description, labels array, priority, project ID, and estimate. Handle null/undefined fields safely. Write unit tests for 5 different Linear webhook examples. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 3: Create Capability Profile Data Structure**
Define TypeScript interface `TaskProfile` with fields: requiredRepositories (string array), estimatedComplexity (1-10 scale), fileScope (number), isArchitectural (boolean), requiresHumanInput (boolean), timeConstraint (urgent/normal/flexible). Create function `buildTaskProfile(metadata)` that converts parsed Linear metadata into TaskProfile. No routing logic yet—just data structure. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 4: Store Agent System Configurations**
Create JSON configuration file `agent-systems.json` with three entries: Jules, Cursor, BifrostSwarm. Each entry has name, baseURL (API endpoint), capabilities object (supportsMultiRepo boolean, averageLatency seconds, costPerTask dollars), and enabled boolean. Create function `loadAgentSystems()` that reads this file and validates structure. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 5: Implement Basic Event Logging**
Create function `logManagerEvent(eventType, taskId, data)` that appends to `bifrost-events` SQLite table with new event types: TASK_RECEIVED, ROUTING_DECISION, ASSIGNMENT_COMPLETED. Include timestamp, manager version, and JSON blob for additional data. Test by manually calling function with mock events. [nature](https://www.nature.com/articles/s41598-025-21709-9)

### Constraint Filtering (Issues 6-10)

**Issue 6: Build Multi-Repo Detection**
Create function `requiresMultiRepo(taskProfile)` that returns boolean. Check if taskProfile.requiredRepositories array length > 1 OR if issue description contains keywords "across repos", "multiple services", "monorepo wide". Return true if multi-repo detected, false otherwise. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

**Issue 7: Create Agent Constraint Checker for Jules**
Create function `julesCanHandle(taskProfile, julesConfig)` that returns {canHandle: boolean, reason: string}. Check if task requires multi-repo (Jules can't handle). Check if julesConfig.enabled is false. Return object with canHandle false and explanatory reason if constraints violated, otherwise true with empty reason. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 8: Create Agent Constraint Checker for Cursor**
Create function `cursorCanHandle(taskProfile, cursorConfig)` that returns {canHandle: boolean, reason: string}. Check if taskProfile.requiresHumanInput is true but current time is outside business hours (use simple hour check). Check if cursorConfig.enabled is false. Return constraint violation reasons. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 9: Create Agent Constraint Checker for Bifrost**
Create function `bifrostCanHandle(taskProfile, bifrostConfig)` that returns {canHandle: boolean, reason: string}. Bifrost has no hard constraints but check if bifrostConfig.enabled is false. Check if task is labeled "bifrost:exclude". Return appropriate boolean and reason. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 10: Implement Filtering Pipeline**
Create function `filterViableAgents(taskProfile, allAgentSystems)` that calls all constraint checker functions (julesCanHandle, cursorCanHandle, bifrostCanHandle). Return array of viable agent system names and array of filtered-out systems with rejection reasons. Log filtering results via logManagerEvent. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

### Scoring System (Issues 11-15)

**Issue 11: Define Scoring Weights Configuration**
Create JSON schema for `scoring-weights.json` with fields: costWeight (default 1.0), speedWeight (default 1.0), autonomyWeight (default 1.0), qualityWeight (default 1.0). Create function `loadScoringWeights(projectId)` that returns default weights object. Later issues will implement per-project overrides. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 12: Implement Cost Score Calculator**
Create function `calculateCostScore(agentSystem, taskProfile)` that returns score 0.0-1.0. Lower cost = higher score. Use formula: `1 - (agentSystem.costPerTask / maxCost)` where maxCost is 0.10. If task has label "cost:critical" multiply weight by 3. Return normalized score. [sciencedirect](https://www.sciencedirect.com/science/article/pii/S240589632102293X)

**Issue 13: Implement Speed Score Calculator**
Create function `calculateSpeedScore(agentSystem, taskProfile)` that returns score 0.0-1.0. Lower latency = higher score. Use formula: `1 - (agentSystem.averageLatency / maxLatency)` where maxLatency is 3600 seconds. If taskProfile.timeConstraint is "urgent" multiply weight by 2. Return normalized score. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 14: Implement Autonomy Score Calculator**
Create function `calculateAutonomyScore(agentSystem, taskProfile)` that returns score 0.0-1.0. Check if agentSystem.capabilities.requiresHumanInteraction is false and taskProfile.requiresHumanInput is false—return 1.0. If mismatch return 0.5. If both true return 0.3. Later issues will add time-of-day awareness. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 15: Build Composite Score Aggregator**
Create function `calculateOverallScore(agentSystem, taskProfile, weights)` that calls all score calculators (cost, speed, autonomy). Multiply each score by corresponding weight. Sum weighted scores and divide by sum of weights. Return single number 0.0-1.0. Include score breakdown object for debugging. [arxiv](https://arxiv.org/html/2502.02311v1)

### Routing Decision (Issues 16-20)

**Issue 16: Implement Simple Router Logic**
Create function `selectBestAgent(viableAgents, taskProfile, weights)` that calculates overall score for each viable agent using calculateOverallScore. Sort agents by score descending. Return object with selectedAgent name, score, and array of all agents with scores. Log decision via logManagerEvent with ROUTING_DECISION event type. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 17: Add Label-Based Override Detection**
Create function `detectLabelOverride(labels)` that checks Linear issue labels array for routing directives. Return object with hasOverride boolean and targetAgent string. Recognize labels: "jules:required", "cursor:required", "swarm:only", "bifrost:only", "manual:review". Return null targetAgent if "manual:review" detected. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

**Issue 18: Integrate Override into Router**
Modify selectBestAgent function to accept optional overrideResult parameter. If override detected and targetAgent is in viableAgents array, return that agent immediately with score 1.0 and reason "label override". If targetAgent not viable, return error object. If override is "manual:review" return null agent with NEEDS_MANUAL_REVIEW status. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

**Issue 19: Create Assignment Payload Builder**
Create function `buildAssignmentPayload(agent, taskProfile, linearIssue)` that constructs API request payload for selected agent system. For Jules: include issue URL and file paths. For Cursor: include repository and branch. For Bifrost: include full Linear issue JSON. Return agent-specific formatted object. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 20: Implement Basic Assignment Executor**
Create function `executeAssignment(selectedAgent, payload)` that makes HTTP POST request to agent system's baseURL with assignment payload. Use fetch API. Add Authorization header from environment variable for each agent. Return response status and any error messages. Log assignment via logManagerEvent with ASSIGNMENT_COMPLETED type. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

### State Management (Issues 21-25)

**Issue 21: Create Manager State Schema**
Define TypeScript interface `ManagerState` with fields: activeAssignments (Map of taskId to agent name), historicalPerformance (Map of agent name to metrics object), pendingManualReview (array of task IDs), configOverrides (Map of project ID to weights object). Create function `initializeState()` that returns empty state object. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 22: Implement State Persistence in DurableObject**
Modify ManagerDO class to store state object in Durable Object storage. Implement `saveState(state)` and `loadState()` methods using `this.state.storage.put/get`. Call loadState in constructor to restore state on manager startup. Save state after every routing decision. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 23: Add Active Assignment Tracking**
Create function `trackAssignment(state, taskId, agentName, timestamp)` that adds entry to state.activeAssignments Map. Create function `completeAssignment(state, taskId, outcome)` that removes from activeAssignments and updates historicalPerformance. Outcome includes actualCost, actualDuration, success boolean. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 24: Build Performance Metrics Aggregator**
Create function `updatePerformanceMetrics(state, agentName, outcome)` that retrieves agent's historical metrics from state, calculates running averages for cost, duration, and success rate. Store updated metrics back to state.historicalPerformance. Use simple cumulative moving average formula. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 25: Implement Queue for Manual Review**
Create function `addToManualQueue(state, taskId, recommendations)` that appends task to state.pendingManualReview array with manager's routing recommendations included. Create function `getManualQueueTasks(state)` that returns array. Create function `manuallyAssignTask(state, taskId, agentName)` that removes from queue and triggers assignment. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

### Linear Integration (Issues 26-30)

**Issue 26: Create Linear Comment Poster**
Create function `postLinearComment(issueId, commentText)` that uses Linear API to add comment to issue. Use Linear API key from environment variable. Include basic error handling. Test with manual function call posting "Test comment from Manager" to a real Linear issue. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 27: Add Assignment Notification Comments**
Modify executeAssignment function to call postLinearComment after successful assignment. Comment should include: "Assigned to [AgentName]. Estimated completion: [time] minutes, cost: $[amount]." Extract time and cost estimates from agent configuration. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 28: Implement Recommendation Comments**
Create function `postRecommendationComment(issueId, recommendations)` that formats routing analysis into readable Linear comment. Include viable agents, scores, selected agent with reasoning, and filtered-out agents with rejection reasons. Call this for tasks in manual review queue. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

**Issue 29: Create Webhook Handler Endpoint**
Modify ManagerDO HTTP handler to detect Linear webhook signature in headers. Parse webhook body to extract issue data and action type (created, updated, labeled). Call parseTaskMetadata and initiate routing pipeline. Return 200 OK immediately to Linear, process assignment asynchronously. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 30: Add Issue Update Listener**
Extend webhook handler to detect when issue moves from manual review queue to ready state. Check if issue ID is in state.pendingManualReview and has new label "assign:jules" or "assign:cursor" or "assign:bifrost". Trigger manuallyAssignTask function with specified agent. Remove manual override label after assignment. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

### Multi-Agent Orchestration (Issues 31-35)

**Issue 31: Define Split Task Schema**
Create TypeScript interface `SplitTaskConfig` with fields: parentTaskId, subtasks array (each with agentName, description, fileScope), executionMode (parallel or sequential), dependencyGraph (which subtask IDs must complete before others). Create function `parseSplitConfig(taskProfile)` that returns null for non-split tasks. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 32: Implement Parallel Assignment**
Create function `executeParallelAssignment(splitConfig)` that loops through splitConfig.subtasks and calls executeAssignment for each simultaneously using Promise.all. Track all assignments in state.activeAssignments with shared parentTaskId reference. Return array of assignment results. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 33: Implement Sequential Assignment**
Create function `executeSequentialAssignment(splitConfig)` that loops through subtasks and awaits each executeAssignment before starting next. Check dependencyGraph to determine order. If subtask fails, halt sequence and log failure. Track progress in state with sequence position. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 34: Add Backup Agent Logic**
Create function `assignWithBackup(primaryAgent, backupAgent, taskProfile, timeoutMinutes)` that assigns to primary agent and starts timeout timer. If primary completes before timeout, cancel backup. If timeout expires without completion, assign to backup agent. Store both assignments with PRIMARY and BACKUP tags in state. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 35: Build Coordination Status Reporter**
Create function `getCoordinationStatus(parentTaskId)` that queries state.activeAssignments for all subtasks sharing parentTaskId. Return object with completion percentage, which agents are working, which subtasks completed, and estimated remaining time. Post status updates to Linear as comments every 15 minutes for multi-agent tasks. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

### Learning & Optimization (Issues 36-40)

**Issue 36: Create Prediction Accuracy Tracker**
Create function `recordPrediction(taskId, agentName, predictedCost, predictedDuration)` that stores prediction in state before assignment. Create function `calculatePredictionError(taskId, actualCost, actualDuration)` that retrieves prediction and calculates percentage error. Log errors via logManagerEvent. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 37: Implement Simple Model Tuning**
Create function `tuneAgentConfig(agentName, recentOutcomes)` that analyzes last 20 completed tasks for agent. Calculate actual average cost and duration. If variance from agent config exceeds 20%, update agentConfig.averageLatency and agentConfig.costPerTask to actual averages. Save updated config to storage. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 38: Add Pattern Recognition for Failure**
Create function `detectFailurePattern(agentName, taskType)` that queries historical performance for specific agent and task type combination (extract type from labels like "bug", "feature", "refactor"). If success rate below 60% across last 10 tasks, return warning. Log pattern detection events. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 39: Build Self-Improvement Task Generator**
Create function `generateImprovementTask(pattern)` that takes failure pattern from detectFailurePattern and constructs Linear issue creation payload. Issue title: "Improve [AgentName] capability for [TaskType]". Description includes failure statistics and recommendation. Post to Linear "Bifrost v3" project with "swarm:autonomous" label. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 40: Implement MAB Exploration Mode**
Create function `shouldExplore(taskProfile)` that returns boolean based on epsilon-greedy algorithm. 10% of tasks should explore (assign to non-optimal agent for learning). Tag exploration assignments in state. After completion, compare outcome to predicted optimal agent to validate or update scoring model. [arxiv](https://arxiv.org/html/2502.02311v1)

### Configuration & Overrides (Issues 41-45)

**Issue 41: Add Project-Level Config Storage**
Create function `saveProjectConfig(projectId, configObject)` that stores project-specific settings (scoring weights, default agent, excluded agents) to Durable Object storage with projectId as key. Create function `loadProjectConfig(projectId)` that retrieves or returns global defaults if none exist. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

**Issue 42: Implement Global Defaults Endpoint**
Add HTTP endpoint `/manager/config` to ManagerDO that accepts GET request returning current global defaults, POST request accepting new defaults JSON to update. Require admin API key in header. Store updated defaults in Durable Object storage under "GLOBAL_CONFIG" key. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

**Issue 43: Build Label-Based Weight Override**
Modify loadScoringWeights function to check taskProfile.labels for special labels like "cost:critical" (multiply costWeight by 3), "speed:critical" (multiply speedWeight by 3), "autonomous:required" (multiply autonomyWeight by 5). Return modified weights object specific to this task. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 44: Add Time-Based Routing Rules**
Create function `getTimeBasedRules(projectId)` that returns routing configuration based on current time. Example: weekends route to Bifrost only, weekdays 9am-5pm allow all agents, weeknights 6pm-9am prioritize autonomous. Store time rules in project config. Apply rules during constraint filtering phase. [support.regal](https://support.regal.ai/hc/en-us/articles/12181758397723-How-to-Configure-Task-Routing-Rules)

**Issue 45: Implement Hybrid Mode Label Parser**
Create function `parseHybridMode(labels)` that detects labels like "architect:bifrost,coder:jules" and returns structured object mapping task phases to specific agents. Modify routing logic to check for hybrid mode first, then call selectBestAgent only for phases without explicit assignment. Build split task config from hybrid specification. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

### Monitoring & Observability (Issues 46-50)

**Issue 46: Create Manager Dashboard Endpoint**
Add HTTP endpoint `/manager/status` to ManagerDO that returns JSON with current queue sizes (active assignments, manual review queue), agent utilization percentages, average task latency per agent, and cost totals. No authentication required—read-only public endpoint. [videosdk](https://videosdk.live/developer-hub/ai_agent/agent-orchestration)

**Issue 47: Build Performance Comparison Report**
Create function `generatePerformanceReport(timeRangeHours)` that queries bifrost-events log for completed tasks in time range. Group by agent name. Calculate metrics: total tasks, success rate, average cost, average duration, total cost. Return comparison table object. Add endpoint `/manager/report` that calls this function. [arxiv](https://arxiv.org/html/2502.02311v1)

**Issue 48: Implement Alert System for Anomalies**
Create function `detectAnomalies(state)` that checks for warning conditions: any agent with success rate below 70% in last hour, queue depth exceeding 20 tasks, any single task active for over 2 hours. Return array of alert objects with severity and description. Log alerts via logManagerEvent. [nature](https://www.nature.com/articles/s41598-025-21709-9)

**Issue 49: Add Linear Status Badge Updates**
Create function `updateIssueStatus(issueId, statusText)` that uses Linear API to update issue's custom field (create custom field "AgentStatus" first). Status values: "Analyzing", "Assigned:[AgentName]", "In Progress", "Validating", "Completed". Call this function at each pipeline stage to provide real-time visibility. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)

**Issue 50: Build Cost Projection Calculator**
Create function `projectMonthlyCost(state)` that analyzes current task velocity (tasks per day) and average cost per task. Extrapolate to 30-day projection. Add cost breakdown by agent system. Return projection object. Add to `/manager/status` endpoint output. Include comparison to target budget if configured. [nature](https://www.nature.com/articles/s41598-025-21709-9)

***

Each issue is independently codeable by an LLM with clear inputs, outputs, and testable success criteria. Issues build on previous work but don't require understanding the whole system. An agent can complete Issues 1-5 without knowing anything about scoring logic, then another agent handles Issues 11-15 without touching routing code. [agenticthinking](https://agenticthinking.ai/blog/smart-routing/)