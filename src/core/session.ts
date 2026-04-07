import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { nanoid } from 'nanoid';
import { slugify } from '../utils/text.js';
import type { KbConfig, SessionConfig } from '../types/index.js';

const VAULTFORGE_DIR = join(homedir(), '.vaultforge');
const CONFIG_PATH = join(VAULTFORGE_DIR, 'config.json');

async function getConfig(): Promise<KbConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as KbConfig;
  } catch {
    const config: KbConfig = {
      sessionsDir: join(VAULTFORGE_DIR, 'sessions'),
      activeSession: null,
      defaultModel: 'claude-sonnet-4',
    };
    await mkdir(VAULTFORGE_DIR, { recursive: true });
    await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
    return config;
  }
}

async function saveConfig(config: KbConfig): Promise<void> {
  await mkdir(VAULTFORGE_DIR, { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

async function create(
  topic: string,
  options?: { model?: string },
): Promise<SessionConfig & { path: string }> {
  const config = await getConfig();
  const id = nanoid(8);
  const slug = slugify(topic, 40);
  const dirName = `${id}_${slug}`;
  const sessionDir = join(config.sessionsDir, dirName);

  const dirs = [
    sessionDir,
    join(sessionDir, 'raw'),
    join(sessionDir, 'wiki', 'concepts'),
    join(sessionDir, 'wiki', 'summaries'),
    join(sessionDir, 'assets'),
    join(sessionDir, 'outputs'),
  ];
  await Promise.all(dirs.map((d) => mkdir(d, { recursive: true })));

  const now = new Date().toISOString();
  const session: SessionConfig = {
    id,
    topic,
    createdAt: now,
    updatedAt: now,
    sources: [],
    status: 'active',
  };

  const claudeMd = [
    `# Vaultforge Session: ${topic}`,
    '',
    `You are a research assistant building a knowledge base about **${topic}**.`,
    '',
    '## Rules',
    '- Read wiki/index.md before answering any question.',
    '- Save all generated outputs to the outputs/ directory.',
    '- Maintain the wiki structure: concepts go in wiki/concepts/, summaries in wiki/summaries/.',
    '- Update wiki/index.md when adding new articles.',
    `- Model: ${options?.model ?? config.defaultModel}`,
    '',
    '## Obsidian Formatting (IMPORTANT)',
    '- Use Obsidian wikilinks `[[article-name]]` for ALL internal links between articles.',
    '- Use `#tag` syntax in article body text for inline tags.',
    '- Every article MUST have YAML frontmatter with: title, tags (array), sources (array), summary.',
    '- Use `[[concepts/article-name]]` when linking from index.md to concept articles.',
    '- Use `[[summaries/source-name]]` when linking from index.md to summaries.',
    '- File names should be kebab-case (e.g., `funding-rates.md`).',
    '- Add a `## See Also` section at the bottom of articles with wikilinks to related concepts.',
    '- The wiki/index.md should be a proper MOC (Map of Content) with grouped wikilinks.',
    '',
  ].join('\n');

  const indexMd = [
    `# ${topic}`,
    '',
    '_This is the Map of Content (MOC) for your knowledge base._',
    '',
    '## Concepts',
    '',
    '_No articles yet. Run `vaultforge research` to get started._',
    '',
    '## Summaries',
    '',
    '## Tags',
    '',
  ].join('\n');

  await Promise.all([
    writeFile(join(sessionDir, 'session.json'), JSON.stringify(session, null, 2)),
    writeFile(join(sessionDir, 'CLAUDE.md'), claudeMd),
    writeFile(join(sessionDir, 'wiki', 'index.md'), indexMd),
  ]);

  config.activeSession = id;
  await saveConfig(config);

  return { ...session, path: sessionDir };
}

async function list(): Promise<Array<SessionConfig & { dir: string }>> {
  const config = await getConfig();
  let entries: string[];
  try {
    entries = await readdir(config.sessionsDir);
  } catch {
    return [];
  }

  const results: Array<SessionConfig & { dir: string }> = [];

  for (const entry of entries) {
    const dir = join(config.sessionsDir, entry);
    try {
      const raw = await readFile(join(dir, 'session.json'), 'utf-8');
      const session = JSON.parse(raw) as SessionConfig;
      results.push({ ...session, dir });
    } catch {
      // skip malformed or non-session directories
    }
  }

  return results.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

async function switchSession(id: string): Promise<SessionConfig> {
  const sessions = await list();
  const match = sessions.find((s) => s.id === id);
  if (!match) {
    throw new Error(
      `Session "${id}" not found. Run \`vaultforge sessions\` to see available sessions.`,
    );
  }

  const config = await getConfig();
  config.activeSession = id;
  await saveConfig(config);

  const { dir: _, ...session } = match;
  return session;
}

async function getActiveId(): Promise<string | null> {
  const config = await getConfig();
  return config.activeSession;
}

async function getActive(): Promise<{ config: SessionConfig; dir: string }> {
  const globalConfig = await getConfig();
  if (!globalConfig.activeSession) {
    throw new Error(
      'No active session. Create one with `vaultforge new <topic>` or switch with `vaultforge switch <id>`.',
    );
  }

  const sessions = await list();
  const match = sessions.find((s) => s.id === globalConfig.activeSession);
  if (!match) {
    throw new Error(
      `Active session "${globalConfig.activeSession}" not found on disk. ` +
        'Run `vaultforge sessions` to see available sessions.',
    );
  }

  const { dir, ...config } = match;
  return { config, dir };
}

export const SessionManager = {
  create,
  list,
  switch: switchSession,
  getActive,
  getActiveId,
  getConfig,
  saveConfig,
};

