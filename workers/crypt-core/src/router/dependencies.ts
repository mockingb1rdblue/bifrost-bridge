import { LLMRouter } from '../llm/router';
import { LLMConfig } from '../llm/factory';
import { LinearClient } from '../linear';
import { GitHubClient } from '../github';
import { FlyClient } from '../fly';
import { EventStoreClient } from '../events';
import { RouterConfig } from './config';

export interface RouterDependencies {
  llmRouter: LLMRouter;
  linear: LinearClient;
  github: GitHubClient;
  fly: FlyClient;
  events: EventStoreClient;
}

export function buildRouterDependencies(config: RouterConfig): RouterDependencies {
  const llmConfig: LLMConfig = {
    anthropicKey: config.llm.anthropicKey,
    geminiKey: config.llm.geminiKey,
    perplexityKey: config.llm.perplexityKey,
    deepseekKey: config.llm.deepseekKey,
    anthropicBaseUrl: config.llm.baseUrl,
    deepseekBaseUrl: config.llm.baseUrl,
    geminiBaseUrl: config.llm.baseUrl,
  };

  return {
    llmRouter: new LLMRouter(llmConfig),
    linear: new LinearClient({
      apiKey: config.linear.apiKey,
      teamId: config.linear.teamId,
    }),
    github: new GitHubClient({
      appId: config.github.appId,
      privateKey: config.github.privateKey,
      installationId: config.github.installationId,
    }),
    fly: new FlyClient({
      token: config.fly.token,
      appName: config.fly.appName,
    }),
    events: new EventStoreClient({
      secret: config.events.secret,
      baseUrl: config.events.url,
    }),
  };
}
