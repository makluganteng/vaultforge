---
title: Architecture Overview
tags: [architecture, overview, vaultforge]
sources:
  - src/index.ts
  - src/core/session.ts
  - src/core/claude-runner.ts
  - src/core/prompts.ts
  - src/core/compiler.ts
  - src/core/indexer.ts
  - src/core/ingestor.ts
  - src/core/repo-ingestor.ts
  - src/core/repo-scanner.ts
  - src/cli/commands/repo.ts
  - src/tui/app.tsx
  - src/types/index.ts
  - package.json
  - README.md
summary: High-level map of vaultforge — an LLM-powered knowledge base engine that drives Claude Code as a subprocess to research, compile, and maintain Obsidian-flavored Markdown wikis.
---

# Architecture Overview

`vaultforge` (package `@valentinofish/vaultforge`, CLI binaries `vaultforge` and `vf`) is a **thin TypeScript shell around the `claude` CLI**. It does not embed an LLM, does not maintain a vector store, and does not implement a RAG pipeline. Instead, it hands Claude Code a carefully-worded prompt, lets it use its built-in tools (`WebSearch`, `WebFetch`, `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`), and streams the resulting tool-use events back to the user. Everything Claude writes lands inside a **session directory** — a self-contained folder that doubles as an Obsidian vault.

This article is the front door to the wiki. For a given topic, follow the wikilinks to the module that owns it.

#architecture #vaultforge

---

## What the project does

Two workflows live under the same roof:

1. **Topic research workflow** — the historical purpose. A user runs `vaultforge new <topic>`, then `vaultforge research <query>`, and the tool spawns Claude with a prompt telling it to search the web, save raw sources to `raw/`, write concept articles to `wiki/concepts/`, and per-source summaries to `wiki/summaries/`. After Claude exits, a deterministic indexer rebuilds `wiki/index.md` as a Map of Content.
2. **Repository documentation workflow** — the new capability on the current branch. A user runs `vaultforge repo` inside a source code repo, and the tool inspects the repo, builds a repo-specific prompt, and asks Claude to document the codebase as an Obsidian wiki at `<repo>/wiki/`. The tool allowlist is narrowed to local file operations only (no `WebSearch`/`WebFetch`/`Bash`) because the task is purely local.

Both workflows converge on the same output format and the same indexer.

A third surface — the **interactive TUI dashboard** — is an `ink` (React-for-terminal) application that provides a sessions list, a wiki file browser, a Markdown preview pane, a force-directed graph view, and a REPL-style terminal. It is launched by running `vaultforge` with no arguments. The TUI reuses the same core modules as the CLI: commands typed into the terminal panel are parsed and dispatched back through the core pipeline.

---

## Major components

The codebase is organized into four directories under `src/`:

| Layer | Directory | Purpose |
|---|---|---|
| Entry + CLI | `src/index.ts`, `src/cli/commands/` | `commander`-based command registration and flag parsing |
| Core engine | `src/core/` | Session lifecycle, subprocess runner, prompt builders, wiki orchestration, indexer, repo scanning |
| TUI | `src/tui/` | `ink` React app: panels, components, wiki-file listing, graph layout, REPL runner |
| Shared | `src/types/`, `src/utils/` | Type definitions, `slugify`, `parseFrontmatter` |

The core engine is split into five modules that form the spine of the system, each covered by its own concept article:

- [[cli-commands]] — how `src/index.ts` wires up `commander` subcommands and how each command handler translates user intent into a core-module call
- [[session-management]] — `SessionManager` in `src/core/session.ts`: creates session directories under `~/.vaultforge/sessions/`, tracks the active session in `~/.vaultforge/config.json`, reads/writes `session.json`
- [[claude-runner]] — `runClaude` in `src/core/claude-runner.ts`: spawns `claude` via `execa`, parses line-delimited stream-json output, and dispatches structured `ProgressEvent`s
- [[prompts]] — pure functions in `src/core/prompts.ts` that build the text prompts for research, compile, ask, health, repo documentation, and URL fetch
- [[content-pipeline]] — the wiki-generation orchestrators: `WikiCompiler` (`src/core/compiler.ts`), `Ingestor` (`src/core/ingestor.ts`), `RepoIngestor` (`src/core/repo-ingestor.ts`), `scanRepo` (`src/core/repo-scanner.ts`), and `rebuildIndex` (`src/core/indexer.ts`)

The **TUI layer** (`src/tui/app.tsx`, `src/tui/panels/*`, `src/tui/components/*`, `src/tui/utils/*`) is not documented in its own concept article at this depth. In brief: `App` is the dashboard root with Tab-cycled focus management and four panels (`SessionsPanel`, `WikiPanel`, `PreviewPanel` / `GraphPanel`, `TerminalPanel`); `src/tui/utils/wiki-files.ts` walks `wiki/concepts/`, `wiki/summaries/`, and `outputs/` to produce typed `WikiFile` rows with backlink counts; `src/tui/utils/run-command.ts` owns the REPL parser that re-dispatches commands back to the core modules in-process rather than spawning new processes.

---

## End-to-end data flow

Here is what happens when a user runs `vaultforge research "perpetual funding rates"` on an existing session:

```
user                       CLI            core                 subprocess                 filesystem
 │                          │              │                        │                          │
 │─ vaultforge research ──▶ │              │                        │                          │
 │                          │─ register ──▶│                        │                          │
 │                          │              │─ getActive() ─────────────────────────────────────▶│
 │                          │              │◀──── session dir, config ─────────────────────────│
 │                          │              │─ researchPrompt(query) ▶│                          │
 │                          │              │─ runClaude(cwd, prompt)▶│                          │
 │                          │              │                        │─ execa('claude', …) ────▶│
 │                          │              │                        │◀── stream-json lines ────│
 │                          │              │◀── ProgressEvent{...} ─│                          │
 │                          │◀── printed ──│                        │                          │
 │                          │              │                        │─ WebSearch / WebFetch ──▶│
 │                          │              │                        │─ Write raw/*.md ────────▶│
 │                          │              │                        │─ Write wiki/concepts/*──▶│
 │                          │              │◀── result event ───────│                          │
 │                          │              │─ rebuildIndex() ───────────────────────────────────▶│
 │                          │              │                        │                          │─ wiki/index.md
```

Key facts about this flow:

- **Claude owns file I/O for content.** `vaultforge` never writes article bodies itself. The subprocess does, via `Write`/`Edit` tool calls. That is why every prompt reiterates the Obsidian frontmatter / wikilink / kebab-case / `## See Also` rules — they are the only contract `vaultforge` has with Claude about the wire format of the wiki.
- **`vaultforge` owns `wiki/index.md` deterministically.** After Claude exits, `rebuildIndex` (in [[content-pipeline]]) reads the YAML frontmatter of every file under `wiki/concepts/` and `wiki/summaries/`, then re-emits `wiki/index.md` as a Map of Content. Claude is explicitly told **not** to touch `index.md` in the repo prompt, for exactly this reason.
- **Structured progress streaming is the glue between Claude and the UI.** `claude --output-format stream-json --verbose` emits one JSON object per line (system init, assistant tool_use/text blocks, final result). [[claude-runner]] parses those lines into `ProgressEvent` objects (`kind: 'init' | 'tool' | 'text' | 'done'`) and either prints them with `chalk` (CLI mode) or dispatches them to a callback (TUI mode). The TUI renders them inline in the terminal panel and accumulates the cost field on `done` events.

The `repo` command follows the same shape but starts from `scanRepo(cwd)` (see [[content-pipeline]]), which records the primary language from manifest files, the git commit SHA and branch via `execa('git', ...)`, and whether a README exists. That `RepoInfo` is passed into `repoPrompt(repo, options)` (see [[prompts]]), and `runClaude` is invoked with a narrowed tool allowlist of just `[Read, Glob, Grep, Write, Edit]`.

---

## Session layout

Every session is a directory under `~/.vaultforge/sessions/<id>_<slug>/` with this shape (verbatim from the README):

```
~/.vaultforge/sessions/
  rp8dSImC_market-making-perps/
    CLAUDE.md              ← per-session instructions for the LLM
    session.json           ← metadata: topic, sources, state
    raw/                   ← original source files
    wiki/
      index.md             ← Map of Content, auto-rebuilt by vaultforge
      concepts/            ← concept articles with wikilinks + frontmatter
      summaries/           ← per-source summaries
    assets/                ← downloaded images
    outputs/               ← query outputs (saved by `vaultforge ask`)
```

`CLAUDE.md` is generated by `SessionManager.create` in [[session-management]] and is re-read by Claude on every invocation because `runClaude` is called with `cwd = session.dir`. That is how per-session instructions (topic, model, Obsidian rules) reach the model.

For the `repo` command the shape is different: there is no session directory under `~/.vaultforge/`. The wiki lives inside the repo at `<repo>/wiki/`, with a small metadata file at `<repo>/wiki/.vaultforge/session.json` containing `{type: 'repo', commitSha, branch, depth, includeTests, lastRun}`.

---

## Type surface

All shared types are declared in `src/types/index.ts`. The ones worth knowing:

- `SessionConfig` — `{id, topic, createdAt, updatedAt, sources: Source[], status}`. Persisted to `session.json`.
- `Source` — `{id, url?, filePath, type: 'web'|'pdf'|'file'|'markdown', title, addedAt}`. Tracked by `Ingestor.add`.
- `ActiveSession` — the wrapper the compiler and TUI pass around: `{config: SessionConfig, dir: string}`.
- `KbConfig` — the global config stored at `~/.vaultforge/config.json`: `{sessionsDir, activeSession, defaultModel}`.
- `ProgressEvent` — the discriminated union `kind: 'init'|'tool'|'text'|'done'` with optional `tool`, `detail`, `text`, `durationMs`, `costUsd`.
- `RepoInfo`, `RepoIngestOptions`, `RepoWikiMeta` — the repo-documentation types used by [[content-pipeline]].
- `HealthReport` — `{totalArticles, totalSources, orphanedSources, missingConcepts, suggestions, score}`.

No type lives outside this file. All core modules and TUI panels import from `src/types/index.js`.

---

## Dependencies at a glance

Runtime deps from `package.json`:

- `commander` — CLI command registration
- `execa` — spawning the `claude` subprocess
- `chalk` + `ora` — CLI output styling and spinners
- `ink`, `ink-select-input`, `ink-spinner`, `ink-text-input`, `react` — TUI dashboard
- `gray-matter` — YAML frontmatter parsing (via `src/utils/markdown.ts`)
- `nanoid` — 8-character session IDs

Build/dev: `typescript`, `tsx`, `vitest`, `eslint`, `@typescript-eslint/*`. Node ≥18, ESM throughout.

---

## See Also

- [[cli-commands]] — entry point and subcommand registration
- [[session-management]] — session lifecycle and `~/.vaultforge` config
- [[claude-runner]] — subprocess driver and stream-json parser
- [[prompts]] — pure prompt builders for every Claude invocation
- [[content-pipeline]] — compiler, ingestor, repo ingestor, indexer
