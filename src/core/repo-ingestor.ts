import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { runClaude } from './claude-runner.js';
import { rebuildIndex } from './indexer.js';
import { repoPrompt } from './prompts.js';
import { scanRepo } from './repo-scanner.js';
import type {
  ProgressEvent,
  RepoIngestOptions,
  RepoInfo,
  RepoWikiMeta,
} from '../types/index.js';

export interface RepoIngestorOptions extends RepoIngestOptions {
  /** Subscribe to progress events. If omitted, progress is printed to stdout. */
  onProgress?: (event: ProgressEvent) => void;
}

/** Tool allowlist for repo ingestion: no Web*, no Bash. Purely local file ops. */
const REPO_ALLOWED_TOOLS = ['Read', 'Glob', 'Grep', 'Write', 'Edit'];

async function ensureWikiLayout(repoRoot: string): Promise<void> {
  const dirs = [
    join(repoRoot, 'wiki'),
    join(repoRoot, 'wiki', 'concepts'),
    join(repoRoot, 'wiki', 'summaries'),
    join(repoRoot, 'wiki', '.vaultforge'),
  ];
  await Promise.all(dirs.map((d) => mkdir(d, { recursive: true })));
}

async function writeMetadata(
  repoRoot: string,
  repo: RepoInfo,
  options: RepoIngestOptions,
): Promise<void> {
  const meta: RepoWikiMeta = {
    type: 'repo',
    name: repo.name,
    primaryLanguage: repo.primaryLanguage,
    commitSha: repo.commitSha,
    branch: repo.branch,
    depth: options.depth ?? 'normal',
    includeTests: options.includeTests ?? false,
    lastRun: new Date().toISOString(),
  };

  await writeFile(
    join(repoRoot, 'wiki', '.vaultforge', 'session.json'),
    JSON.stringify(meta, null, 2),
  );
}

/**
 * Document a local code repository as an Obsidian wiki at `<repo>/wiki/`.
 *
 * Runs `claude` with `cwd = repoRoot` and a restricted tool allowlist (no
 * WebSearch/WebFetch/Bash). Everything Claude touches is under the cwd,
 * so this does not expand the permission surface beyond the existing
 * research flow.
 */
async function ingest(
  repoRoot: string,
  options: RepoIngestorOptions = {},
): Promise<RepoInfo> {
  const repo = await scanRepo(repoRoot);

  if (!options.onProgress) {
    console.log(chalk.dim(`Repository: ${repo.absPath}`));
    if (repo.primaryLanguage) {
      console.log(chalk.dim(`Language:   ${repo.primaryLanguage}`));
    }
    if (repo.commitSha) {
      const branch = repo.branch ? ` (${repo.branch})` : '';
      console.log(chalk.dim(`Commit:     ${repo.commitSha.slice(0, 8)}${branch}`));
    }
    console.log(chalk.bold(`\nDocumenting ${repo.name}...\n`));
  }

  await ensureWikiLayout(repoRoot);
  await writeMetadata(repoRoot, repo, options);

  await runClaude(repoRoot, repoPrompt(repo, options), {
    stream: true,
    onProgress: options.onProgress,
    allowedTools: REPO_ALLOWED_TOOLS,
  });

  await rebuildIndex(repoRoot, repo.name);
  if (!options.onProgress) console.log(chalk.dim('  · Index rebuilt'));

  return repo;
}

export const RepoIngestor = { ingest };
