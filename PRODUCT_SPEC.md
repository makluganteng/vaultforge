# kb

> An LLM-powered personal knowledge base engine. Give it a topic — it researches, compiles, and maintains a full Markdown wiki for you. Autonomously.

Built on top of [Claude Code](https://claude.ai/code). Viewed in [Obsidian](https://obsidian.md).

---

## The idea

Most note-taking tools make you the editor. You read the sources, you write the articles, you maintain the graph. **kb inverts this.** You supply the topic and the sources. Claude does the rest — searching the web, downloading files, writing wiki articles, answering questions, linting for gaps — and files everything back into a structured Markdown wiki that compounds over time.

No RAG pipeline. No vector database. Just a well-structured index and Claude reading what it needs.

---

## How it works

```
kb research "perpetual DEX funding rates"
```

1. **Search** — Claude searches the web for top sources on the topic
2. **Fetch** — WebFetch pulls each URL, converts HTML to Markdown
3. **Download** — PDFs and files are saved to `raw/` via curl
4. **Compile** — Claude writes wiki articles, concept pages, and summaries
5. **Index** — `index.md` is updated with all articles, tags, and brief summaries
6. **Query** — Ask anything; Claude reads the index and pulls relevant articles
7. **File back** — Outputs are saved to `outputs/` and can be filed into the wiki

Every query compounds the wiki. Nothing gets lost.

---

## Installation

```bash
# Requirements: Python 3.11+, Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Clone and install kb
git clone https://github.com/yourhandle/kb
cd kb
pip install -e .
```

---

## Commands

| Command | Description |
|---|---|
| `kb new <topic>` | Create a new isolated session |
| `kb research <query>` | Auto-search, fetch, download, and compile wiki |
| `kb add <url\|file>` | Ingest a single source into the session |
| `kb compile` | Rebuild the full wiki from `raw/` |
| `kb ask "<question>"` | Q&A against the wiki |
| `kb health` | Lint the wiki — find gaps, suggest articles |
| `kb sessions` | List all sessions |
| `kb switch <id>` | Switch active session |

---

## Session structure

Each session is a self-contained directory. Open it as an Obsidian vault.

```
kb-sessions/
  session_001_defi_yields/
    CLAUDE.md              ← Claude Code brain for this session
    session.json           ← metadata: topic, sources, state
    raw/                   ← original source files (.md, .pdf, .html)
    wiki/
      index.md             ← master index, auto-maintained by Claude
      concepts/            ← concept articles
      summaries/           ← per-source summaries
    assets/                ← downloaded images
    outputs/               ← query outputs, slides, charts
```

Sessions never share data. Switch between topics instantly with `kb switch`.

---

## CLAUDE.md

Every session has a `CLAUDE.md` at its root. Claude Code reads this automatically. It defines how Claude should ingest, compile, answer, and lint for that specific session. `kb new` writes this file for you — you rarely need to touch it.

---

## Output formats

`kb ask` saves outputs to `outputs/` in the format best suited to the query:

- **Markdown** — default, viewable and searchable in Obsidian
- **Marp slideshow** — render with the Obsidian Marp plugin
- **Matplotlib chart** — `.png` saved for visual queries
- **CSV / JSON** — for structured data extracts

Useful outputs can be filed back into the wiki as new articles.

---

## Obsidian setup

1. Install [Obsidian](https://obsidian.md)
2. Open any session folder as a vault
3. Install [Obsidian Web Clipper](https://obsidian.md/clipper) — clip articles directly to `raw/`
4. Install [Marp for Obsidian](https://github.com/samuele-cozzi/obsidian-marp-slides) — render slide outputs
5. Graph view, backlinks, and search work out of the box on the wiki

You never write wiki files manually. Claude maintains them. Obsidian is just the viewer.

---

## Stack

- **CLI** — Python 3.11+
- **LLM engine** — Claude Code (`claude-opus-4` / `claude-sonnet-4`)
- **Web tools** — Claude Code built-in WebSearch + WebFetch
- **File download** — `curl` / `wget` via Claude Code Bash tool
- **Wiki format** — Markdown with YAML frontmatter
- **Viewer** — Obsidian
- **Slides** — Marp

---

## Roadmap

- [x] `kb new` / `kb sessions` / `kb switch`
- [x] `kb add` — single source ingest
- [x] `kb compile` — full wiki rebuild
- [x] `kb ask` — Q&A with Markdown output
- [x] `kb research` — autonomous web research + compile
- [x] `kb health` — wiki linting
- [ ] Marp slideshow output
- [ ] Matplotlib chart output
- [ ] Incremental compile (diff-based)
- [ ] Token cost estimation before long runs
- [ ] Finetune export — synthetic data generation from wiki

---

## Contributing

This is an early personal tool. Issues and PRs welcome. If you build something interesting on top of it, open a discussion.

---

## License

MIT