
import readline from 'readline';
import { spawn } from 'child_process';
import path from 'path';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (query: string, hidden = false): Promise<string> => {
    return new Promise((resolve) => {
        if (hidden) {
            // Simple hidden input handling
            process.stdout.write(query);
            let captured = '';

            // Raw mode to capture keystrokes without echoing
            if (process.stdin.setRawMode) process.stdin.setRawMode(true);

            const onData = (char: Buffer) => {
                const charStr = char.toString('utf8');

                // Enter key
                if (charStr === '\n' || charStr === '\r') {
                    process.stdout.write('\n');
                    if (process.stdin.setRawMode) process.stdin.setRawMode(false);
                    process.stdin.removeListener('data', onData);
                    resolve(captured);
                    return;
                }

                // Ctrl+C
                if (charStr === '\u0003') {
                    process.exit(1);
                }

                // Backspace
                if (charStr === '\u007f') {
                    if (captured.length > 0) {
                        captured = captured.slice(0, -1);
                        // Move cursor back, overwrite with space, move back again
                        process.stdout.write('\b \b');
                    }
                    return;
                }

                captured += charStr;
                process.stdout.write('*');
            };

            process.stdin.resume();
            process.stdin.on('data', onData);
        } else {
            rl.question(query, (instances) => {
                resolve(instances);
            });
        }
    });
};

async function main() {
    console.log('🔐 \x1b[36mSecure Connect: Swarm Session Loader\x1b[0m');
    console.log('   This tool executes scripts with in-memory secrets (Zero Local Secrets compliant).\n');

    const linearKey = await ask('🔑 Enter Linear API Key: ', true);
    const proxyKey = await ask('🔑 Enter Proxy API Key: ', true);

    if (!linearKey || !proxyKey) {
        console.error('❌ Both keys are required.');
        process.exit(1);
    }

    // Get the script to run from args
    const scriptArgs = process.argv.slice(2);
    if (scriptArgs.length === 0) {
        console.error('❌ No script specified. Usage: npx tsx scripts/infra/secure-connect.ts <script_path> [args]');
        process.exit(1);
    }

    const scriptPath = scriptArgs[0];
    const remainingArgs = scriptArgs.slice(1);

    console.log(`\n🚀 Launching \x1b[33m${scriptPath}\x1b[0m with secure context...\n`);

    const child = spawn('npx', ['tsx', scriptPath, ...remainingArgs], {
        stdio: 'inherit',
        env: {
            ...process.env,
            LINEAR_API_KEY: linearKey,
            PROXY_API_KEY: proxyKey,
            NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS // Preserve certs if set
        }
    });

    child.on('close', (code) => {
        rl.close();
        process.exit(code || 0);
    });
}

main().catch(console.error);
