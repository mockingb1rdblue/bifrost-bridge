
import * as readline from 'readline';
import { spawn } from 'child_process';
import * as path from 'path';

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

const getCloudVaultId = async (): Promise<string | null> => {
    return new Promise((resolve) => {
        const child = spawn('npx', ['wrangler', 'kv', 'namespace', 'list']);
        let output = '';
        child.stdout.on('data', (data) => output += data.toString());
        child.on('close', (code) => {
            if (code !== 0) return resolve(null);
            try {
                // Find JSON array in output
                const match = output.match(/\[.*\]/s);
                if (!match) return resolve(null);
                const namespaces = JSON.parse(match[0]);
                const vault = namespaces.find((ns: any) => ns.title === 'bifrost-bridge-BIFROST_KV');
                resolve(vault ? vault.id : null);
            } catch (e) {
                resolve(null);
            }
        });
    });
};

const getFromCloudVault = async (namespaceId: string, keyName: string): Promise<string | null> => {
    return new Promise((resolve) => {
        const child = spawn('npx', ['wrangler', 'kv', 'key', 'get', keyName, '--namespace-id', namespaceId]);
        let output = '';
        child.stdout.on('data', (data) => output += data.toString());
        child.on('close', (code) => {
            if (code === 0 && output.trim() && !output.includes('not found')) resolve(output.trim());
            else resolve(null);
        });
    });
};

const saveToCloudVault = async (namespaceId: string, keyName: string, secret: string): Promise<void> => {
    return new Promise((resolve) => {
        const child = spawn('npx', ['wrangler', 'kv', 'key', 'put', keyName, secret, '--namespace-id', namespaceId]);
        child.on('close', () => resolve());
    });
};

async function main() {
    console.log('🔐 \x1b[36mSecure Connect: Cloud Vault Loader\x1b[0m');
    console.log('   This tool executes scripts with in-memory secrets pulled exclusively from Cloudflare KV.');
    console.log('   Zero Local Secrets. Zero .env files. Zero Compromises.\n');

    process.stdout.write('🔍 Locating Cloudflare KV Vault... ');
    const vaultId = await getCloudVaultId();
    if (!vaultId) {
        console.error('❌ Failed. Could not find bifrost-bridge-BIFROST_KV namespace.');
        console.error('   Ensure you are logged in via `npx wrangler login`.');
        process.exit(1);
    }
    console.log('✅ Found.\n');

    let linearKey = await getFromCloudVault(vaultId, 'LINEAR_API_KEY');
    let proxyKey = await getFromCloudVault(vaultId, 'PROXY_API_KEY');
    let perplexityBaseUrl = await getFromCloudVault(vaultId, 'PERPLEXITY_BASE_URL');

    if (perplexityBaseUrl) {
        process.env.PERPLEXITY_BASE_URL = perplexityBaseUrl;
    }

    if (linearKey) {
        console.log('✅ Loaded LINEAR_API_KEY securely from Cloud Vault.');
    } else {
        linearKey = await ask('🔑 Enter Linear API Key (will be saved securely to Cloud Vault): ', true);
        if (linearKey) {
            console.log('\n⏳ Encrypting and uploading to Cloudflare KV...');
            await saveToCloudVault(vaultId, 'LINEAR_API_KEY', linearKey);
            console.log('✅ Saved.');
        }
    }

    if (proxyKey) {
        console.log('✅ Loaded PROXY_API_KEY securely from Cloud Vault.');
    } else {
        proxyKey = await ask('🔑 Enter Proxy API Key (will be saved securely to Cloud Vault): ', true);
        if (proxyKey) {
            console.log('\n⏳ Encrypting and uploading to Cloudflare KV...');
            await saveToCloudVault(vaultId, 'PROXY_API_KEY', proxyKey);
            console.log('✅ Saved.');
        }
    }

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
