import { Command } from 'commander';
import chalk from 'chalk';
import { RepoIngestor } from '../../core/repo-ingestor.js';
import type { RepoIngestOptions } from '../../types/index.js';

interface RepoCommandOptions {
  depth: string;
  includeTests?: boolean;
  force?: boolean;
}

export function registerRepo(program: Command): void {
  program
    .command('repo')
    .description('Document the current repository as an Obsidian wiki at ./wiki/')
    .option('--depth <level>', 'Documentation depth (shallow|normal|deep)', 'normal')
    .option('--include-tests', 'Include test files in the documentation', false)
    .option('--force', 'Rewrite all wiki articles from scratch', false)
    .action(async (opts: RepoCommandOptions) => {
      try {
        const depth = opts.depth as RepoIngestOptions['depth'];
        if (depth && !['shallow', 'normal', 'deep'].includes(depth)) {
          throw new Error(
            `Invalid --depth "${opts.depth}". Must be shallow, normal, or deep.`,
          );
        }

        const options: RepoIngestOptions = {
          depth,
          includeTests: opts.includeTests ?? false,
          force: opts.force ?? false,
        };

        await RepoIngestor.ingest(process.cwd(), options);
        console.log(chalk.green('\nRepo wiki ready at ./wiki/'));
        console.log(
          chalk.dim('Open ./wiki/ as an Obsidian vault or browse ./wiki/index.md.'),
        );
      } catch (error) {
        console.error(chalk.red('\nRepo ingestion failed: ' + (error as Error).message));
        process.exit(1);
      }
    });
}
