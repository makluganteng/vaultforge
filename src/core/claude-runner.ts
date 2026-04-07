import { createInterface } from 'node:readline';
import { execa } from 'execa';
import chalk from 'chalk';
import type { ProgressEvent } from '../types/index.js';

export interface RunOptions {
  /** Stream parsed progress events. Default: false. */
  stream?: boolean;
  /**
   * Subscribe to progress events. If provided, events are NOT printed to
   * stdout — the caller is responsible for rendering them. Used by the TUI.
   * If omitted and `stream` is true, events are printed to stdout (CLI mode).
   */
  onProgress?: (event: ProgressEvent) => void;
  /** Override the default 10-minute timeout. Milliseconds. */
  timeoutMs?: number;
  /** Override the default tool allowlist. */
  allowedTools?: string[];
}

interface StreamLine {
  type: string;
  subtype?: string;
  message?: {
    content?: Array<{
      type: string;
      name?: string;
      input?: Record<string, unknown>;
      text?: string;
    }>;
  };
  result?: string;
  duration_ms?: number;
  total_cost_usd?: number;
}

const DEFAULT_ALLOWED_TOOLS = ['WebSearch', 'WebFetch', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash'];
const DEFAULT_TIMEOUT_MS = 600_000;

function summarizeToolInput(name: string, input: Record<string, unknown> = {}): string {
  switch (name) {
    case 'WebSearch':
    case 'Glob':
    case 'Grep':
      return String(input.query ?? input.pattern ?? '');
    case 'WebFetch':
      return String(input.url ?? '');
    case 'Write':
    case 'Edit':
    case 'Read':
      return String(input.file_path ?? '').replace(process.cwd(), '.');
    case 'Bash':
      return String(input.command ?? '').slice(0, 70);
    default:
      return '';
  }
}

/** Parse a stream-json line into structured ProgressEvents (one line may yield multiple events). */
function parseStreamLine(line: StreamLine): ProgressEvent[] {
  if (line.type === 'system' && line.subtype === 'init') {
    return [{ kind: 'init' }];
  }
  if (line.type === 'assistant' && line.message?.content) {
    const events: ProgressEvent[] = [];
    for (const block of line.message.content) {
      if (block.type === 'tool_use' && block.name) {
        events.push({
          kind: 'tool',
          tool: block.name,
          detail: summarizeToolInput(block.name, block.input),
        });
      } else if (block.type === 'text' && block.text?.trim()) {
        const text = block.text.trim().split('\n')[0]?.slice(0, 100) ?? '';
        if (text) events.push({ kind: 'text', text });
      }
    }
    return events;
  }
  if (line.type === 'result') {
    return [{
      kind: 'done',
      durationMs: line.duration_ms,
      costUsd: line.total_cost_usd,
    }];
  }
  return [];
}

/** Format a ProgressEvent for terminal output (CLI mode). */
function formatEventForTerminal(event: ProgressEvent): string {
  switch (event.kind) {
    case 'init':
      return chalk.dim('  · Claude session initialized');
    case 'tool': {
      const detail = event.detail ? chalk.dim(`  ${event.detail}`) : '';
      return chalk.cyan(`  → ${event.tool}`) + detail;
    }
    case 'text':
      return chalk.dim(`    ${event.text}`);
    case 'done': {
      const dur = event.durationMs ? `${(event.durationMs / 1000).toFixed(1)}s` : '';
      const cost = event.costUsd ? `$${event.costUsd.toFixed(4)}` : '';
      return chalk.green('  ✓ Done') + chalk.dim(` ${dur} ${cost}`);
    }
  }
}

/**
 * Run the `claude` CLI as a subprocess. Returns the assistant's final result text.
 *
 * - In `stream` mode, parses Claude's stream-json output line-by-line.
 * - If `onProgress` is provided, structured events are dispatched there (used by the TUI).
 * - Otherwise, events are formatted with chalk and printed to stdout (used by the CLI).
 */
export async function runClaude(
  cwd: string,
  prompt: string,
  opts: RunOptions = {},
): Promise<string> {
  const tools = (opts.allowedTools ?? DEFAULT_ALLOWED_TOOLS).join(',');
  const baseArgs = ['-p', prompt, '--dangerously-skip-permissions', '--allowedTools', tools];
  const args = opts.stream ? [...baseArgs, '--output-format', 'stream-json', '--verbose'] : baseArgs;

  const subprocess = execa('claude', args, {
    cwd,
    timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    stdin: 'ignore',
    env: { ...process.env, CLAUDE_CODE_ENTRYPOINT: 'cli' },
  });

  let resultText = '';
  let stderrBuffer = '';

  if (opts.stream && subprocess.stdout) {
    subprocess.stderr?.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString();
    });

    const rl = createInterface({ input: subprocess.stdout, crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      let parsed: StreamLine;
      try {
        parsed = JSON.parse(line) as StreamLine;
      } catch {
        continue;
      }
      const events = parseStreamLine(parsed);
      for (const event of events) {
        if (opts.onProgress) {
          opts.onProgress(event);
        } else {
          console.log(formatEventForTerminal(event));
        }
      }
      if (parsed.type === 'result' && parsed.result) resultText = parsed.result;
    }
  }

  try {
    const finalResult = await subprocess;
    return resultText || finalResult.stdout;
  } catch (err) {
    if (stderrBuffer && !opts.onProgress) {
      console.error(chalk.red('\nClaude stderr:'));
      console.error(chalk.dim(stderrBuffer.slice(-2000)));
    }
    throw err;
  }
}
