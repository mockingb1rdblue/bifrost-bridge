import { Job, RouterState, SluaghSwarmTask, EngineeringLog, Env } from './types';
import { LLMRouter, RoutingRequest } from './llm/router';
import { LLMResponse } from './llm/types';
import { RouterConfig, buildRouterConfig } from './router/config';
import { RouterDependencies, buildRouterDependencies } from './router/dependencies';
import { RouterStateManager } from './router/state';
import { RouterJobProcessor } from './router/processor';
import { RouterLLMManager } from './router/llm';
import { RouterHandler } from './router/handlers';

/**
 * RouterDO: The central entry point for the Bifrost Bridge swarm.
 * 
 * Responsibilities:
 * 1. Durable Object lifecycle management (constructor, initialization).
 * 2. Alarm handling (heartbeat maintenance).
 * 3. Request delegation to RouterHandler.
 */
export class RouterDO {
  private state: DurableObjectState;
  private env: Env;
  private config: RouterConfig;
  private deps: RouterDependencies;
  private stateManager: RouterStateManager;
  private processor: RouterJobProcessor;
  private llmManager: RouterLLMManager;
  private handler: RouterHandler;

  /**
   * Initializes the Durable Object with its dependencies and state managers.
   */
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    // 1. Centralized config and dependencies
    this.config = buildRouterConfig(env);
    this.deps = buildRouterDependencies(this.config);

    // 2. State management
    this.stateManager = new RouterStateManager(state);
    this.state.blockConcurrencyWhile(async () => {
      await this.stateManager.initialize();
    });

    // 3. Specialized managers
    this.processor = new RouterJobProcessor(
      this.config,
      this.deps,
      this.stateManager,
      (params) => this.llmManager.routeLLM(params)
    );

    this.llmManager = new RouterLLMManager(
      this.deps.llmRouter,
      this.deps.events,
      this.stateManager
    );

    // 4. Request handler
    this.handler = new RouterHandler(
      this.config,
      this.deps,
      this.stateManager,
      this.processor,
      this.llmManager
    );

    // Set heartbeat alarm (10s)
    this.state.storage.setAlarm(Date.now() + 10000);
  }

  /**
   * Heartbeat handler: Runs background maintenance and task sync.
   */
  async alarm() {
    console.log('[RouterDO] Heartbeat: Running maintenance and sync...');
    try {
      await this.processor.syncLinearTasks();
      await this.processor.processBatch();
      await this.processor.triggerMaintenance();
    } catch (e: any) {
      console.error('[RouterDO] Alarm failed:', e.message);
    }
  }

  /**
   * Main entry point for all HTTP requests to this Durable Object.
   * Delegates to RouterHandler for routing and execution.
   */
  async fetch(request: Request): Promise<Response> {
    return await this.handler.handleFetch(request);
  }
}

