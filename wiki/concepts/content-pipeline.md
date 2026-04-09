---
title: Content Pipeline
tags: [pipeline, compiler, indexer, ingestor, repo, public-api]
sources:
  - src/core/compiler.ts
  - src/core/ingestor.ts
  - src/core/repo-ingestor.ts
  - src/core/repo-scanner.ts
  - src/core/indexer.ts
  - src/types/index.ts
summary: The wiki-generation orchestrators — `WikiCompiler`, `Ingestor`, `RepoIngestor`, `scanRepo`, and `rebuildIndex` — that turn user commands into subprocess calls and then deterministically rebuild the Map of Content.
---

# Content Pipeline

This article covers the five files that sit between [[cli-commands]]/[[session-management]] on one side and [[claude-runner]]/[[prompts]] on the other. They are the orchestrators: they assemble prompts with [[prompts]], hand them to [[claude-runner]], and after the subprocess finishes they deterministically rewrite `wiki/index.md` from the files Claude wrote.

There are **two entry shapes** into this pipeline:

- **Session-based commands** (`research`, `compile`, `ask`, `health`, `add`) go through `WikiCompiler` or `Ingestor` and operate inside a `~/.vaultforge/sessions/<id>_<slug>/` directory.
- **Repo-based commands** (`repo`) go through `RepoIngestor` and operate inside the user's own source repository at `<cwd>/wiki/`.

Both shapes end with a call to `rebuildIndex`, which is the only file in the pipeline that `vaultforge` writes itself. Everything else on disk is written by Claude via `Write`/`Edit` tool calls.

#pipeline #public-api

---

## Purpose

- Provide a stable, typed API (`WikiCompiler`, `Ingestor`, `RepoIngestor`) that [[cli-commands]] and the TUI can call without knowing anything about `execa`, argv construction, or stream-json parsing.
- Own the subprocess `cwd`: always pass either `session.dir` or the repo root, so Claude's tool calls are scoped correctly and `CLAUDE.md` is picked up automatically.
- Deterministically rebuild `wiki/index.md` after every run, so the MOC stays in sync with the actual files on disk regardless of what Claude did or skipped.
- For the `repo` workflow: detect language, manifest files, git commit/branch, and README presence before the subprocess starts, so the prompt has real repository context to work with.

---

## Public API

### `WikiCompiler` (`src/core/compiler.ts`)

A plain object export with four methods:

- `research(session, query, options?)` — calls `runClaude` with `researchPrompt(query, options)`, streams progress events, then calls `rebuildIndex(session.dir, session.config.topic)`. Returns `void`.
- `compile(session, options?)` — same shape but with `compilePrompt(options)`. Honors `options.force` to rewrite every article.
- `ask(session, question, options?)` — builds the output file path from a timestamp and `slugify(question, 40)`, ensures `outputs/` exists, and calls `runClaude` with `askPrompt(question, outputFile)`. Streams only when `onProgress` is provided. Returns the final answer text so the CLI/TUI can echo it.
- `health(session)` — calls `runClaude` without streaming, finds the first `{...}` JSON blob in the result, parses it, and returns a `HealthReport`. Throws `'Health check returned invalid output: no JSON found'` if parsing fails.

Each method takes an optional `{onProgress}` callback. When present, events are routed to the TUI; when absent, [[claude-runner]] prints them to stdout via `chalk`.

### `Ingestor` (`src/core/ingestor.ts`)

A plain object with one method:

- `add(session, source)` — single-source ingest. Detects whether the source is a URL (`/^https?:\/\//i`) or a local file:
  - **URL**: calls `runClaude` with `fetchUrlPrompt(url, fileName)` and a restricted tool allowlist of `['WebFetch','Read','Write','Bash']` plus a 3-minute timeout, captures the returned title.
  - **Local file**: `copyFile` into `raw/<slug>.<ext>`, uses the original basename as the title.
  
  Appends a `Source` record to `session.config.sources` and writes the updated `session.json` back to disk. Returns the new `Source`.

### `RepoIngestor` (`src/core/repo-ingestor.ts`)

A plain object with one method:

- `ingest(repoRoot, options?)` — the entry point for the `vaultforge repo` command. Calls `scanRepo(repoRoot)` to collect `RepoInfo`, prints a three-line status header (when not in TUI mode), ensures `<repo>/wiki/{concepts,summaries,.vaultforge}` exists via `ensureWikiLayout`, writes the repo metadata file at `<repo>/wiki/.vaultforge/session.json`, then calls `runClaude(repoRoot, repoPrompt(repo, options), {stream: true, onProgress, allowedTools: REPO_ALLOWED_TOOLS})` with **`REPO_ALLOWED_TOOLS = ['Read','Glob','Grep','Write','Edit']`** — crucially, no `WebSearch`/`WebFetch`/`Bash`. Finishes with `rebuildIndex(repoRoot, repo.name)`. Returns the `RepoInfo`.

### `scanRepo(cwd)` (`src/core/repo-scanner.ts`)

A single exported async function that returns a `RepoInfo` for a directory. It checks a prioritized list of manifest files (`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `setup.py`, `requirements.txt`, `Gemfile`, `composer.json`, `pom.xml`, `build.gradle`, `build.gradle.kts`, `mix.exs`) to infer `primaryLanguage`, checks for `README.md`/`README.rst`/`README.txt`/`README`, and runs `git rev-parse HEAD` + `git rev-parse --abbrev-ref HEAD` (both with `reject: false` via `execa`) to capture commit SHA and branch. Detached HEAD is reported as `branch: undefined`. Does NOT enumerate source files — Claude's `Glob` tool does that during ingestion.

### `rebuildIndex(sessionDir, topic)` (`src/core/indexer.ts`)

The deterministic MOC rebuilder. Reads every `.md` file under `wiki/concepts/` and `wiki/summaries/`, parses their frontmatter (`title`, `summary`, `tags`) via `parseFrontmatter` from `src/utils/markdown.ts`, aggregates the set of all tags, and writes a brand-new `wiki/index.md` with:

1. A `# ${topic}` header
2. An auto-generated disclaimer line
3. A stats line: `**<n>** concepts · **<n>** sources · **<n>** tags`
4. A `## Concepts` section listing `- [[concepts/${file}|${title}]] — ${summary}` for each concept, sorted by title
5. A `## Summaries` section listing `- [[summaries/${file}|${title}]]`
6. A `## Tags` section listing the union of all tags as `#tag` inline tags

Malformed files and files without frontmatter are silently skipped. `wiki/index.md` is always overwritten, never merged — this is why [[prompts]] instructs Claude explicitly **not** to touch `index.md` for the repo flow.

---

## Internal structure

The five files fit together like this:

```
cli-commands / tui         ← callers
      │
      ▼
┌──────────────────┐   ┌──────────────────┐
│ WikiCompiler     │   │ RepoIngestor     │
│ (compiler.ts)    │   │ (repo-ingestor…) │
└────┬──────┬──────┘   └────┬───────┬─────┘
     │      │               │       │
     │      │        scanRepo       │
     │      │       (repo-scanner)  │
     │      │                       │
     │      └────────────┬──────────┘
     │                   │
     ▼                   ▼
  prompts          claude-runner  ─── spawns `claude` subprocess
                       │
                       ▼
                 rebuildIndex
                  (indexer.ts)     ─── writes wiki/index.md
```

`Ingestor` (`ingestor.ts`) sits off to the side — it is used by the `add` command and also by `research` indirectly (Claude's own `WebFetch` calls don't go through `Ingestor`; only explicit single-source adds do). `Ingestor.add` is the **only** place in the codebase besides `RepoIngestor` and `WikiCompiler` that calls `runClaude`.

All five files import from [[claude-runner]], [[prompts]], [[session-management]] (via `ActiveSession` / `Source` types), and `src/types/index.ts`. None of them import from each other except:

- `compiler.ts` → `indexer.ts` (to call `rebuildIndex`)
- `repo-ingestor.ts` → `indexer.ts` (same) and `repo-scanner.ts` (to call `scanRepo`)

---

## Dependencies

- [[claude-runner]] — every method that talks to Claude funnels through here
- [[prompts]] — every prompt string is built here, never inline
- [[session-management]] — provides the `ActiveSession` shape and `session.dir`
- `gray-matter` (via `src/utils/markdown.ts`) — YAML frontmatter parsing for `rebuildIndex`
- `execa` (via `repo-scanner.ts`) — `git rev-parse` probes
- `nanoid` — source ids in `Ingestor.add`
- `chalk` — status lines when not in TUI mode

External consumers:

- [[cli-commands]] — the eight command handlers that expose this pipeline
- `src/tui/utils/run-command.ts` — the TUI REPL parser that re-dispatches `research`, `compile`, `ask`, `add`, `health` back through `WikiCompiler` and `Ingestor`

---

## Example flow

Here is the full call path for `vaultforge repo --depth shallow` running on the current repo:

1. `registerRepo` validates flags and calls `RepoIngestor.ingest(process.cwd(), {depth: 'shallow', includeTests: false, force: false})`.
2. `RepoIngestor.ingest` calls `scanRepo(cwd)`. That function `stat`s `cwd`, walks the `LANGUAGE_MANIFESTS` list until it finds `package.json` (giving `primaryLanguage = 'JavaScript/TypeScript'`), looks for a README, and runs two `git rev-parse` subprocesses in parallel.
3. `ensureWikiLayout` calls `mkdir({recursive: true})` on `wiki/`, `wiki/concepts/`, `wiki/summaries/`, and `wiki/.vaultforge/`.
4. `writeMetadata` writes `<repo>/wiki/.vaultforge/session.json` with `{type: 'repo', name, primaryLanguage, commitSha, branch, depth, includeTests, lastRun}`.
5. `runClaude(repoRoot, repoPrompt(repo, options), {stream: true, allowedTools: ['Read','Glob','Grep','Write','Edit']})` spawns the subprocess. Progress events print via the default CLI printer in [[claude-runner]].
6. Claude reads the README, globs the `src/**/*.ts` tree, reads a small set of representative files, and writes 1-5 concept articles to `wiki/concepts/`. It is explicitly told not to touch `wiki/index.md`.
7. `rebuildIndex(repoRoot, repo.name)` reads every `.md` under `wiki/concepts/` and `wiki/summaries/`, sorts by title, and writes a fresh `wiki/index.md` with grouped wikilinks and the tag union.
8. Control returns to `registerRepo`, which prints `Repo wiki ready at ./wiki/` in green.

The `research` flow is identical in shape but uses `WikiCompiler.research` and the default tool allowlist (which includes `WebSearch`/`WebFetch`).

---

## See Also

- [[architecture-overview]] — where this pipeline sits in the system
- [[claude-runner]] — the subprocess driver every orchestrator calls
- [[prompts]] — the prompt builders every orchestrator calls
- [[session-management]] — the source of `ActiveSession` for session-based commands
- [[cli-commands]] — the CLI surface that invokes this pipeline
