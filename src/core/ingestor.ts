import { join, basename, extname } from 'node:path';
import { copyFile, writeFile, mkdir } from 'node:fs/promises';
import { nanoid } from 'nanoid';
import { runClaude } from './claude-runner.js';
import { fetchUrlPrompt } from './prompts.js';
import { slugify } from '../utils/text.js';
import type { ActiveSession, Source } from '../types/index.js';

function isUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function detectType(source: string, ext: string): Source['type'] {
  if (isUrl(source)) return 'web';
  if (ext === '.pdf') return 'pdf';
  if (ext === '.md' || ext === '.mdx') return 'markdown';
  return 'file';
}

async function add(session: ActiveSession, source: string): Promise<Source> {
  const { config, dir } = session;
  const rawDir = join(dir, 'raw');
  await mkdir(rawDir, { recursive: true });

  const id = nanoid(8);
  const now = new Date().toISOString();
  let filePath: string;
  let title: string;

  if (isUrl(source)) {
    const slug = slugify(source.replace(/^https?:\/\//, ''));
    const fileName = `${slug}.md`;
    filePath = join('raw', fileName);
    title = (await runClaude(dir, fetchUrlPrompt(source, fileName), {
      timeoutMs: 180_000,
      allowedTools: ['WebFetch', 'Read', 'Write', 'Bash'],
    })).trim() || slug;
  } else {
    const ext = extname(source);
    const name = basename(source, ext);
    const fileName = `${slugify(name)}${ext}`;
    await copyFile(source, join(rawDir, fileName));
    filePath = join('raw', fileName);
    title = name;
  }

  const sourceRecord: Source = {
    id,
    url: isUrl(source) ? source : undefined,
    filePath,
    type: detectType(source, extname(filePath)),
    title,
    addedAt: now,
  };

  config.sources.push(sourceRecord);
  config.updatedAt = now;
  await writeFile(join(dir, 'session.json'), JSON.stringify(config, null, 2));

  return sourceRecord;
}

export const Ingestor = { add };
