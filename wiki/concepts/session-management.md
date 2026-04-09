---
title: Session Management
tags: [sessions, state, persistence, public-api]
sources:
  - src/core/session.ts
  - src/types/index.ts
summary: Owns the session lifecycle — creation, listing, switching, active-session lookup — and the global config at ~/.vaultforge/config.json.
---

# Session Management

`src/core/session.ts` is where `vaultforge` persists **everything** it needs across invocations. It exports a single object, `SessionManager`, whose methods create new sessions on disk, list them, switch the active one, and look up the current active session for callers.

Sessions are the unit of isolation in `vaultforge`. Every topic lives in its own directory under `~/.vaultforge/sessions/<id>_<slug>/`, which doubles as an Obsidian vault. Two sessions never share raw sources, concept articles, or outputs.

#state #persistence #public-api

---

## Purpose

- Create a new session directory with the full `raw/ wiki/ assets/ outputs/` shape.
- Write per-session `CLAUDE.md` and `session.json` metadata.
- Write an empty `wiki/index.md` placeholder MOC that [[content-pipeline]] will later overwrite via `rebuildIndex`.
- List all sessions on disk and sort by `updatedAt` descending.
- Track which session is "active" in `~/.vaultforge/config.json` so subsequent commands can resolve it without the user passing `--session`.
- Throw actionable errors when the active session is missing or when switching to a nonexistent id.

---

## Public API

The module exports one frozen object, `SessionManager`, with these methods:

- `create(topic: string, options?: { model?: string }): Promise<SessionConfig & { path: string }>` — creates a new session directory, writes all metadata files, sets the new session as active, and returns the full `SessionConfig` plus the absolute `path` to the session directory. Uses `nanoid(8)` for the id and `slugify(topic, 40)` (from `src/utils/text.ts`) for the folder suffix.
- `list(): Promise<Array<SessionConfig & { dir: string }>>` — enumerates `~/.vaultforge/sessions/`, reads every `session.json`, silently skips malformed entries, and sorts the results by `updatedAt` descending. Returns an empty array if the sessions directory doesn't exist yet.
- `switch(id: string): Promise<SessionConfig>` — throws if the id is not in the list; otherwise updates `config.activeSession` in the global config and returns the session (without the `dir` field).
- `getActive(): Promise<{ config: SessionConfig; dir: string }>` — the primary way callers obtain the current session. Throws with a helpful hint if no active session is set or if the active id points at a directory that no longer exists on disk.
- `getActiveId(): Promise<string | null>` — lightweight version of `getActive` that does not read any session file; used by the TUI when it just needs to highlight the active row.
- `getConfig(): Promise<KbConfig>` — reads `~/.vaultforge/config.json`, creating it with defaults on first run.
- `saveConfig(config: KbConfig): Promise<void>` — writes the global config back.

The `SessionConfig`, `KbConfig`, and `ActiveSession` types are declared in `src/types/index.ts`.

---

## Internal structure

All state lives under the constant:

```ts
const VAULTFORGE_DIR = join(homedir(), '.vaultforge');
const CONFIG_PATH = join(VAULTFORGE_DIR, 'config.json');
```

On first run `getConfig` lazily creates `~/.vaultforge/` and writes a default `KbConfig`:

```ts
{
  sessionsDir: '~/.vaultforge/sessions',
  activeSession: null,
  defaultModel: 'claude-sonnet-4',
}
```

`create` is the heaviest method in the file. It does six things in order:

1. Load the global config (creating it if missing).
2. Build `dirName = nanoid(8) + '_' + slugify(topic, 40)` and resolve `sessionDir = join(config.sessionsDir, dirName)`.
3. `Promise.all` six `mkdir(..., { recursive: true })` calls to create `sessionDir` itself plus `raw/`, `wiki/concepts/`, `wiki/summaries/`, `assets/`, and `outputs/`.
4. Build the `SessionConfig` record with `createdAt = updatedAt = new Date().toISOString()` and empty `sources`.
5. Assemble the `CLAUDE.md` body — a per-session instructions file that reiterates the Obsidian formatting rules and pins the model. This is the file Claude auto-reads when started with `cwd = session.dir`, so it is how per-session rules reach the model.
6. Assemble an empty `wiki/index.md` placeholder ("No articles yet. Run `vaultforge research` to get started.") and write `session.json`, `CLAUDE.md`, and `wiki/index.md` via one `Promise.all`.

Finally, `config.activeSession = id` is set and the config is written back.

`list` is simpler: it enumerates the `sessionsDir`, tries to `readFile(join(dir, 'session.json'))` on each entry, skips on failure, and returns the parsed `SessionConfig`s sorted by `updatedAt`.

`getActive` composes `getConfig()` and `list()`: if `activeSession` is null, throws; otherwise finds the matching row, destructures `{dir, ...config}`, and returns `{config, dir}`.

Every method is an async function declared at module scope. `SessionManager` at the bottom of the file is just a plain object literal exporting them as `{create, list, switch: switchSession, getActive, getActiveId, getConfig, saveConfig}`.

---

## Dependencies

- `node:fs/promises` — `mkdir`, `readdir`, `readFile`, `writeFile`.
- `node:path` — `join`.
- `node:os` — `homedir`.
- `nanoid` — 8-character session ids.
- `src/utils/text.ts` — `slugify(topic, 40)` for the folder suffix.
- `src/types/index.ts` — for `KbConfig`, `SessionConfig`.

No dependency on any other `src/core/` module. Like [[claude-runner]], `SessionManager` sits near the bottom of the graph so that callers higher up can assemble it with the other pieces.

Downstream consumers:

- [[cli-commands]] — `registerNew`, `registerSessions`, `registerSwitch` call `create`, `list`, `switch` directly; every other command calls `getActive()` to resolve the session before delegating to [[content-pipeline]].
- TUI — `src/tui/app.tsx` calls `SessionManager.list` + `SessionManager.getActive` on every refresh and routes the `new`/`switch` REPL commands through `SessionManager.create`/`SessionManager.switch`.

---

## Example flow

`vaultforge new "perpetual futures market making" --model claude-sonnet-4` runs the following sequence:

```ts
// registerNew handler
const session = await SessionManager.create(topic, options);

// Inside SessionManager.create:
const config = await getConfig();                    // reads or seeds ~/.vaultforge/config.json
const id = nanoid(8);                                // e.g. 'rp8dSImC'
const slug = slugify(topic, 40);                     // 'perpetual-futures-market-making'
const sessionDir = join(config.sessionsDir, `${id}_${slug}`);

await Promise.all([
  mkdir(sessionDir, { recursive: true }),
  mkdir(join(sessionDir, 'raw'), { recursive: true }),
  mkdir(join(sessionDir, 'wiki', 'concepts'), { recursive: true }),
  mkdir(join(sessionDir, 'wiki', 'summaries'), { recursive: true }),
  mkdir(join(sessionDir, 'assets'), { recursive: true }),
  mkdir(join(sessionDir, 'outputs'), { recursive: true }),
]);

// …build session, CLAUDE.md, index.md…

await Promise.all([
  writeFile(join(sessionDir, 'session.json'), JSON.stringify(session, null, 2)),
  writeFile(join(sessionDir, 'CLAUDE.md'), claudeMd),
  writeFile(join(sessionDir, 'wiki', 'index.md'), indexMd),
]);

config.activeSession = id;
await saveConfig(config);

return { ...session, path: sessionDir };
```

The caller gets back a session record plus the absolute path. After that, any subsequent `vaultforge research`, `vaultforge ask`, or `vaultforge compile` will resolve the active session via `getActive()` and pass `session.dir` into `runClaude` as the subprocess `cwd`. That is how `CLAUDE.md` and the wiki files reach the model without any explicit plumbing.

---

## See Also

- [[architecture-overview]] — where session state fits in the system
- [[cli-commands]] — the CLI surface that exposes `new`/`sessions`/`switch`
- [[content-pipeline]] — the downstream consumer of `ActiveSession`
- [[claude-runner]] — called by downstream consumers with `session.dir` as cwd
