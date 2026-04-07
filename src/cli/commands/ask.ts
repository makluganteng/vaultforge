import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { SessionManager } from '../../core/session.js';
import { WikiCompiler } from '../../core/compiler.js';

export function registerAsk(program: Command): void {
  program
    .command('ask')
    .description('Ask a question about the knowledge base')
    .argument('<question>', 'Question to ask')
    .action(async (question: string) => {
      const spinner = ora('Thinking...').start();
      try {
        const session = await SessionManager.getActive();
        const answer = await WikiCompiler.ask(session, question);
        spinner.stop();
        console.log(chalk.cyan(answer));
      } catch (error) {
        spinner.fail(chalk.red('Failed to get answer'));
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });
}
