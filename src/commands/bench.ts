
import chalk from 'chalk';
import ora from 'ora';
import { Command } from 'commander';
import * as dotenv from 'dotenv';
import path from 'path';
import { performance } from 'perf_hooks';

// Load .env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const EVENTS_URL = process.env.EVENTS_URL || "https://bifrost-events.fly.dev";
const EVENTS_SECRET = process.env.EVENTS_SECRET;

export function registerBenchCommand(program: Command) {
    const bench = program.command('bench').description('Run performance benchmarks');

    bench
        .command('all')
        .description('Run all benchmarks')
        .action(async () => {
            console.log(chalk.blue("🚀 Starting Performance Benchmarks..."));

            await runEventStoreBenchmark();
            // Future benchmarks can be added here (e.g., seeding throughput)

            console.log(chalk.green("\n🏁 Benchmarks Complete."));
            process.exit(0);
        });

    bench
        .command('event-store')
        .description('Benchmark Event Store write latency')
        .option('-n, --count <number>', 'Number of events to write', '10')
        .action(async (options) => {
            await runEventStoreBenchmark(parseInt(options.count));
            process.exit(0);
        });
}

async function runEventStoreBenchmark(count: number = 10) {
    console.log(chalk.bold(`\n📉 Event Store Write Latency (n=${count})`));
    const spinner = ora('Warming up...').start();

    // Warmup
    try {
        await writeEvent('warmup');
        spinner.succeed('Warmup complete');
    } catch (e) {
        spinner.fail(`Warmup failed: ${(e as Error).message}`);
        return;
    }

    const latencies: number[] = [];
    spinner.start(`Writing ${count} events...`);

    for (let i = 0; i < count; i++) {
        const start = performance.now();
        try {
            await writeEvent(`bench-${i}`);
            const end = performance.now();
            latencies.push(end - start);
            spinner.text = `Writing event ${i + 1}/${count} (Last: ${(end - start).toFixed(2)}ms)`;
        } catch (e) {
            spinner.fail(`Write failed on iteration ${i}: ${(e as Error).message}`);
            return;
        }
    }

    spinner.succeed('Write benchmark complete');

    // Stats
    const total = latencies.reduce((a, b) => a + b, 0);
    const avg = total / count;
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    const p95 = latencies.sort((a, b) => a - b)[Math.floor(count * 0.95)];

    console.log(chalk.dim('Results:'));
    console.log(`  Avg: ${chalk.bold(avg.toFixed(2))}ms`);
    console.log(`  Min: ${min.toFixed(2)}ms`);
    console.log(`  Max: ${max.toFixed(2)}ms`);
    console.log(`  P95: ${chalk.yellow(p95.toFixed(2))}ms`);
}

async function writeEvent(sourceId: string) {
    const res = await fetch(`${EVENTS_URL}/events`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${EVENTS_SECRET}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            type: "BENCHMARK",
            source: "bifrost-bench",
            topic: "benchmark",
            payload: { timestamp: Date.now(), id: sourceId }
        })
    });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
}
