import { readdir, readFile, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { parseFrontmatter } from '../../utils/markdown.js';

export type WikiFileType = 'concept' | 'summary' | 'output' | 'index' | 'raw';

export interface WikiFile {
  /** File name without extension, e.g. "funding-rate" */
  slug: string;
  /** Display title from frontmatter, falls back to slug */
  title: string;
  /** Absolute file path */
  path: string;
  /** Path relative to session dir, e.g. "wiki/concepts/funding-rate.md" */
  relPath: string;
  type: WikiFileType;
  wordCount: number;
  /** mtime ISO string */
  updated: string;
  tags: string[];
  /** Number of [[wikilinks]] pointing TO this file from other files */
  backlinks: number;
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'is', 'of', 'and', 'or', 'to', 'in']);

function countWords(text: string): number {
  const tokens = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w));
  return tokens.length;
}

async function listDir(dir: string, type: WikiFileType): Promise<Array<{ name: string; path: string; type: WikiFileType }>> {
  try {
    const entries = await readdir(dir);
    return entries
      .filter((f) => f.endsWith('.md'))
      .map((name) => ({ name, path: join(dir, name), type }));
  } catch {
    return [];
  }
}

async function parseFile(
  path: string,
  type: WikiFileType,
  sessionDir: string,
): Promise<WikiFile | null> {
  try {
    const [raw, st] = await Promise.all([readFile(path, 'utf-8'), stat(path)]);
    const { data, content } = parseFrontmatter(raw);
    const slug = basename(path, '.md');
    const title = (data.title as string) ?? slug;
    const tags = Array.isArray(data.tags) ? (data.tags as string[]) : [];
    return {
      slug,
      title,
      path,
      relPath: path.replace(sessionDir + '/', ''),
      type,
      wordCount: countWords(content),
      updated: st.mtime.toISOString(),
      tags,
      backlinks: 0,
    };
  } catch {
    return null;
  }
}

/**
 * List all wiki files in a session, including index, concepts, summaries, and outputs.
 * Counts backlinks across the whole wiki.
 */
export async function listSessionFiles(sessionDir: string): Promise<WikiFile[]> {
  const sources = [
    ...(await listDir(join(sessionDir, 'wiki', 'concepts'), 'concept')),
    ...(await listDir(join(sessionDir, 'wiki', 'summaries'), 'summary')),
    ...(await listDir(join(sessionDir, 'outputs'), 'output')),
  ];

  // Always include the index if it exists
  const indexPath = join(sessionDir, 'wiki', 'index.md');
  try {
    await stat(indexPath);
    sources.unshift({ name: 'index.md', path: indexPath, type: 'index' });
  } catch {
    // no index yet
  }

  const parsed = await Promise.all(sources.map((s) => parseFile(s.path, s.type, sessionDir)));
  const files = parsed.filter((f): f is WikiFile => f !== null);

  // Count backlinks: for each file, scan all other files for [[slug]] mentions
  const linkRegex = /\[\[([^\]]+)\]\]/g;
  const referenceCounts = new Map<string, number>();
  for (const file of files) {
    try {
      const raw = await readFile(file.path, 'utf-8');
      let m: RegExpExecArray | null;
      while ((m = linkRegex.exec(raw)) !== null) {
        const target = m[1].split('|')[0].split('/').pop()?.replace(/\.md$/, '') ?? '';
        if (target) referenceCounts.set(target, (referenceCounts.get(target) ?? 0) + 1);
      }
    } catch {
      // skip
    }
  }
  for (const file of files) {
    file.backlinks = referenceCounts.get(file.slug) ?? 0;
  }

  return files;
}

/** Read a wiki file's full body (without frontmatter) for the preview pane. */
export async function readWikiBody(path: string): Promise<{ frontmatter: Record<string, unknown>; body: string }> {
  const raw = await readFile(path, 'utf-8');
  const { data, content } = parseFrontmatter(raw);
  return { frontmatter: data, body: content };
}

/** Aggregate stats for the status bar */
export interface SessionStats {
  articles: number;
  words: number;
}

export async function getSessionStats(sessionDir: string): Promise<SessionStats> {
  const files = await listSessionFiles(sessionDir);
  const articles = files.filter((f) => f.type === 'concept' || f.type === 'summary').length;
  const words = files.reduce((sum, f) => sum + f.wordCount, 0);
  return { articles, words };
}
