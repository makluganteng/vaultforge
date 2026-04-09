import type {
  ResearchOptions,
  CompileOptions,
  RepoIngestOptions,
  RepoInfo,
} from '../types/index.js';

const OBSIDIAN_RULES = [
  '## Obsidian Formatting (CRITICAL)',
  '- Every article MUST have YAML frontmatter: title, tags (array), sources (array), summary.',
  '- Use Obsidian wikilinks `[[concepts/article-name]]` in index.md.',
  '- Use wikilinks `[[article-name]]` between concept articles for cross-references.',
  '- Add a `## See Also` section at the bottom with wikilinks to related concepts.',
  '- Use `#tag` inline tags in article text.',
  '- File names must be kebab-case (e.g., `perpetual-futures.md`).',
];

const OUTPUT_RULE = ['## Output format', 'Write all files directly. Do not ask for confirmation.'];

function depthInstruction(depth: ResearchOptions['depth']): string {
  switch (depth) {
    case 'shallow':
      return 'Do a quick survey -- 2-3 sources are fine.';
    case 'deep':
      return 'Do an exhaustive deep-dive. Explore subtopics, controversies, and edge cases.';
    default:
      return 'Do a thorough but focused research pass.';
  }
}

export function researchPrompt(query: string, options: ResearchOptions = {}): string {
  const maxSources = options.maxSources ?? 10;
  const depth = options.depth ?? 'normal';

  return [
    `You are researching: "${query}"`,
    '',
    '## Instructions',
    `1. Use WebSearch to find up to ${maxSources} high-quality sources about this topic.`,
    '2. Use WebFetch to pull the top results as markdown.',
    '3. Save each raw source to the raw/ directory as a markdown file.',
    '   Name files in kebab-case, e.g. raw/funding-rates-overview.md.',
    '4. Write wiki articles to wiki/concepts/ -- one article per key concept.',
    '5. Write per-source summaries to wiki/summaries/ -- one file per source.',
    '6. Update wiki/index.md as a Map of Content linking to all articles.',
    '',
    ...OBSIDIAN_RULES,
    '',
    `## Depth: ${depth}`,
    depthInstruction(depth),
    '',
    ...OUTPUT_RULE,
  ].join('\n');
}

export function compilePrompt(options: CompileOptions = {}): string {
  const force = options.force ?? false;
  const modeInstruction = force
    ? 'Rewrite ALL wiki articles from scratch, even if they already exist.'
    : 'Only process sources in raw/ that do not yet have corresponding wiki articles. Skip sources that are already covered.';

  return [
    'You are compiling wiki articles from raw sources.',
    '',
    '## Instructions',
    '1. Read all files in the raw/ directory.',
    '2. Read the current wiki/index.md to understand existing coverage.',
    `3. ${modeInstruction}`,
    '4. Generate or regenerate wiki articles in wiki/concepts/.',
    '5. Generate or regenerate source summaries in wiki/summaries/.',
    '6. Update wiki/index.md as a Map of Content with grouped wikilinks.',
    '',
    ...OBSIDIAN_RULES,
    '',
    ...OUTPUT_RULE,
  ].join('\n');
}

export function askPrompt(question: string, outputFile: string): string {
  return [
    `Answer this question about the knowledge base: "${question}"`,
    '',
    '## Instructions',
    '1. Read wiki/index.md to understand what articles are available.',
    '2. Read the relevant wiki articles in wiki/concepts/ and wiki/summaries/.',
    '3. Synthesize an answer based on the wiki content.',
    '4. If the wiki does not have enough information, say so clearly.',
    `5. Save your full answer to ${outputFile} with YAML frontmatter (title, date, question).`,
    '6. Use Obsidian wikilinks `[[concepts/article-name]]` when referencing wiki articles in the answer.',
    '',
    '## Output format',
    'Print ONLY the answer text to stdout. No preamble, no markdown fences around the whole response.',
  ].join('\n');
}

export function healthPrompt(): string {
  return [
    'Perform a health check on this knowledge base.',
    '',
    '## Instructions',
    '1. Read wiki/index.md and all articles in wiki/concepts/ and wiki/summaries/.',
    '2. Read the list of raw sources in raw/.',
    '3. Check for:',
    '   - Orphaned sources (files in raw/ with no corresponding wiki article)',
    '   - Missing concepts (topics referenced but not covered)',
    '   - Broken links in index.md or articles',
    '   - Gaps in coverage',
    '4. Calculate a health score from 0-100.',
    '',
    '## Output format',
    'Print ONLY a JSON object with this exact shape (no markdown fences):',
    '{',
    '  "totalArticles": <number>,',
    '  "totalSources": <number>,',
    '  "orphanedSources": [<string>, ...],',
    '  "missingConcepts": [<string>, ...],',
    '  "suggestions": [<string>, ...],',
    '  "score": <number 0-100>',
    '}',
  ].join('\n');
}

function repoDepthInstruction(depth: RepoIngestOptions['depth']): string {
  switch (depth) {
    case 'shallow':
      return [
        'Write ONLY:',
        '  - `wiki/concepts/architecture-overview.md` (the full top-level story)',
        '  - Up to 5 concept articles for the most important modules',
        'Do NOT write per-file summaries. Skip lesser modules entirely.',
      ].join('\n');
    case 'deep':
      return [
        'Write:',
        '  - `wiki/concepts/architecture-overview.md`',
        '  - One concept article per module/bounded context',
        '  - A per-file summary in `wiki/summaries/` for EVERY non-trivial source file',
        '  - A `wiki/concepts/type-glossary.md` listing the key public types/interfaces with short descriptions',
        'Be exhaustive. If a file exports something used elsewhere, document it.',
      ].join('\n');
    default:
      return [
        'Write:',
        '  - `wiki/concepts/architecture-overview.md`',
        '  - One concept article per module/bounded context',
        '  - Per-file summaries in `wiki/summaries/` ONLY for entrypoints and files explicitly referenced from README',
      ].join('\n');
  }
}

const REPO_EXCLUDES_BASE = [
  'node_modules/',
  'dist/',
  'build/',
  'out/',
  'target/',
  '.git/',
  '.next/',
  '.nuxt/',
  '.cache/',
  '.venv/',
  'venv/',
  '__pycache__/',
  '.pytest_cache/',
  'coverage/',
  '.DS_Store',
  '*.lock',
  '*.lockb',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Cargo.lock',
  'poetry.lock',
  '*.min.js',
  '*.min.css',
  '*.map',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.ico',
  '*.svg',
  '*.pdf',
  '*.zip',
  '*.tar',
  '*.gz',
  '*.wasm',
  '*.exe',
  '*.dll',
  '*.so',
  '*.dylib',
];

const REPO_EXCLUDES_TESTS = [
  'test/',
  'tests/',
  '__tests__/',
  '*.test.*',
  '*.spec.*',
];

export function repoPrompt(repo: RepoInfo, options: RepoIngestOptions = {}): string {
  const depth = options.depth ?? 'normal';
  const includeTests = options.includeTests ?? false;
  const force = options.force ?? false;

  const excludes = [
    ...REPO_EXCLUDES_BASE,
    ...(includeTests ? [] : REPO_EXCLUDES_TESTS),
  ];

  const repoContext = [
    `## Repository`,
    `- Name: **${repo.name}**`,
    repo.primaryLanguage ? `- Primary language: ${repo.primaryLanguage}` : null,
    repo.manifestFiles.length
      ? `- Manifest files: ${repo.manifestFiles.join(', ')}`
      : null,
    repo.hasReadme ? `- Has README: yes (read it FIRST)` : `- Has README: no`,
    repo.commitSha ? `- Commit: ${repo.commitSha.slice(0, 8)}` : null,
    repo.branch ? `- Branch: ${repo.branch}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const modeInstruction = force
    ? 'Rewrite ALL wiki articles from scratch. Overwrite existing files.'
    : 'Skip concept articles that already exist in `wiki/concepts/`. Only create missing ones. If a module has changed substantially and its article is stale, you may rewrite it.';

  return [
    `You are documenting a local code repository as an Obsidian-flavored Markdown wiki.`,
    `The current working directory IS the repository root. Everything you Read must be under the cwd.`,
    `Write all wiki output to \`wiki/\` (already exists, alongside source code).`,
    '',
    repoContext,
    '',
    '## Step-by-step instructions',
    '',
    '1. **Understand the project first.** Read `README.md` (if present), then the primary manifest file(s) to learn the project name, description, dependencies, scripts, and declared entrypoints.',
    '',
    '2. **Map the code layout.** Use `Glob` with patterns like `src/**/*.ts`, `lib/**/*.py`, `cmd/**/*.go` — whatever matches the language — to get a file tree. Do NOT Read every file. Identify the top-level modules / bounded contexts from the directory structure and the README.',
    '',
    '3. **Read strategically.** For each module you plan to document, Read:',
    '   - The module entrypoint / `index.*` / `mod.rs` / `__init__.py`',
    '   - 2–5 representative files that define the module\'s core types and public API',
    '   - Use `Grep` to follow specific symbols if you need to understand how modules connect',
    '   Do not slurp entire directories.',
    '',
    `4. **${modeInstruction}**`,
    '',
    '5. **Write concept articles** to `wiki/concepts/<kebab-case-name>.md`. Each concept article covers ONE module or bounded context and MUST include:',
    '   - YAML frontmatter: `title`, `tags` (array), `sources` (array of file paths documented), `summary` (one-sentence module purpose)',
    '   - **Purpose** — what this module is responsible for, in plain language',
    '   - **Public API** — key exported functions/classes/types, with one-line descriptions',
    '   - **Internal structure** — how files in the module fit together',
    '   - **Dependencies** — which other modules it calls, as Obsidian wikilinks `[[other-module]]`',
    '   - **Example flow** — a short walkthrough of a typical call path through the module (code snippets welcome, keep them under 20 lines each)',
    '   - `## See Also` — wikilinks to related concept articles',
    '',
    '6. **Write an architecture overview** at `wiki/concepts/architecture-overview.md`. This is the top-level map: what the project does, the major components, how data flows end-to-end, and wikilinks into every module article. Treat this as the "front door" of the wiki.',
    '',
    '7. **Per-file summaries** (when required by the depth instructions): write to `wiki/summaries/<file-path-as-kebab-case>.md`. Frontmatter must include `title`, `tags`, `sources: [<the original file path>]`, `summary`. Body should explain what the file does, key exports, and how it\'s used — in 100–300 words.',
    '',
    '8. **Do not update `wiki/index.md`** — it will be regenerated automatically after you finish. Focus on `wiki/concepts/` and `wiki/summaries/`.',
    '',
    '## Wikilink discipline (CRITICAL)',
    '',
    'Before writing any article, decide the COMPLETE set of concept article filenames you will produce. For example: `[architecture-overview, claude-runner, prompts-module, session-management, repo-documentation]`.',
    '',
    'Every `[[wikilink]]` you write MUST resolve to one of:',
    '- A filename in your planned concept-article set (linked as `[[name]]` or `[[name|Display Title]]`)',
    '- A per-file summary filename you are also writing to `wiki/summaries/` (linked as `[[summaries/name]]`)',
    '',
    'For modules that exist in the code but are NOT in your planned article set, describe them **inline in prose** instead of wikilinking to them. A dead `[[wikilink]]` is worse than no link — it breaks Obsidian\'s graph view and misleads the reader. If in doubt, do not link.',
    '',
    'Use the EXACT filename (without `.md`) when writing wikilinks. If you write the article as `compiler-and-indexing.md`, every reference must be `[[compiler-and-indexing]]` — never `[[compiler]]` or `[[indexing]]`.',
    '',
    '## Depth: ' + depth,
    repoDepthInstruction(depth),
    '',
    '## Exclusions — never Read these',
    excludes.map((e) => `- \`${e}\``).join('\n'),
    'Also respect `.gitignore` if present at the repo root (read it once, then avoid anything it ignores).',
    '',
    '## Obsidian Formatting (CRITICAL)',
    '- Every article MUST have YAML frontmatter: title, tags (array), sources (array), summary.',
    '- Use Obsidian wikilinks `[[module-name]]` between concept articles.',
    '- Use `[[summaries/file-name]]` to reference per-file summaries from concepts.',
    '- Use `#tag` inline tags in article text (e.g. `#architecture`, `#public-api`).',
    '- Add a `## See Also` section at the bottom of every concept article.',
    '- File names must be kebab-case.',
    '',
    '## Code snippets',
    '- Use fenced code blocks with the correct language tag (```ts, ```py, ```rs, etc.).',
    '- Keep snippets short and illustrative. Never paste more than 20 lines of source.',
    '- Prefer a description of what the code does over pasting the code itself.',
    '- **Do not fabricate runtime numbers.** If you show example CLI output, use placeholders like `<duration>`, `<cost>`, `<commit-sha>` instead of inventing values. You have no way to know what the user will see when they run the tool.',
    '',
    '## Output format',
    'Write all files directly. Do not ask for confirmation. Do not print a summary at the end.',
  ].join('\n');
}

export function fetchUrlPrompt(url: string, fileName: string): string {
  return [
    `Fetch the content of this URL and save it as markdown: ${url}`,
    '',
    '## Instructions',
    `1. Use WebFetch to retrieve the content of: ${url}`,
    `2. Save the fetched content as markdown to raw/${fileName}`,
    '3. Print ONLY the page title to stdout (no other text).',
  ].join('\n');
}
