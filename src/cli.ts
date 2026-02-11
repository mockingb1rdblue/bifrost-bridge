#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { PerplexityClient } from './perplexity-client';
import { PERPLEXITY_MODELS } from './models';
import { PerplexityResponse, ValidationError, NetworkError, TimeoutError, AuthenticationError } from './types/perplexity';
import { logger } from './utils/logger';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from root
dotenv.config({ path: path.join(__dirname, '../.env') });

// Constants
const MAX_QUERY_LENGTH = 5000;
const MIN_QUERY_LENGTH = 3;

const program = new Command();

// Helper to get client with validation
function getClient(): PerplexityClient {
    let apiKey = process.env.PERPLEXITY_API_KEY;
    const baseUrl = process.env.PERPLEXITY_BASE_URL;

    // Smart Key Logic: if using proxy, use PROXY_API_KEY
    if (baseUrl && baseUrl.includes('workers.dev')) {
        apiKey = process.env.PROXY_API_KEY;
    }

    if (!apiKey) {
        console.error(chalk.red('Error:'), 'No API Key found. Check your .env file.');
        console.error(chalk.dim('Required: PERPLEXITY_API_KEY or PROXY_API_KEY'));
        process.exit(2); // System error
    }

    try {
        return new PerplexityClient(apiKey, baseUrl);
    } catch (error) {
        console.error(chalk.red('Error:'), 'Failed to initialize client:', (error as Error).message);
        process.exit(2);
    }
}

/**
 * Validate query input
 */
function validateQuery(query: string): void {
    if (!query || query.trim().length < MIN_QUERY_LENGTH) {
        console.error(chalk.red('Error:'), `Query must be at least ${MIN_QUERY_LENGTH} characters`);
        process.exit(1); // User error
    }

    if (query.length > MAX_QUERY_LENGTH) {
        console.error(chalk.red('Error:'), `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters`);
        process.exit(1);
    }
}

/**
 * Handle errors with user-friendly messages
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function handleError(error: Error, spinner?: any): void {
    if (spinner) {
        spinner.fail('Request failed');
    }

    if (error instanceof ValidationError) {
        console.error(chalk.red('Validation Error:'), error.message);
        process.exit(1);
    } else if (error instanceof AuthenticationError) {
        console.error(chalk.red('Authentication Error:'), 'Invalid API key');
        console.error(chalk.dim('Check your .env file and ensure keys are correct'));
        process.exit(2);
    } else if (error instanceof NetworkError) {
        console.error(chalk.red('Network Error:'), 'Could not connect to API');
        console.error(chalk.dim('Check your internet connection and proxy settings'));
        process.exit(2);
    } else if (error instanceof TimeoutError) {
        console.error(chalk.red('Timeout Error:'), 'Request took too long');
        console.error(chalk.dim('Try again or use a simpler query'));
        process.exit(2);
    } else {
        console.error(chalk.red('Unexpected Error:'), error.message);
        logger.error('CLI error', error);
        process.exit(2);
    }
}

/**
 * Display response with citations
 */
function displayResponse(response: PerplexityResponse): void {
    console.log(chalk.bold.green('\nAnswer:'));
    console.log(response.choices[0].message.content);

    // Citations
    if (response.citations && response.citations.length > 0) {
        console.log(chalk.dim('\nSources:'));
        response.citations.forEach((c, i) => console.log(chalk.dim(`[${i + 1}] ${c}`)));
    }

    // Usage stats
    if (response.usage) {
        console.log(chalk.dim(`\nTokens: ${response.usage.total_tokens} (prompt: ${response.usage.prompt_tokens}, completion: ${response.usage.completion_tokens})`));
    }
}

program
    .name('bifrost')
    .description('Bifrost Bridge Research Assistant')
    .version('1.0.0');

program
    .command('ask')
    .description('Quickly ask a question (Standard Sonar Model)')
    .argument('<query>', 'The question to ask')
    .action(async (query: string) => {
        validateQuery(query);

        const spinner = ora('Thinking...').start();

        try {
            const client = getClient();
            const response = await client.chat(
                [{ role: 'user', content: query }],
                { model: PERPLEXITY_MODELS.SONAR }
            );

            spinner.succeed('Complete');
            displayResponse(response);
            process.exit(0);
        } catch (error) {
            handleError(error as Error, spinner);
        }
    });

program
    .command('research')
    .description('Deep research with reasoning (Sonar Reasoning Pro)')
    .argument('<query>', 'The research topic')
    .action(async (query: string) => {
        validateQuery(query);

        console.log(chalk.blue(chalk.bold('Initiating Research Task: ') + query));
        const spinner = ora('Reasoning (this may take a minute)...').start();

        try {
            const client = getClient();
            const response = await client.research(query);

            spinner.succeed('Research Complete');
            displayResponse(response);
            process.exit(0);
        } catch (error) {
            handleError(error as Error, spinner);
        }
    });

// Handle uncaught errors
process.on('unhandledRejection', (error: Error) => {
    logger.error('Unhandled rejection', error);
    console.error(chalk.red('Fatal Error:'), error.message);
    process.exit(2);
});

program.parse();
