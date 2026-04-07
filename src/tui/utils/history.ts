import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const HISTORY_FILE = join(homedir(), '.kb', 'history.json');
const MAX_HISTORY = 200;

/** Load command history from disk. Returns empty array if missing/corrupt. */
export async function loadHistory(): Promise<string[]> {
  try {
    const raw = await readFile(HISTORY_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist command history to disk, truncated to MAX_HISTORY most recent entries. */
export async function saveHistory(history: string[]): Promise<void> {
  try {
    await mkdir(dirname(HISTORY_FILE), { recursive: true });
    await writeFile(HISTORY_FILE, JSON.stringify(history.slice(-MAX_HISTORY), null, 2));
  } catch {
    // history is non-critical, ignore failures
  }
}
