import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { SessionManager } from '../../core/session.js';

export function registerNew(program: Command): void {
  program
    .command('new')
    .description('Create a new knowledge base session for a topic')
    .argument('<topic>', 'Topic for the knowledge base')
    .option('--model <model>', 'Claude model to use', 'claude-sonnet-4')
    .action(async (topic: string, options: { model: string }) => {
      const spinner = ora(`Creating session for "${topic}"...`).start();
      try {
        const session = await SessionManager.create(topic, options);
        spinner.succeed(chalk.green(`Session created: ${session.id}`));
        console.log(chalk.dim(`Path: ${session.path}`));
      } catch (error) {
        spinner.fail(chalk.red('Failed to create session'));
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });
}
