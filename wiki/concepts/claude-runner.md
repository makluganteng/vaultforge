---
title: Claude Runner
tags: [subprocess, stream-json, claude, public-api]
sources:
  - src/core/claude-runner.ts
  - src/types/index.ts
summary: Spawns the `claude` CLI as a subprocess, parses its line-delimited stream-json output into typed `ProgressEvent`s, and delivers them either to stdout or to a caller-provided callback.
---

# Claude Runner

`src/core/claude-runner.ts` is the single choke point between `vaultforge` and Claude Code. Everywhere else in the codebase that wants an LLM action — research, compile, ask, health, ingest, repo documentation — calls `runClaude(cwd, prompt, opts)`. Nothing else in the core talks to `execa` or the `claude` binary directly.

#subprocess #public-api

---

## Purpose

- Spawn the `claude` CLI as a subprocess inside a given working directory.
- Build the argv with `-p <prompt>`, `--dangerously-skip-permissions`, `--allowedTools <csv>`, and (optionally) `--output-format stream-json --verbose`.
- Parse Claude's line-delimited JSON output into typed `ProgressEvent`s.
- Deliver those events either:
  - To a caller-provided `onProgress` callback (used by the TUI panels so they can render tool-use events inline in the terminal log), OR
  - Printed to stdout with `chalk` formatting (used by the CLI subcommands).
- Return the final assistant `result` text so callers like `WikiCompiler.ask` and `Ingestor.add` can use it as a return value.
- Capture `stderr` into a buffer and print the last 2 KB if the subprocess errors — only when running in CLI mode, never when a TUI `onProgress` handler is wired up (the TUI would scramble its layout otherwise).

---

## Public API

Exported from the module:

- `runClaude(cwd: string, prompt: string, opts?: RunOptions): Promise<string>` — the one-and-only entry point. Returns the final assistant result text.
- `RunOptions` — shape of the options object:
  - `stream?: boolean` — if true, passes `--output-format stream-json --verbose` to Claude and parses events.
  - `onProgress?: (event: ProgressEvent) => void` — subscribe to parsed events. When provided, events are NOT printed to stdout; the caller is fully responsible for rendering.
  - `timeoutMs?: number` — overrides the default 10-minute timeout.
  - `allowedTools?: string[]` — overrides the default tool allowlist.

The `ProgressEvent` type is declared in `src/types/index.ts`:

```ts
interface ProgressEvent {
  kind: 'init' | 'tool' | 'text' | 'done';
  tool?: string;            // Tool name when kind === 'tool'
  detail?: string;          // Argument summary (file path, query, …)
  text?: string;            // Assistant text snippet when kind === 'text'
  durationMs?: number;      // Present on 'done'
  costUsd?: number;         // Present on 'done'
}
```

Nothing else is exported. `parseStreamLine`, `formatEventForTerminal`, `summarizeToolInput`, and the `StreamLine` internal interface are module-private.

---

## Internal structure

The file is a single flat module with five named pieces:

1. **Constants** — `DEFAULT_ALLOWED_TOOLS = ['WebSearch', 'WebFetch', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash']` and `DEFAULT_TIMEOUT_MS = 600_000` (10 minutes).
2. **`summarizeToolInput(name, input)`** — converts a tool's raw input object into a short one-line summary. For `WebSearch`/`Glob`/`Grep` it reads `input.query` or `input.pattern`; for `WebFetch` it reads `input.url`; for `Read`/`Write`/`Edit` it reads `input.file_path` and strips the current working directory prefix so TUI output stays short; for `Bash` it slices `input.command` to 70 characters. These summaries become the `detail` field on emitted tool events.
3. **`parseStreamLine(line)`** — takes one parsed JSON object from Claude's output and yields zero or more `ProgressEvent`s. It understands three line types:
   - `{type: 'system', subtype: 'init'}` → one `{kind: 'init'}` event.
   - `{type: 'assistant', message: {content: [...]}}` → one event per content block, either `{kind: 'tool', tool, detail}` or `{kind: 'text', text}` (text is trimmed to the first line, sliced to 100 chars).
   - `{type: 'result', duration_ms, total_cost_usd}` → one `{kind: 'done', durationMs, costUsd}` event, and the `result` field is captured into `resultText` to be returned to the caller.
4. **`formatEventForTerminal(event)`** — CLI-mode pretty printer. Uses `chalk.cyan`/`chalk.dim`/`chalk.green` to produce strings like `  → WebSearch  funding rates` or `  ✓ Done <duration> <cost>`. Only called when `onProgress` is NOT provided.
5. **`runClaude(cwd, prompt, opts)`** — the exported driver. Composes the argv, spawns `execa('claude', args, {cwd, timeout, stdin: 'ignore', env: {...process.env, CLAUDE_CODE_ENTRYPOINT: 'cli'}})`, and — when `stream` is true — consumes `subprocess.stdout` through a `readline.createInterface({crlfDelay: Infinity})` loop.

The env variable `CLAUDE_CODE_ENTRYPOINT: 'cli'` is set so Claude Code knows it is being invoked as a subprocess, not interactively. This is how the runner signals "don't paint a prompt UI."

---

## Dependencies

- `execa` — subprocess with Promise + streaming semantics.
- `node:readline` — line-by-line consumption of `subprocess.stdout`.
- `chalk` — CLI colour output.
- `src/types/index.ts` — for the `ProgressEvent` type.

No dependency on any other `src/core/` file. This is the **bottom of the dependency graph**: every other core module imports from here, but this one imports from nothing except `types/` and external packages. That is deliberate — it keeps the subprocess contract in one place and makes the runner trivially unit-testable in isolation.

---

## Example flow

When the TUI terminal panel runs `research "perpetual dex funding"`:

```ts
await runClaude(session.dir, researchPrompt(query, options), {
  stream: true,
  onProgress: (event) => setLog((prev) => [...prev, { kind: 'event', event }]),
});
```

Inside `runClaude`:

1. `args = ['-p', '<prompt>', '--dangerously-skip-permissions', '--allowedTools', 'WebSearch,WebFetch,Read,Write,Edit,Glob,Grep,Bash', '--output-format', 'stream-json', '--verbose']`.
2. `subprocess = execa('claude', args, {cwd: session.dir, timeout: 600_000, env: {...}})`.
3. `stderr` is piped into `stderrBuffer` via `subprocess.stderr.on('data', …)`.
4. A `readline` loop consumes `subprocess.stdout` line by line. Each non-empty line is `JSON.parse`'d; parse failures are silently skipped (Claude occasionally emits non-JSON diagnostics).
5. Every `StreamLine` is fed through `parseStreamLine`. For each returned event, because `opts.onProgress` is set, the callback is invoked — the CLI printer is NOT touched.
6. When a `type: 'result'` line arrives, `resultText = line.result ?? ''` captures the final assistant text.
7. `await subprocess` resolves when the child exits. If it rejected, the runner dumps the last 2 KB of stderr (but only when `onProgress` is absent — otherwise the TUI would break) and re-throws. Otherwise `resultText || finalResult.stdout` is returned.

For CLI callers, the same loop runs with `onProgress` undefined and events are written straight to `console.log(formatEventForTerminal(event))` so the user sees a live stream of tool calls in the terminal.

---

## See Also

- [[architecture-overview]] — where the runner sits in the system
- [[prompts]] — the prompt strings passed as the `-p` argument
- [[content-pipeline]] — the primary caller of `runClaude`
- [[cli-commands]] — the CLI surface that triggers runs in non-stream CLI mode
