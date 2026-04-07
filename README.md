# kb

> An LLM-powered personal knowledge base engine. Give it a topic — it researches, compiles, and maintains a full Markdown wiki for you. Autonomously.

Built on top of [Claude Code](https://claude.ai/code). Viewed in [Obsidian](https://obsidian.md).

---

## The idea

Most note-taking tools make you the editor. You read the sources, you write the articles, you maintain the graph. **kb inverts this.** You supply the topic. Claude does the rest — searching the web, downloading files, writing wiki articles, answering questions, linting for gaps — and files everything back into a structured Markdown wiki that compounds over time.

No RAG pipeline. No vector database. Just a well-structured index and Claude reading what it needs.

---

## How it works

```
kb research "perpetual DEX funding rates"
```

1. **Search** — Claude searches the web for top sources on the topic
2. **Fetch** — WebFetch pulls each URL, converts HTML to Markdown
3. **Save** — Each source is written to `raw/` as a Markdown file
4. **Compile** — Claude writes wiki articles, concept pages, and per-source summaries with Obsidian wikilinks
5. **Index** — `wiki/index.md` is auto-rebuilt as a Map of Content with all articles, summaries, and tags
6. **Query** — Ask anything; Claude reads the index and pulls relevant articles
7. **File back** — Q&A outputs are saved to `outputs/`

Every query compounds the wiki. Nothing gets lost.

---

## Installation

```bash
# Requirements: Node.js 18+, Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Clone and install kb
git clone <this-repo>
cd kb-cli
npm install
npm run build
npm link        # makes the `kb` command available globally
```

---

## Commands

| Command | Description |
|---|---|
| `kb` | Launch the interactive TUI (default when no args) |
| `kb tui` | Launch the interactive TUI explicitly |
| `kb new <topic>` | Create a new isolated session |
| `kb research <query>` | Auto-search, fetch, and compile wiki articles |
| `kb add <url\|file>` | Ingest a single source into the session |
| `kb compile` | Rebuild the full wiki from `raw/` |
| `kb ask "<question>"` | Q&A against the wiki |
| `kb health` | Lint the wiki — find gaps, suggest articles |
| `kb sessions` | List all sessions with vault paths |
| `kb switch <id>` | Switch active session |

### Common options

- `kb research <query> --max-sources 10 --depth normal` — `depth` is `shallow`, `normal`, or `deep`
- `kb compile --force` — recompile every article from scratch
- `kb new <topic> --model claude-sonnet-4` — pin a specific model

---

## TUI

Run `kb` with no arguments to launch the interactive TUI. Built with [ink](https://github.com/vadimdemedes/ink) (React for the terminal). Navigate with arrow keys, Enter to select, Escape to go back.

```
 kb — Knowledge Base CLI
 Session: market making perps [rp8dSImC]
 ─────────────────────────────
 ❯ New Session
   Research
   Add Source
   Ask a Question
   Compile Wiki
   Health Check
   Browse Sessions
   Exit
```

---

## Session structure

Each session is a self-contained directory at `~/.kb/sessions/<id>_<slug>/`. Open it as an Obsidian vault.

```
~/.kb/sessions/
  rp8dSImC_market-making-perps/
    CLAUDE.md              ← Claude Code brain for this session
    session.json           ← metadata: topic, sources, state
    raw/                   ← original source files (.md, .pdf, .html)
    wiki/
      index.md             ← Map of Content, auto-rebuilt by kb
      concepts/            ← concept articles with wikilinks + frontmatter
      summaries/           ← per-source summaries
    assets/                ← downloaded images
    outputs/               ← query outputs (saved by `kb ask`)
```

Sessions never share data. Switch between topics instantly with `kb switch`.

### Obsidian formatting

Every article has:

- **YAML frontmatter** — `title`, `tags`, `sources`, `summary`, `created`, `updated`
- **Obsidian wikilinks** — `[[concept-name]]` for cross-references between articles
- **Inline tags** — `#tag` syntax for in-body tagging
- **`## See Also` sections** — link to related concepts at the bottom of each article
- **Kebab-case filenames** — `funding-rates.md`, `inventory-risk-management.md`

`wiki/index.md` is a Map of Content (MOC) that's auto-regenerated after every research/compile. It groups articles, summaries, and the union of all tags.

---

## CLAUDE.md

Every session has a `CLAUDE.md` at its root. Claude Code reads this automatically. It defines how Claude should ingest, compile, answer, and lint for that specific session. `kb new` writes this file for you — you rarely need to touch it.

---

## Output formats

`kb ask` saves outputs to `outputs/` as Markdown with YAML frontmatter (title, date, question). Useful outputs can be filed back into the wiki as new articles.

---

## Obsidian setup

1. Install [Obsidian](https://obsidian.md)
2. `File → Open vault → Open folder as vault`
3. Select the session directory printed by `kb sessions` or `kb new`
4. Graph view, backlinks, and search work out of the box

You never write wiki files manually. Claude maintains them. Obsidian is just the viewer.

---

## Stack

- **Language** — TypeScript (Node.js 18+, ESM)
- **CLI framework** — [commander](https://github.com/tj/commander.js)
- **TUI framework** — [ink](https://github.com/vadimdemedes/ink) (React for the terminal)
- **LLM engine** — Claude Code (`claude` CLI, model configurable per session)
- **Web tools** — Claude Code's built-in WebSearch + WebFetch
- **Subprocess** — [execa](https://github.com/sindresorhus/execa) with stream-json output parsing
- **Markdown** — [gray-matter](https://github.com/jonschlinkert/gray-matter) for YAML frontmatter
- **Wiki format** — Markdown with Obsidian wikilinks
- **Viewer** — Obsidian

---

## Architecture

```
src/
  index.ts                  ← CLI entry; routes to TUI or commander
  cli/commands/             ← 8 subcommand handlers (new, research, ask, …)
  core/
    session.ts              ← Session CRUD, ~/.kb config
    compiler.ts             ← Research/compile/ask/health prompts + stream parser
    indexer.ts              ← Deterministic Map-of-Content rebuilder
    ingestor.ts             ← URL fetch + local file ingestion
  services/
    claude.ts               ← Claude Code CLI wrapper
  tui/
    app.tsx                 ← TUI root, screen routing
    components/             ← Header, menu
    screens/                ← New, Sessions, Research, Ask, Health, Add, Compile
  utils/                    ← Markdown, paths, formatting helpers
  types/index.ts            ← Shared TypeScript interfaces
```

The compiler streams Claude's JSON events (`--output-format stream-json`) and prints human-readable progress like:

```
  → WebSearch  market making perpetual futures
  → WebFetch  https://example.com/article-1
  → Write  raw/avellaneda-stoikov-paper.md
  → Edit  wiki/concepts/funding-rate.md
  ✓ Done 47.3s $0.0234
  · Index rebuilt
```

---

## Roadmap

- [x] `kb new` / `kb sessions` / `kb switch`
- [x] `kb add` — single source ingest (URL or file)
- [x] `kb compile` — full wiki rebuild
- [x] `kb ask` — Q&A with Markdown output
- [x] `kb research` — autonomous web research + compile
- [x] `kb health` — wiki linting
- [x] Interactive TUI (ink)
- [x] Obsidian wikilinks + auto-rebuilt MOC index
- [x] Streaming progress with parsed tool events
- [ ] Marp slideshow output
- [ ] Matplotlib chart output
- [ ] Incremental compile (diff-based)
- [ ] Token cost estimation before long runs
- [ ] Finetune export — synthetic data generation from wiki

---

## Build & test

```bash
npm run build       # tsc → dist/
npm run dev         # tsx src/index.ts (no build step)
npm run typecheck   # tsc --noEmit
npm test            # vitest
```

---

## Contributing

This is an early personal tool. Issues and PRs welcome. If you build something interesting on top of it, open a discussion.

---

## License

MIT
