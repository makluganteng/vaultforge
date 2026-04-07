#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'node:module';
import { registerNew } from './cli/commands/new.js';
import { registerResearch } from './cli/commands/research.js';
import { registerAdd } from './cli/commands/add.js';
import { registerCompile } from './cli/commands/compile.js';
import { registerAsk } from './cli/commands/ask.js';
import { registerHealth } from './cli/commands/health.js';
import { registerSessions } from './cli/commands/sessions.js';
import { registerSwitch } from './cli/commands/switch.js';
import { launchTui } from './tui/index.js';

const require = createRequire(import.meta.url);
const { version, description } = require('../package.json');

const program = new Command();

program
  .name('vaultforge')
  .version(version)
  .description(description);

registerNew(program);
registerResearch(program);
registerAdd(program);
registerCompile(program);
registerAsk(program);
registerHealth(program);
registerSessions(program);
registerSwitch(program);

program
  .command('tui')
  .description('Launch the interactive TUI')
  .action(() => {
    launchTui();
  });

if (process.argv.length <= 2) {
  launchTui();
} else {
  program.parse();
}
