import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Fly.io Model-Aware Tool Manifest Validator
 * Enforces the schema derived from the latest Fly.io documentation.
 * Focused on JSON manifests for zero-dependency execution.
 */

interface Manifest {
  schema_version: string;
  name_for_human: string;
  name_for_model: string;
  description_for_human: string;
  description_for_model: string;
  auth: {
    type: string;
  };
  api: {
    type: string;
    url: string;
    is_user_authenticated: boolean;
  };
}

function validateManifest(filePath: string, content: any) {
  const required = [
    'schema_version',
    'name_for_human',
    'name_for_model',
    'description_for_human',
    'description_for_model',
    'auth',
    'api',
  ];

  for (const field of required) {
    if (!content[field]) {
      throw new Error(`[${filePath}] Missing required field: ${field}`);
    }
  }

  if (content.schema_version !== 'v1') {
    console.warn(
      `[${filePath}] Warning: schema_version is ${content.schema_version}, expected v1.`,
    );
  }

  if (typeof content.api.is_user_authenticated !== 'boolean') {
    throw new Error(`[${filePath}] api.is_user_authenticated must be a boolean.`);
  }

  console.log(`✅ [${filePath}] Validated successfully.`);
}

function findAndValidate(dir: string) {
  const files = readdirSync(dir);

  for (const file of files) {
    const fullPath = join(dir, file);
    if (statSync(fullPath).isDirectory()) {
      if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
      findAndValidate(fullPath);
      continue;
    }

    if (file.endsWith('.manifest.json')) {
      const raw = readFileSync(fullPath, 'utf8');
      try {
        const parsed = JSON.parse(raw);
        // Only validate if it looks like a manifest (has name_for_model)
        if (parsed && parsed.name_for_model) {
          validateManifest(fullPath, parsed);
        }
      } catch (e: any) {
        console.error(`❌ Failed to parse/validate ${fullPath}: ${e.message}`);
        process.exit(1);
      }
    }
  }
}

console.log('🚀 Running Fly.io Manifest Enforcer...');
findAndValidate(process.cwd());
console.log('✨ All discovered manifests are compliant.');
