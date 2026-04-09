---
title: CLI Commands
tags: [cli, commander, entrypoint, public-api]
sources:
  - src/index.ts
  - src/cli/commands/new.ts
  - src/cli/commands/research.ts
  - src/cli/commands/add.ts
  - src/cli/commands/compile.ts
  - src/cli/commands/ask.ts
  - src/cli/commands/health.ts
  - src/cli/commands/sessions.ts
  - src/cli/commands/switch.ts
  - src/cli/commands/repo.ts
summary: Commander-based CLI entry point and the nine subcommand handlers that translate user intent into calls into the core engine.
---

# CLI Commands

This module is the front of the house: it owns `src/index.ts` and the nine command handlers under `src/cli/commands/`. Each file exports a single `registerX(program)` function that attaches one subcommand to the shared `commander` instance. The handlers are deliberately thin — they parse flags, validate input, call into the core engine, and print success/failure with `chalk` + `ora`. Real work lives in [[session-management]], [[content-pipeline]], and [[claude-runner]].

#cli #public-api

---

## Purpose

- Define the `vaultforge` / `vf` binary surface.
- Register every subcommand on a single `commander` `Command` instance.
- Translate CLI flags into the strongly-typed options objects that the core modules expect.
- Launch the TUI when the user runs the binary with no arguments.

The file `src/index.ts` is marked `#!/usr/bin/env node` and is wired to `bin.vaultforge` and `bin.vf` in `package.json`. Both binaries point at `dist/index.js` after `tsc` builds the project.

---

## Public API

`src/index.ts` exports nothing — it is an executable script. Its top-level behavior is:

```ts
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
registerRepo(program);

program
  .command('tui')
  .description('Launch the interactive TUI')
  .action(() => { launchTui(); });

if (process.argv.length <= 2) {
  launchTui();
} else {
  program.parse();
}
```

The zero-argument case is important: `vaultforge` with no flags drops straight into the TUI, which is the advertised user experience in the README.

Each command file exports exactly one function:

| Function | File | Subcommand | What it does |
|---|---|---|---|
| `registerNew` | `new.ts` | `new <topic>` | Calls `SessionManager.create(topic, {model})`. Spinner + green success line. |
| `registerResearch` | `research.ts` | `research <query>` | Calls `WikiCompiler.research(session, query, {maxSources, depth, onProgress: undefined})`. Streams progress via the default CLI printer in [[claude-runner]]. |
| `registerAdd` | `add.ts` | `add <url\|file>` | Calls `Ingestor.add(session, source)`. One-shot ingest, no stream. |
| `registerCompile` | `compile.ts` | `compile` | Calls `WikiCompiler.compile(session, {force})`. |
| `registerAsk` | `ask.ts` | `ask <question>` | Calls `WikiCompiler.ask(session, question)` and prints the returned answer. The answer is also saved by Claude to `outputs/<timestamp>-<slug>.md`. |
| `registerHealth` | `health.ts` | `health` | Calls `WikiCompiler.health(session)` and pretty-prints the parsed JSON `HealthReport`. |
| `registerSessions` | `sessions.ts` | `sessions` | Calls `SessionManager.list()` and prints a table of id, topic, vault path, updatedAt. |
| `registerSwitch` | `switch.ts` | `switch <id>` | Calls `SessionManager.switch(id)` which rewrites `~/.vaultforge/config.json`. |
| `registerRepo` | `repo.ts` | `repo` | Calls `RepoIngestor.ingest(process.cwd(), {depth, includeTests, force})`. |

The `version` and `description` strings shown by `--version` / `--help` come from `package.json`, loaded via `createRequire(import.meta.url)` because the project is ESM.

---

## Internal structure

Every command file is 20–45 lines and follows the same shape:

```ts
import { Command } from 'commander';
import chalk from 'chalk';
import { /* core module */ } from '../../core/…';

export function registerX(program: Command): void {
  program
    .command('name')
    .description('…')
    .option('--flag <value>', '…', 'default')
    .action(async (arg, opts) => {
      try {
        // 1. Validate flag values
        // 2. Build an options object matching a type in src/types/index.ts
        // 3. Call into the core module
        // 4. Print success
      } catch (error) {
        console.error(chalk.red(…));
        process.exit(1);
      }
    });
}
```

The `repo` handler is a representative example of flag validation. It rejects any `--depth` value that is not `shallow`, `normal`, or `deep`, and coerces `--include-tests` and `--force` into booleans before calling `RepoIngestor.ingest`. On failure it prints a red error line and exits with code 1.

None of the CLI handlers import from each other. The only shared code is `commander` and the `chalk`/`ora` styling. That keeps them trivially reviewable in isolation and makes it cheap to add a new subcommand.

---

## Dependencies

- [[session-management]] — `SessionManager.create`, `list`, `switch`, `getActive`
- [[content-pipeline]] — `WikiCompiler.research`, `compile`, `ask`, `health`; `Ingestor.add`; `RepoIngestor.ingest`
- [[claude-runner]] — indirectly: compile/research/ask/health/repo all end up calling `runClaude` without an `onProgress` callback, so progress events print themselves to stdout via `formatEventForTerminal`
- `commander`, `chalk`, `ora` — external packages

The CLI layer **never** calls `runClaude` directly. It always goes through a core-module helper. This is the same boundary the TUI respects, and it is what lets the TUI reuse the same command set without duplicating any logic.

---

## Example flow

`vaultforge repo --depth shallow` hits the following call path:

1. `program.parse()` dispatches into the action registered by `registerRepo`.
2. The handler validates `--depth`, then builds a `RepoIngestOptions` and calls `RepoIngestor.ingest(process.cwd(), options)`.
3. Inside [[content-pipeline]], `RepoIngestor.ingest` calls `scanRepo(cwd)` to collect `RepoInfo`, ensures `<repo>/wiki/{concepts,summaries,.vaultforge}` exists, writes `wiki/.vaultforge/session.json`, and invokes `runClaude(cwd, repoPrompt(repo, options), {stream: true, allowedTools: ['Read','Glob','Grep','Write','Edit']})`.
4. [[claude-runner]] spawns `claude` with `--output-format stream-json`, streams parsed `ProgressEvent`s to stdout via `chalk`, and resolves when the subprocess exits.
5. `RepoIngestor` calls `rebuildIndex(repoRoot, repo.name)` to deterministically regenerate `wiki/index.md`.
6. Back in the CLI handler, `console.log(chalk.green('\nRepo wiki ready at ./wiki/'))` prints the final success line.

---

## See Also

- [[architecture-overview]] — where this module sits in the system
- [[session-management]] — the state the CLI reads and writes
- [[content-pipeline]] — the work the CLI delegates to
- [[claude-runner]] — how subprocess progress reaches the terminal
