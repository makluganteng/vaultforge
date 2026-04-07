import { Command } from 'commander';
import chalk from 'chalk';
import { SessionManager } from '../../core/session.js';
import { WikiCompiler } from '../../core/compiler.js';
import type { CompileOptions } from '../../types/index.js';

export function registerCompile(program: Command): void {
  program
    .command('compile')
    .description('Compile sources into wiki articles')
    .option('--force', 'Recompile everything from scratch')
    .action(async (opts: { force?: boolean }) => {
      try {
        const session = await SessionManager.getActive();
        console.log(chalk.dim(`Vault: ${session.dir}`));
        console.log(chalk.bold('Compiling wiki...\n'));
        const options: CompileOptions = { force: opts.force };
        await WikiCompiler.compile(session, options);
        console.log(chalk.green('\nWiki compiled successfully'));
      } catch (error) {
        console.error(chalk.red('\nCompilation failed: ' + (error as Error).message));
        process.exit(1);
      }
    });
}
