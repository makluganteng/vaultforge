import { Command } from 'commander';
import chalk from 'chalk';
import { SessionManager } from '../../core/session.js';
import { WikiCompiler } from '../../core/compiler.js';
import type { ResearchOptions } from '../../types/index.js';

export function registerResearch(program: Command): void {
  program
    .command('research')
    .description('Research a query and add findings to the knowledge base')
    .argument('<query>', 'Research query')
    .option('--max-sources <n>', 'Maximum number of sources', '10')
    .option('--depth <level>', 'Research depth (shallow|normal|deep)', 'normal')
    .action(async (query: string, opts: { maxSources: string; depth: string }) => {
      try {
        const session = await SessionManager.getActive();
        console.log(chalk.dim(`Vault: ${session.dir}`));
        console.log(chalk.bold(`Researching "${query}"...\n`));
        const options: ResearchOptions = {
          maxSources: parseInt(opts.maxSources, 10),
          depth: opts.depth as ResearchOptions['depth'],
        };
        await WikiCompiler.research(session, query, options);
        console.log(chalk.green('\nResearch complete'));
      } catch (error) {
        console.error(chalk.red('\nResearch failed: ' + (error as Error).message));
        process.exit(1);
      }
    });
}
