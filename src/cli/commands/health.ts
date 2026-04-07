import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { SessionManager } from '../../core/session.js';
import { WikiCompiler } from '../../core/compiler.js';
import type { HealthReport } from '../../types/index.js';

export function registerHealth(program: Command): void {
  program
    .command('health')
    .description('Check the health of the current knowledge base')
    .action(async () => {
      const spinner = ora('Running health check...').start();
      try {
        const session = await SessionManager.getActive();
        const report: HealthReport = await WikiCompiler.health(session);
        spinner.stop();
        console.log(chalk.bold(`\nHealth Score: ${report.score}/100`));
        console.log(`  Articles:  ${report.totalArticles}`);
        console.log(`  Sources:   ${report.totalSources}`);
        if (report.orphanedSources.length > 0) {
          console.log(chalk.yellow(
            `  Orphaned:  ${report.orphanedSources.length}`
          ));
        }
        if (report.suggestions.length > 0) {
          console.log(chalk.dim('\nSuggestions:'));
          report.suggestions.forEach((s) => console.log(chalk.dim(`  - ${s}`)));
        }
      } catch (error) {
        spinner.fail(chalk.red('Health check failed'));
        console.error(chalk.red((error as Error).message));
        process.exit(1);
      }
    });
}
