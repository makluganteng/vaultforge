import { Command } from 'commander';
import chalk from 'chalk';
import { SessionManager } from '../../core/session.js';

export function registerSessions(program: Command): void {
  program
    .command('sessions')
    .description('List all knowledge base sessions')
    .action(async () => {
      try {
        const sessions = await SessionManager.list();
        if (sessions.length === 0) {
          console.log(chalk.dim('No sessions found. Run `vaultforge new <topic>` to start.'));
          return;
        }
        const active = await SessionManager.getActiveId();
        console.log(chalk.bold('\nSessions:\n'));
        for (const s of sessions) {
          const marker = s.id === active ? chalk.green('* ') : '  ';
          const status = s.status === 'active' ? chalk.green(s.status) : chalk.dim(s.status);
          console.log(`${marker}${chalk.bold(s.topic)} ${chalk.dim(`(${s.id})`)}`);
          console.log(`  ${chalk.dim('status:')} ${status}  ${chalk.dim('sources:')} ${s.sources.length}`);
          console.log(`  ${chalk.dim('vault:')}  ${chalk.cyan(s.dir)}`);
          console.log();
        }
        console.log(chalk.dim('Tip: open the vault path in Obsidian (File → Open vault → Open folder as vault)'));
        console.log();
      } catch (error) {
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });
}
