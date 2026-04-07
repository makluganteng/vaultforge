import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import chalk from 'chalk';
import { runClaude } from './claude-runner.js';
import { rebuildIndex } from './indexer.js';
import { researchPrompt, compilePrompt, askPrompt, healthPrompt } from './prompts.js';
import { slugify } from '../utils/text.js';
import type {
  ActiveSession,
  ResearchOptions,
  CompileOptions,
  HealthReport,
  ProgressEvent,
} from '../types/index.js';

export interface CompilerOptions {
  /** Subscribe to progress events. If omitted, progress is printed to stdout (CLI mode). */
  onProgress?: (event: ProgressEvent) => void;
}

async function research(
  session: ActiveSession,
  query: string,
  options?: ResearchOptions & CompilerOptions,
): Promise<void> {
  await runClaude(session.dir, researchPrompt(query, options), {
    stream: true,
    onProgress: options?.onProgress,
  });
  await rebuildIndex(session.dir, session.config.topic);
  if (!options?.onProgress) console.log(chalk.dim('  · Index rebuilt'));
}

async function compile(
  session: ActiveSession,
  options?: CompileOptions & CompilerOptions,
): Promise<void> {
  await runClaude(session.dir, compilePrompt(options), {
    stream: true,
    onProgress: options?.onProgress,
  });
  await rebuildIndex(session.dir, session.config.topic);
  if (!options?.onProgress) console.log(chalk.dim('  · Index rebuilt'));
}

async function ask(
  session: ActiveSession,
  question: string,
  options?: CompilerOptions,
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputFile = `outputs/${timestamp}-${slugify(question, 40)}.md`;

  await mkdir(join(session.dir, 'outputs'), { recursive: true });

  return runClaude(session.dir, askPrompt(question, outputFile), {
    stream: Boolean(options?.onProgress),
    onProgress: options?.onProgress,
  });
}

async function health(session: ActiveSession): Promise<HealthReport> {
  const output = await runClaude(session.dir, healthPrompt());

  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Health check returned invalid output: no JSON found');
  }
  return JSON.parse(jsonMatch[0]) as HealthReport;
}

export const WikiCompiler = { research, compile, ask, health };
