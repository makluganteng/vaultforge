import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { SessionManager } from '../../core/session.js';
import { Ingestor } from '../../core/ingestor.js';

export function registerAdd(program: Command): void {
  program
    .command('add')
    .description('Add a source (URL or file path) to the knowledge base')
    .argument('<source>', 'URL or file path to add')
    .action(async (source: string) => {
      const spinner = ora(`Adding source "${source}"...`).start();
      try {
        const session = await SessionManager.getActive();
        await Ingestor.add(session, source);
        spinner.succeed(chalk.green(`Source added: ${source}`));
      } catch (error) {
        spinner.fail(chalk.red('Failed to add source'));
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });
}
