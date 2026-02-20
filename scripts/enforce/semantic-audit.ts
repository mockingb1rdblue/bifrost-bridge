import { join } from 'path';
import { readFileSync, readdirSync, lstatSync } from 'fs';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { GoogleGenAI } from '@google/genai';
import chalk from 'chalk';

const DB_PATH = join(process.cwd(), '.data', 'library.sqlite');
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  console.log(chalk.red('❌ GEMINI_API_KEY missing. Semantic Audit aborted.'));
  process.exit(0); // Optional: don't fail CI if key is missing, just skip
}

const ai = new GoogleGenAI({ apiKey: geminiApiKey });

function getDb() {
  const db = new Database(DB_PATH);
  sqliteVec.load(db);
  return db;
}

async function embedText(text: string): Promise<Float32Array> {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
  });
  return new Float32Array(response.embeddings![0].values!);
}

async function auditFile(filePath: string, db: any) {
  const content = readFileSync(filePath, 'utf-8');
  if (!content.trim()) return;

  console.log(chalk.blue(`🛡️  Auditing: ${filePath}`));

  // 1. Embed file content (or first 2k chars for speed)
  const fileVector = await embedText(content.slice(0, 2000));

  // 2. Query Vector DB for relevant docs
  const results = db
    .prepare(
      `
        SELECT 
            c.source_url,
            c.content,
            vec_distance_cosine(e.embedding, ?) as distance
        FROM embeddings e
        JOIN immutable_chunks c ON c.id = e.chunk_id
        ORDER BY distance ASC
        LIMIT 3
    `,
    )
    .all(new Uint8Array(fileVector.buffer)) as any[];

  if (results.length === 0) return;

  // 3. LLM Pattern Matching
  let context = 'OFFICIAL DOCUMENTATION PATTERNS:\n';
  results.forEach((r) => {
    context += `Source: ${r.source_url}\n${r.content}\n\n`;
  });

  const prompt = `You are a Senior Compliance Auditor. 
Compare the following CODE against the provided OFFICIAL DOCUMENTATION PATTERNS.
Identify any LOGIC or PATTERN violations where the code contradicts the official docs.
Ignore stylistic differences (formatting/naming) handled by Linters.
Focus on: State management, API usage patterns, Security isolation, and Deployment best practices.

OFFICIAL DOCS:
${context}

CODE TO AUDIT (${filePath}):
${content}

OUTPUT:
If compliant, output ONLY "PASSED".
If violations are found, output a bulleted list of SPECIFIC deviations and how to fix them.`;

  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest',
    contents: prompt,
    config: { temperature: 0.1 },
  });

  const report = response.text?.trim() || 'PASSED';

  if (report !== 'PASSED') {
    console.log(chalk.red(`❌ Compliance Violations in ${filePath}:`));
    console.log(report);
    // process.exitCode = 1; // Mark as failure
  } else {
    console.log(chalk.green(`✅ ${filePath} is compliant with official docs.`));
  }
}

async function walk(dir: string, db: any) {
  const files = readdirSync(dir);
  for (const file of files) {
    const fullPath = join(dir, file);
    if (lstatSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        await walk(fullPath, db);
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts') && !file.includes('.test.')) {
      await auditFile(fullPath, db);
    }
  }
}

async function run() {
  const db = getDb();
  const target = process.argv[2] || 'src';
  const targetPath = join(process.cwd(), target);

  console.log(chalk.bold(`\n💀 Starting Semantic Documentation Audit of [${target}]...\n`));

  if (lstatSync(targetPath).isDirectory()) {
    await walk(targetPath, db);
  } else {
    await auditFile(targetPath, db);
  }

  console.log(chalk.bold('\n🏁 Semantic Audit Complete.\n'));
  db.close();
}

run().catch(console.error);
