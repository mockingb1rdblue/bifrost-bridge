#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { PerplexityClient } from './perplexity-client';
import { PERPLEXITY_MODELS } from './models';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env from root
dotenv.config({ path: path.join(__dirname, '../.env') });

const program = new Command();

// Helper to get client
function getClient() {
    let apiKey = process.env.PERPLEXITY_API_KEY;
    const baseUrl = process.env.PERPLEXITY_BASE_URL;

    // Smart Key Logic
    if (baseUrl && baseUrl.includes('workers.dev')) {
        apiKey = process.env.PROXY_API_KEY;
    }

    if (!apiKey) {
        console.error(chalk.red("Error:"), "No API Key found. Check .env");
        process.exit(1);
    }
    return new PerplexityClient(apiKey, baseUrl);
}

program
    .name('bifrost')
    .description('Bifrost Bridge Research Assistant')
    .version('1.0.0');

program
    .command('ask')
    .description('Quickly ask a question (Standard Sonar Model)')
    .argument('<query>', 'The question to ask')
    .action(async (query) => {
        const spinner = ora('Thinking...').start();
        try {
            const client = getClient();
            // Use 'any' cast to avoid strict streaming type issues for now
            const response = await client.chat([
                { role: 'user', content: query }
            ], { model: PERPLEXITY_MODELS.SONAR }) as any;

            spinner.stop();
            console.log(chalk.bold.green("\nAnswer:"));
            console.log(response.choices[0].message.content);

            // Citations?
            const citations = response.citations;
            if (citations && citations.length > 0) {
                console.log(chalk.dim("\nSources:"));
                citations.forEach((c: string, i: number) => console.log(chalk.dim(`[${i + 1}] ${c}`)));
            }

        } catch (error: any) {
            spinner.fail('Error');
            console.error(chalk.red(error.message || error));
        }
    });

program
    .command('research')
    .description('Deep research with reasoning (Sonar Reasoning Pro)')
    .argument('<query>', 'The research topic')
    .action(async (query) => {
        console.log(chalk.blue(chalk.bold("Initiating Research Task: ") + query));
        const spinner = ora('Reasoning (this may take a minute)...').start();

        try {
            const client = getClient();
            const response = await client.research(query) as any;

            spinner.succeed('Research Complete');

            console.log(chalk.bold("\nFindings:"));
            console.log(response.choices[0].message.content);

            const citations = response.citations;
            if (citations && citations.length > 0) {
                console.log(chalk.dim("\nReferences:"));
                citations.forEach((c: string, i: number) => console.log(chalk.dim(`[${i + 1}] ${c}`)));
            }

        } catch (error: any) {
            spinner.fail('Research Failed');
            console.error(chalk.red(error.message));
        }
    });

program.parse();
