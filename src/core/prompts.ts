import type { ResearchOptions, CompileOptions } from '../types/index.js';

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
