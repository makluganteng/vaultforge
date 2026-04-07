# vaultforge

> An LLM-powered personal knowledge base engine. Give it a topic — it researches, compiles, and maintains a full Markdown wiki for you. Autonomously.

Built on top of [Claude Code](https://claude.ai/code). Viewed in [Obsidian](https://obsidian.md).

---

## The idea

Most note-taking tools make you the editor. You read the sources, you write the articles, you maintain the graph. **vaultforge inverts this.** You supply the topic. The LLM does the rest — searching the web, downloading files, writing wiki articles, answering questions, linting for gaps — and files everything back into a structured Markdown wiki that compounds over time.

No RAG pipeline. No vector database. Just a well-structured index and the model reading what it needs.

---

## How it works

```
vaultforge research "perpetual DEX funding rates"
```

1. **Search** — searches the web for top sources on the topic
2. **Fetch** — pulls each URL, converts HTML to Markdown
3. **Save** — each source is written to `raw/` as a Markdown file
4. **Compile** — writes wiki articles, concept pages, and per-source summaries with Obsidian wikilinks
5. **Index** — `wiki/index.md` is auto-rebuilt as a Map of Content with all articles, summaries, and tags
6. **Query** — ask anything; the model reads the index and pulls relevant articles
7. **File back** — Q&A outputs are saved to `outputs/`

Every query compounds the wiki. Nothing gets lost.

---

## Installation

```bash
# Requirements: Node.js 18+, Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Install vaultforge globally
npm install -g @valentinofish/vaultforge
```

The CLI is available as `vaultforge` (or the short alias `vf`).

---

## Quick start

```bash
# Launch the interactive TUI dashboard
vaultforge

# Or use any command directly
vaultforge new "perpetual futures market making"
vaultforge research "funding rate methodologies"
vaultforge ask "compare hyperliquid and dydx funding"
vaultforge sessions
```

---

## Commands

| Command | Description |
|---|---|
| `vaultforge` (no args) | Launch the interactive TUI dashboard |
| `vaultforge tui` | Same — launch the TUI explicitly |
| `vaultforge new <topic>` | Create a new isolated session |
| `vaultforge research <query>` | Auto-search, fetch, and compile wiki articles |
| `vaultforge add <url\|file>` | Ingest a single source into the session |
| `vaultforge compile` | Rebuild the full wiki from `raw/` |
| `vaultforge ask "<question>"` | Q&A against the wiki |
| `vaultforge health` | Lint the wiki — find gaps, suggest articles |
| `vaultforge sessions` | List all sessions with vault paths |
| `vaultforge switch <id>` | Switch active session |

### Common options

- `vaultforge research <query> --max-sources 10 --depth normal` — `depth` is `shallow`, `normal`, or `deep`
- `vaultforge compile --force` — recompile every article from scratch
- `vaultforge new <topic> --model claude-sonnet-4` — pin a specific model

---

## TUI dashboard

Run `vaultforge` with no arguments to launch the interactive TUI. Built with [ink](https://github.com/vadimdemedes/ink) (React for the terminal).

```
┌─ SESSIONS ─────┐┌─ WIKI ──────────────┐┌─ Funding Rate ────────────────┐
│ ▸ market_perps ││ ▸ funding-rate  cpt ││ CONCEPT · 1,240 words · 4 bl  │
│   15 art · 41K ││   bid-ask-…    cpt  ││ updated 2026-04-07            │
│                ││   inventory    cpt  ││                                │
│   defi_yields  ││   index.md     idx  ││ Funding rates are periodic    │
│   8 art · 18K  ││                     ││ payments between long and...  │
│                ││                     ││                                │
│   + new        ││                     ││                                │
└────────────────┘└─────────────────────┘└────────────────────────────────┘
┌─ TERMINAL ──────────────────────────────────────────────  $0.0234 ──┐
│   ▸ research market making perps                                     │
│   → WebSearch  market making perpetual futures                       │
│   → Write      raw/avellaneda-stoikov-paper.md                       │
│   ✓ Done 47.3s $0.0234                                              │
└──────────────────────────────────────────────────────────────────────┘
┌─ ▸ try: ask "compare funding models"  ·  press ? for help  ─  ⏎ run ┐
└──────────────────────────────────────────────────────────────────────┘
 ↑↓ navigate   ⏎ open   / search   s sort   t tag   Tab next   ? help
 market_perps │ 15 articles │ 41K words │ ready │ $0.0234 │ 13:20 · 2026-04-07
```

### Layout

| Panel | Purpose |
|---|---|
| **Sessions** (left) | All your sessions with article + word counts |
| **Wiki** (middle) | Files in the active session with type badges |
| **Preview** (right) | Markdown preview of the highlighted file (or graph view) |
| **Terminal** (bottom) | Live activity log + REPL command bar |
| **Status bar** | Active session, stats, status, cost, time |
| **Shortcut bar** | Context-aware keyboard hints |

### Key bindings

**Global:**
- `Tab` cycles focus between panels (terminal panel uses Tab for autocomplete)
- `?` opens the full keyboard shortcut overlay
- `g` toggles graph view (force-directed wiki graph in the preview pane)
- `Ctrl+C` quit

**Wiki panel:** `/` search · `s` sort · `t` tag filter · `c` clear · `Enter` open

**Preview panel:** `j/k` scroll · `f` follow `[[wikilink]]` · `[ ]` back/forward · `0/G` top/bottom

**Graph panel (when in graph view):** `↑↓←→` walk to nearest connected neighbor · `t` tag filter · `r` re-run layout · `Enter` select

**Terminal panel:** `Enter` run · `↑↓` history · `Tab` autocomplete · `PgUp/Dn` scroll log · `Esc` live tail

---

## Session structure

Each session is a self-contained directory at `~/.vaultforge/sessions/<id>_<slug>/`. Open it as an Obsidian vault.

```
~/.vaultforge/sessions/
  rp8dSImC_market-making-perps/
    CLAUDE.md              ← per-session instructions for the LLM
    session.json           ← metadata: topic, sources, state
    raw/                   ← original source files (.md, .pdf, .html)
    wiki/
      index.md             ← Map of Content, auto-rebuilt by vaultforge
      concepts/            ← concept articles with wikilinks + frontmatter
      summaries/           ← per-source summaries
    assets/                ← downloaded images
    outputs/               ← query outputs (saved by `vaultforge ask`)
```

Sessions never share data. Switch between topics instantly with `vaultforge switch`.

### Obsidian formatting

Every article has:

- **YAML frontmatter** — `title`, `tags`, `sources`, `summary`, `created`, `updated`
- **Obsidian wikilinks** — `[[concept-name]]` for cross-references between articles
- **Inline tags** — `#tag` syntax for in-body tagging
- **`## See Also` sections** — link to related concepts at the bottom of each article
- **Kebab-case filenames** — `funding-rates.md`, `inventory-risk-management.md`

`wiki/index.md` is a Map of Content (MOC) that's auto-regenerated after every research/compile run. It groups articles, summaries, and the union of all tags.

---

## Obsidian setup

1. Install [Obsidian](https://obsidian.md)
2. `File → Open vault → Open folder as vault`
3. Select the session directory printed by `vaultforge sessions` or `vaultforge new`
4. Graph view, backlinks, and search work out of the box

You never write wiki files manually. The LLM maintains them. Obsidian is just the viewer.

---

## Stack

- **Language** — TypeScript (Node.js 18+, ESM)
- **CLI framework** — [commander](https://github.com/tj/commander.js)
- **TUI framework** — [ink](https://github.com/vadimdemedes/ink) (React for the terminal)
- **LLM engine** — Claude Code (`claude` CLI). Future versions will support Codex and open-source local models.
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
    session.ts              ← Session CRUD, ~/.vaultforge config
    claude-runner.ts        ← Subprocess + stream-json parser
    prompts.ts              ← Pure prompt builder functions
    compiler.ts             ← Thin orchestrator
    indexer.ts              ← Deterministic Map-of-Content rebuilder
    ingestor.ts             ← URL fetch + local file ingestion
  tui/
    app.tsx                 ← Dashboard root with focus management
    panels/                 ← sessions, wiki, preview, graph, terminal, status
    components/             ← header, footer, help overlay, progress line, shortcut bar
    utils/                  ← wiki file listing, graph layout, command runner, history
  utils/                    ← Markdown, slugify
  types/index.ts            ← Shared TypeScript interfaces
```

---

## Roadmap

- [x] `new` / `sessions` / `switch`
- [x] `add` — single source ingest (URL or file)
- [x] `compile` — full wiki rebuild
- [x] `ask` — Q&A with Markdown output
- [x] `research` — autonomous web research + compile
- [x] `health` — wiki linting
- [x] Interactive TUI dashboard (ink)
- [x] Obsidian wikilinks + auto-rebuilt MOC index
- [x] Streaming progress with parsed tool events
- [x] Force-directed graph view
- [x] Search, sort, tag filter
- [x] Wikilink navigation + back/forward history
- [x] Command history + Tab autocomplete
- [x] Help overlay
- [ ] Codex backend support
- [ ] Local model backend (llama.cpp / ollama)
- [ ] Marp slideshow output
- [ ] Matplotlib chart output
- [ ] Incremental compile (diff-based)
- [ ] Token cost estimation before long runs
- [ ] Finetune export — synthetic data generation from wiki

---

## Build from source

```bash
git clone https://github.com/makluganteng/vaultforge
cd vaultforge
npm install
npm run build
npm link        # makes the `vaultforge` command available globally
```

```bash
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
