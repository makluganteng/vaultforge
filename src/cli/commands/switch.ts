import { Command } from 'commander';
import chalk from 'chalk';
import { SessionManager } from '../../core/session.js';

export function registerSwitch(program: Command): void {
  program
    .command('switch')
    .description('Switch to a different session')
    .argument('<id>', 'Session ID to switch to')
    .action(async (id: string) => {
      try {
        await SessionManager.switch(id);
        console.log(chalk.green(`Switched to session: ${id}`));
      } catch (error) {
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });
}
