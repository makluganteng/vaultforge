import { SessionManager } from '../../core/session.js';
import { WikiCompiler } from '../../core/compiler.js';
import { Ingestor } from '../../core/ingestor.js';
import type { ProgressEvent, ActiveSession } from '../../types/index.js';

export interface CommandContext {
  /** Get the currently active session, or throw if none. */
  getActive: () => Promise<ActiveSession>;
  /** Stream a progress event to the terminal panel. */
  emit: (event: ProgressEvent) => void;
  /** Print a one-line plain message to the terminal panel. */
  log: (line: string) => void;
  /** Trigger a refresh of session/file state in the dashboard. */
  refresh: () => void;
}

/**
 * Tokenize a command string respecting quoted segments.
 * `vaultforge ask "what is funding"` → `['ask', 'what is funding']`
 */
export function parseCommand(input: string): string[] {
  const trimmed = input.trim().replace(/^(?:vaultforge|vf|kb)\s+/, '');
  if (!trimmed) return [];
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(trimmed)) !== null) {
    tokens.push(m[1] ?? m[2] ?? m[3] ?? '');
  }
  return tokens;
}

/**
 * Execute a parsed command. Pushes progress events through `ctx.emit`
 * so the terminal panel can render them live.
 */
export async function runCommand(input: string, ctx: CommandContext): Promise<void> {
  const tokens = parseCommand(input);
  if (tokens.length === 0) return;

  const [cmd, ...args] = tokens;

  try {
    switch (cmd) {
      case 'new': {
        const topic = args.join(' ');
        if (!topic) throw new Error('Usage: new <topic>');
        const session = await SessionManager.create(topic);
        ctx.log(`Created session ${session.id}`);
        ctx.log(`Vault: ${session.path}`);
        ctx.refresh();
        break;
      }

      case 'switch': {
        const id = args[0];
        if (!id) throw new Error('Usage: switch <id>');
        await SessionManager.switch(id);
        ctx.log(`Switched to session ${id}`);
        ctx.refresh();
        break;
      }

      case 'research': {
        const query = args.join(' ');
        if (!query) throw new Error('Usage: research <query>');
        const session = await ctx.getActive();
        ctx.log(`Researching: ${query}`);
        await WikiCompiler.research(session, query, { onProgress: ctx.emit });
        ctx.log('Research complete');
        ctx.refresh();
        break;
      }

      case 'compile': {
        const force = args.includes('--force');
        const session = await ctx.getActive();
        ctx.log(force ? 'Compiling (force rebuild)...' : 'Compiling...');
        await WikiCompiler.compile(session, { force, onProgress: ctx.emit });
        ctx.log('Compile complete');
        ctx.refresh();
        break;
      }

      case 'ask': {
        const question = args.join(' ');
        if (!question) throw new Error('Usage: ask <question>');
        const session = await ctx.getActive();
        ctx.log(`Asking: ${question}`);
        const answer = await WikiCompiler.ask(session, question, { onProgress: ctx.emit });
        ctx.log('Answer saved to outputs/');
        ctx.log(answer.slice(0, 240));
        ctx.refresh();
        break;
      }

      case 'add': {
        const source = args[0];
        if (!source) throw new Error('Usage: add <url|file>');
        const session = await ctx.getActive();
        ctx.log(`Adding: ${source}`);
        const record = await Ingestor.add(session, source);
        ctx.log(`Added: ${record.title}`);
        ctx.refresh();
        break;
      }

      case 'health': {
        const session = await ctx.getActive();
        ctx.log('Running health check...');
        const report = await WikiCompiler.health(session);
        ctx.log(`Health: ${report.score}/100  · ${report.totalArticles} articles · ${report.totalSources} sources`);
        if (report.suggestions.length > 0) {
          for (const s of report.suggestions.slice(0, 3)) ctx.log(`  → ${s}`);
        }
        break;
      }

      case 'help':
        ctx.log('Commands: new, switch, research, compile, ask, add, health');
        break;

      default:
        throw new Error(`Unknown command: ${cmd}. Type \`help\` for commands.`);
    }
  } catch (err) {
    ctx.log(`✗ ${err instanceof Error ? err.message : String(err)}`);
  }
}
