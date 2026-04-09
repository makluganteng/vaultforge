---
title: Prompts
tags: [prompts, pure-functions, llm, public-api]
sources:
  - src/core/prompts.ts
  - src/types/index.ts
summary: Pure functions that build the text prompts for every Claude invocation — research, compile, ask, health, URL fetch, and repo documentation. No I/O, no side effects.
---

# Prompts

`src/core/prompts.ts` is deliberately boring: it is a module of pure string-building functions. No imports from `node:fs`, no subprocess calls, no logging. Each function takes a small typed options object and returns a plain `string` that the [[claude-runner]] will pass as the `-p <prompt>` argument to the `claude` CLI.

Keeping prompts pure is a design choice. It means every prompt can be unit-tested by comparing the returned string against a snapshot. It also means the prompts are the **only** place where `vaultforge`'s opinionated wiki format is encoded — if you want to change the Obsidian rules, you change them here and nowhere else.

#prompts #public-api #llm

---

## Purpose

- Own the text that tells Claude what to do, file by file.
- Encode the Obsidian wiki contract (frontmatter, wikilinks, `## See Also`, kebab-case filenames) in one reusable block.
- Translate typed option objects (`ResearchOptions`, `CompileOptions`, `RepoIngestOptions`) into natural-language depth/force/test instructions.
- Provide the complete list of exclusion globs for the `repo` command so Claude does not wander into `node_modules/`, lockfiles, build artifacts, or image files.

---

## Public API

All exports are top-level functions that return `string`:

- `researchPrompt(query: string, options?: ResearchOptions): string` — builds the prompt for `vaultforge research`. Inserts `maxSources` (default 10) and a `depth` instruction (`shallow`/`normal`/`deep`, computed by the private `depthInstruction`).
- `compilePrompt(options?: CompileOptions): string` — builds the prompt for `vaultforge compile`. Branches on `options.force`: force mode rewrites every article, non-force mode skips sources already covered by a wiki article.
- `askPrompt(question: string, outputFile: string): string` — builds the prompt for `vaultforge ask`. Claude is told to read `wiki/index.md`, then the relevant concept/summary articles, synthesize an answer, and save the answer to `outputFile` with YAML frontmatter. Stdout gets the raw answer text (no markdown fences) so the CLI/TUI can echo it back to the user.
- `healthPrompt(): string` — builds the prompt for `vaultforge health`. Claude is told to audit the wiki for orphaned sources, missing concepts, broken links, and coverage gaps, and to print a JSON object matching the `HealthReport` shape exactly.
- `repoPrompt(repo: RepoInfo, options?: RepoIngestOptions): string` — builds the prompt for `vaultforge repo`. The largest of the builders. Composes a repository context block from `RepoInfo` (name, primary language, manifest files, README presence, commit SHA, branch), a per-depth instruction, the exclusions list, and the wikilink discipline rules.
- `fetchUrlPrompt(url: string, fileName: string): string` — builds the three-line prompt for `Ingestor.add` to fetch a single URL via `WebFetch` and save it as `raw/<fileName>`.

Module-private helpers (not exported): `depthInstruction`, `repoDepthInstruction`, and the constants `OBSIDIAN_RULES`, `OUTPUT_RULE`, `REPO_EXCLUDES_BASE`, `REPO_EXCLUDES_TESTS`.

---

## Internal structure

The file has three layers, bottom-up:

1. **Shared fragments.** `OBSIDIAN_RULES` (the array of bullets that enforces frontmatter, wikilinks, `## See Also`, kebab-case, and `#tag` syntax) and `OUTPUT_RULE` (a one-line "write files directly" instruction). Both are re-used by `researchPrompt` and `compilePrompt` so the wiki contract is never copy-pasted.
2. **Per-command builders.** `researchPrompt`, `compilePrompt`, `askPrompt`, `healthPrompt`, `fetchUrlPrompt`. Each one joins an array of strings with `'\n'`. This is the entire implementation strategy — no templating, no conditionals buried inside f-strings, just an array of bullet lines.
3. **Repo-mode builder.** `repoPrompt` is larger because the `vaultforge repo` workflow has much stronger requirements: strict wikilink discipline, per-depth file-count rules, an exclusions block, and a runtime-numbers warning. It reuses the same `[...lines].join('\n')` pattern but with significantly more content.

The `REPO_EXCLUDES_BASE` constant is the canonical list of paths Claude should never read during repo documentation: `node_modules/`, `dist/`, `build/`, `.git/`, `.venv/`, lockfiles, binary artifacts (`*.wasm`, `*.so`, `*.exe`), images (`*.png`, `*.svg`), archives, and more. `REPO_EXCLUDES_TESTS` adds `test/`, `tests/`, `__tests__/`, `*.test.*`, `*.spec.*` — only appended when `includeTests` is false.

---

## Dependencies

- `src/types/index.ts` — for `ResearchOptions`, `CompileOptions`, `RepoIngestOptions`, `RepoInfo`.

Nothing else. Not even `node:path`. This module has zero runtime dependencies, which is why it can be consumed from both the CLI handlers and the TUI REPL without worrying about startup cost or platform concerns.

---

## Example flow

When the `repo` CLI handler runs on the current repository at depth `shallow`:

```ts
const repo: RepoInfo = {
  absPath: '/Users/…/kb-cli',
  name: 'kb-cli',
  primaryLanguage: 'JavaScript/TypeScript',
  manifestFiles: ['package.json'],
  hasReadme: true,
  commitSha: 'f8c04692…',
  branch: 'v/add-a-repository-to-wiki-functionality',
};

const prompt = repoPrompt(repo, { depth: 'shallow', includeTests: false, force: false });
await runClaude(repo.absPath, prompt, {
  stream: true,
  allowedTools: ['Read', 'Glob', 'Grep', 'Write', 'Edit'],
});
```

`repoPrompt` walks through roughly the following sections:

1. A one-paragraph mission statement ("document a local code repository as an Obsidian wiki").
2. The **Repository** block reflecting the `RepoInfo` fields — name, language, manifest files, README flag, commit SHA, branch.
3. Eight numbered step-by-step instructions: read README, map the code layout with Glob, read strategically, skip existing articles unless `--force`, write concept articles with the required frontmatter and sections, write an architecture overview, write per-file summaries when the depth rule requires it, and do NOT touch `wiki/index.md`.
4. A **Wikilink discipline (CRITICAL)** block that tells Claude to plan the full set of filenames up front and only link to files it is actually writing. Dead wikilinks are explicitly called out as worse than no link.
5. The per-depth rule from `repoDepthInstruction`: for shallow, write only `architecture-overview.md` plus up to 5 concept articles.
6. The exclusions block, with `includeTests=false` so the test-path globs are included.
7. The Obsidian formatting rules.
8. The code-snippet rules, including the "do not fabricate runtime numbers" instruction — Claude must use placeholders like `<duration>` and `<cost>` in example output rather than inventing values.

The resulting string is a few hundred lines long but is produced synchronously with zero I/O. That makes it safe to call from any context, including hot paths in the TUI.

---

## See Also

- [[architecture-overview]] — where prompts sit in the pipeline
- [[claude-runner]] — consumer of every prompt built here
- [[content-pipeline]] — the orchestrators that assemble options objects and then call these builders
- [[cli-commands]] — source of the user-facing flags that become options
