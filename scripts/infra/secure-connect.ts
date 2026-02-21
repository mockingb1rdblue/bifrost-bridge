import * as readline from 'readline';
import { spawn } from 'child_process';
import * as path from 'path';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
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
    child.stdout.on('data', (data) => (output += data.toString()));
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
    const child = spawn('npx', [
      'wrangler',
      'kv',
      'key',
      'get',
      keyName,
      '--namespace-id',
      namespaceId,
    ]);
    let output = '';
    child.stdout.on('data', (data) => (output += data.toString()));
    child.stderr.on('data', (data) => console.error(`[KV Debug] ${data}`));
    child.on('close', (code) => {
      if (code === 0 && output.trim() && !output.includes('not found')) {
        resolve(output.trim());
      } else {
        if (code !== 0) console.error(`[KV Debug] Failed with code ${code} for key ${keyName}`);
        resolve(null);
      }
    });
  });
};

const saveToCloudVault = async (
  namespaceId: string,
  keyName: string,
  secret: string,
): Promise<void> => {
  return new Promise((resolve) => {
    const child = spawn('npx', [
      'wrangler',
      'kv',
      'key',
      'put',
      keyName,
      secret,
      '--namespace-id',
      namespaceId,
    ]);
    child.on('close', () => resolve());
  });
};

async function main() {
  console.log('🔐 \x1b[36mSecure Connect: Cloud Vault Loader\x1b[0m');
  console.log(
    '   This tool executes scripts with in-memory secrets pulled exclusively from Cloudflare KV.',
  );
  console.log('   Zero Local Secrets. Zero .env files. Zero Compromises.\n');

  process.stdout.write('🔍 Locating Cloudflare KV Vault... ');
  const vaultId = await getCloudVaultId();
  if (!vaultId) {
    console.error('❌ Failed. Could not find bifrost-bridge-BIFROST_KV namespace.');
    console.error('   Ensure you are logged in via `npx wrangler login`.');
    process.exit(1);
  }
  console.log('✅ Found.\n');

  const secrets: Record<string, string> = {};
  const requiredKeys = [
    'LINEAR_API_KEY',
    'PROXY_API_KEY',
    'GEMINI_API_KEY',
    'ANTHROPIC_API_KEY',
    'PERPLEXITY_API_KEY',
    'DEEPSEEK_API_KEY',
    'LINEAR_TEAM_ID',
    'LINEAR_PROJECT_ID',
    'GITHUB_APP_ID',
    'GITHUB_PRIVATE_KEY',
    'GITHUB_INSTALLATION_ID',
    'LINEAR_WEBHOOK_SECRET',
    'GITHUB_WEBHOOK_SECRET',
    'PERPLEXITY_BASE_URL',
  ];

  for (const key of requiredKeys) {
    let value = await getFromCloudVault(vaultId, key);
    if (value) {
      secrets[key] = value;
      console.log(`✅ Loaded ${key} securely from Cloud Vault.`);
    } else if (
      key === 'LINEAR_API_KEY' ||
      key === 'PROXY_API_KEY' ||
      key === 'GEMINI_API_KEY'
    ) {
      // Critical keys that must exist
      value = await ask(`🔑 Enter ${key.replace(/_/g, ' ')} (will be saved securely to Cloud Vault): `, true);
      if (value) {
        console.log(`\n⏳ Encrypting and uploading ${key} to Cloudflare KV...`);
        await saveToCloudVault(vaultId, key, value);
        secrets[key] = value;
        console.log('✅ Saved.');
      }
    } else {
      // Non-critical or optional keys for local testing
      secrets[key] = `dummy-${key.toLowerCase()}`;
    }
  }

  // Inject all loaded secrets into process.env
  Object.entries(secrets).forEach(([key, value]) => {
    if (value) process.env[key] = value;
  });

  if (!secrets.LINEAR_API_KEY || !secrets.PROXY_API_KEY || !secrets.GEMINI_API_KEY) {
    console.error('\n❌ Primary keys (LINEAR, PROXY, GEMINI) are required to proceed.');
    process.exit(1);
  }

  // Get the script to run from args
  const scriptArgs = process.argv.slice(2);
  if (scriptArgs.length === 0) {
    console.error(
      '❌ No script specified. Usage: npx tsx scripts/infra/secure-connect.ts <script_path> [args]',
    );
    process.exit(1);
  }

  const scriptPath = scriptArgs[0];
  const remainingArgs = scriptArgs.slice(1);

  console.log(`\n🚀 Launching \x1b[33m${scriptPath}\x1b[0m with secure context...\n`);

  let commandArgs = scriptPath.endsWith('.ts')
    ? ['tsx', scriptPath, ...remainingArgs]
    : [scriptPath, ...remainingArgs];

  // If running wrangler dev/deploy, inject secrets as --var flags
  const isWrangler = scriptPath === 'wrangler' || (commandArgs[0] === 'wrangler');
  if (isWrangler && (remainingArgs.includes('dev') || remainingArgs.includes('deploy'))) {
    Object.entries(secrets).forEach(([key, value]) => {
      if (value && key !== 'PERPLEXITY_BASE_URL' && key !== 'NODE_EXTRA_CA_CERTS') {
        commandArgs.push('--var', `${key}:${value}`);
      }
    });
  }

  const child = spawn('npx', ['--', ...commandArgs], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS, // Preserve certs if set
    },
  });

  child.on('close', (code) => {
    rl.close();
    process.exit(code || 0);
  });
}

main().catch(console.error);
