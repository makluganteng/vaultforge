import { stat, access } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { execa } from 'execa';
import type { RepoInfo } from '../types/index.js';

/**
 * Manifest files that identify the primary language of a repo.
 * Order matters — earlier entries win when multiple are present.
 */
const LANGUAGE_MANIFESTS: Array<{ file: string; language: string }> = [
  { file: 'package.json', language: 'JavaScript/TypeScript' },
  { file: 'Cargo.toml', language: 'Rust' },
  { file: 'go.mod', language: 'Go' },
  { file: 'pyproject.toml', language: 'Python' },
  { file: 'setup.py', language: 'Python' },
  { file: 'requirements.txt', language: 'Python' },
  { file: 'Gemfile', language: 'Ruby' },
  { file: 'composer.json', language: 'PHP' },
  { file: 'pom.xml', language: 'Java' },
  { file: 'build.gradle', language: 'Java' },
  { file: 'build.gradle.kts', language: 'Kotlin' },
  { file: 'mix.exs', language: 'Elixir' },
];

const README_CANDIDATES = ['README.md', 'README.rst', 'README.txt', 'README'];

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function detectGitState(
  cwd: string,
): Promise<{ commitSha?: string; branch?: string }> {
  try {
    const [shaResult, branchResult] = await Promise.all([
      execa('git', ['rev-parse', 'HEAD'], { cwd, reject: false }),
      execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd, reject: false }),
    ]);
    const commitSha = shaResult.exitCode === 0 ? shaResult.stdout.trim() : undefined;
    const branchRaw = branchResult.exitCode === 0 ? branchResult.stdout.trim() : undefined;
    // Detached HEAD reports "HEAD" — not useful as a branch label.
    const branch = branchRaw && branchRaw !== 'HEAD' ? branchRaw : undefined;
    return { commitSha, branch };
  } catch {
    return {};
  }
}

/**
 * Inspect a directory and return lightweight metadata about it as a code repository.
 * Does NOT enumerate source files — Claude's Glob tool handles that during ingestion.
 */
export async function scanRepo(cwd: string): Promise<RepoInfo> {
  let stats;
  try {
    stats = await stat(cwd);
  } catch {
    throw new Error(`Path does not exist: ${cwd}`);
  }
  if (!stats.isDirectory()) {
    throw new Error(`Path is not a directory: ${cwd}`);
  }

  const manifestFiles: string[] = [];
  let primaryLanguage: string | undefined;
  for (const { file, language } of LANGUAGE_MANIFESTS) {
    if (await fileExists(join(cwd, file))) {
      manifestFiles.push(file);
      if (!primaryLanguage) primaryLanguage = language;
    }
  }

  let hasReadme = false;
  for (const candidate of README_CANDIDATES) {
    if (await fileExists(join(cwd, candidate))) {
      hasReadme = true;
      break;
    }
  }

  const { commitSha, branch } = await detectGitState(cwd);

  return {
    absPath: cwd,
    name: basename(cwd),
    primaryLanguage,
    manifestFiles,
    hasReadme,
    commitSha,
    branch,
  };
}
