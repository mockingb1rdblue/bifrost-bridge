import chalk from 'chalk';
import ora from 'ora';
import { Command } from 'commander';
import { PerplexityClient } from '../perplexity-client';
import { PERPLEXITY_MODELS } from '../models';
import { PerplexityResponse } from '../types/perplexity';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

function getPerplexityClient(options: any): PerplexityClient {
  let apiKey = process.env.PERPLEXITY_API_KEY;
  let baseUrl = process.env.PERPLEXITY_PROXY_URL;

  if (options.direct) {
    baseUrl = 'https://api.perplexity.ai';
  } else {
    if (baseUrl && baseUrl.includes('workers.dev')) {
      apiKey = process.env.ABYSSAL_ARTIFACT;
    }
  }

  if (!apiKey) {
    throw new Error('No Perplexity API Key found.');
  }

  return new PerplexityClient(apiKey, baseUrl);
}

function displayResponse(response: PerplexityResponse) {
  console.log(chalk.bold.green('\nAnswer:'));
  console.log(response.choices[0].message.content);
  if (response.citations?.length) {
    console.log(chalk.dim('\nSources:'));
    response.citations.forEach((c, i) => console.log(chalk.dim(`[${i + 1}] ${c}`)));
  }
}

/**
 *
 */
export function registerPerplexityCommands(program: Command) {
  program
    .command('ask')
    .description('Quickly ask a question')
    .argument('<query>', 'The question to ask')
    .action(async (query: string) => {
      const spinner = ora('Thinking...').start();
      try {
        const client = getPerplexityClient(program.opts());
        const response = await client.chat([{ role: 'user', content: query }], {
          model: PERPLEXITY_MODELS.SONAR,
        });
        spinner.succeed('Complete');
        displayResponse(response);
      } catch (error) {
        spinner.fail(`Error: ${(error as Error).message}`);
        process.exit(1);
      }
    });

  program
    .command('research')
    .description('Deep research with reasoning')
    .argument('<query>', 'The research topic')
    .action(async (query: string) => {
      const spinner = ora('Reasoning...').start();
      try {
        const client = getPerplexityClient(program.opts());
        const response = await client.research(query);
        spinner.succeed('Research Complete');
        displayResponse(response);
      } catch (error) {
        spinner.fail(`Error: ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
