import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, useApp, useInput } from 'ink';
import { SessionsPanel, type SessionRow } from './panels/sessions-panel.js';
import { WikiPanel } from './panels/wiki-panel.js';
import { PreviewPanel } from './panels/preview-panel.js';
import { GraphPanel } from './panels/graph-panel.js';
import { TerminalPanel, type LogEntry } from './panels/terminal-panel.js';
import { StatusBar } from './panels/status-bar.js';
import { HelpOverlay } from './components/help-overlay.js';
import { ShortcutBar, type Shortcut } from './components/shortcut-bar.js';
import { SessionManager } from '../core/session.js';
import { listSessionFiles, getSessionStats, type WikiFile } from './utils/wiki-files.js';
import { runCommand } from './utils/run-command.js';
import { loadHistory, saveHistory } from './utils/history.js';
import type { ActiveSession, ProgressEvent, SessionConfig } from '../types/index.js';

type FocusTarget = 'sessions' | 'wiki' | 'preview' | 'terminal';
const FOCUS_ORDER: FocusTarget[] = ['sessions', 'wiki', 'terminal', 'preview'];

interface AppState {
  sessions: SessionRow[];
  active: ActiveSession | null;
  wikiFiles: WikiFile[];
  previewFile: WikiFile | null;
  sessionsCursor: number;
}

export function App(): React.ReactElement {
  const { exit } = useApp();
  const [focus, setFocus] = useState<FocusTarget>('terminal');
  const [viewMode, setViewMode] = useState<'preview' | 'graph'>('preview');
  const [showHelp, setShowHelp] = useState(false);
  const [state, setState] = useState<AppState>({
    sessions: [],
    active: null,
    wikiFiles: [],
    previewFile: null,
    sessionsCursor: 0,
  });

  // Terminal state
  const [log, setLog] = useState<LogEntry[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Claude Code ready');
  const [history, setHistory] = useState<string[]>([]);
  const [totalCost, setTotalCost] = useState(0);

  // Navigation history (file slugs visited via wikilink follow / back / forward)
  const [navStack, setNavStack] = useState<string[]>([]);
  const [navIndex, setNavIndex] = useState(-1);

  const refreshTrigger = useRef(0);

  // Load command history once
  useEffect(() => {
    loadHistory().then(setHistory);
  }, []);

  // Load sessions + active session + wiki files
  const loadAll = useCallback(async () => {
    const allSessions = await SessionManager.list().catch(() => []);
    let active: ActiveSession | null = null;
    try {
      active = await SessionManager.getActive();
    } catch {
      active = null;
    }

    const rows: SessionRow[] = await Promise.all(
      allSessions.map(async (s: SessionConfig & { dir: string }) => {
        const stats = await getSessionStats(s.dir).catch(() => ({ articles: 0, words: 0 }));
        return {
          id: s.id,
          topic: s.topic,
          dir: s.dir,
          articles: stats.articles,
          words: stats.words,
          isActive: s.id === active?.config.id,
        };
      }),
    );

    const wikiFiles = active ? await listSessionFiles(active.dir).catch(() => []) : [];

    setState((prev) => ({
      sessions: rows,
      active,
      wikiFiles,
      previewFile: prev.previewFile && wikiFiles.find((f) => f.slug === prev.previewFile?.slug)
        ? wikiFiles.find((f) => f.slug === prev.previewFile?.slug) ?? null
        : wikiFiles[0] ?? null,
      sessionsCursor: Math.max(0, rows.findIndex((r) => r.isActive)),
    }));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll, refreshTrigger.current]);

  const refresh = useCallback(() => {
    refreshTrigger.current++;
    loadAll();
  }, [loadAll]);

  // Top-level keyboard:
  //  - Tab cycles focus (BUT skip when terminal focused — terminal uses Tab for autocomplete)
  //  - Ctrl+C exits
  //  - g toggles graph view (when not in terminal)
  //  - ? toggles help
  //  - [ / ] navigate back/forward through wikilink history
  useInput((rawInput, key) => {
    if (showHelp) return; // overlay handles its own input

    if (key.tab && focus !== 'terminal') {
      setFocus((curr) => {
        const idx = FOCUS_ORDER.indexOf(curr);
        return FOCUS_ORDER[(idx + 1) % FOCUS_ORDER.length];
      });
      return;
    }
    if (key.ctrl && rawInput === 'c') exit();
    if (focus !== 'terminal' && rawInput === 'g') {
      setViewMode((m) => (m === 'preview' ? 'graph' : 'preview'));
    }
    if (focus !== 'terminal' && rawInput === '?') {
      setShowHelp(true);
    }
    // Back/forward — only when terminal is NOT focused
    if (focus !== 'terminal' && rawInput === '[') navigateBack();
    if (focus !== 'terminal' && rawInput === ']') navigateForward();
  });

  // Navigation API
  const navigateTo = useCallback(
    (slug: string) => {
      setState((prev) => {
        const file = prev.wikiFiles.find((f) => f.slug === slug);
        if (!file) return prev;
        return { ...prev, previewFile: file };
      });
      setNavStack((prev) => {
        const truncated = prev.slice(0, navIndex + 1);
        return [...truncated, slug];
      });
      setNavIndex((prev) => prev + 1);
    },
    [navIndex],
  );

  const navigateBack = useCallback(() => {
    if (navIndex <= 0) return;
    const newIndex = navIndex - 1;
    const slug = navStack[newIndex];
    setNavIndex(newIndex);
    setState((prev) => {
      const file = prev.wikiFiles.find((f) => f.slug === slug);
      return file ? { ...prev, previewFile: file } : prev;
    });
  }, [navIndex, navStack]);

  const navigateForward = useCallback(() => {
    if (navIndex >= navStack.length - 1) return;
    const newIndex = navIndex + 1;
    const slug = navStack[newIndex];
    setNavIndex(newIndex);
    setState((prev) => {
      const file = prev.wikiFiles.find((f) => f.slug === slug);
      return file ? { ...prev, previewFile: file } : prev;
    });
  }, [navIndex, navStack]);

  // Command execution
  const handleSubmit = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value) return;
      setInput('');
      // Append to history (dedupe consecutive duplicates) and persist
      setHistory((prev) => {
        const next = prev[prev.length - 1] === value ? prev : [...prev, value];
        saveHistory(next);
        return next;
      });
      setLog((prev) => [...prev, { kind: 'command', text: value }]);
      setBusy(true);
      setStatus('Running...');

      await runCommand(value, {
        getActive: () => SessionManager.getActive(),
        emit: (event: ProgressEvent) => {
          setLog((prev) => [...prev, { kind: 'event', event }]);
          if (event.kind === 'done' && event.costUsd) {
            setTotalCost((prev) => prev + (event.costUsd ?? 0));
          }
        },
        log: (line: string) => {
          setLog((prev) => [...prev, { kind: 'message', text: line }]);
        },
        refresh,
      });

      setBusy(false);
      setStatus('Claude Code ready');
    },
    [refresh],
  );

  // Sessions panel handlers
  const handleSessionMove = (delta: number) => {
    setState((prev) => ({
      ...prev,
      sessionsCursor: Math.max(0, Math.min(prev.sessions.length - 1, prev.sessionsCursor + delta)),
    }));
  };
  const handleSessionSelect = async (id: string) => {
    await SessionManager.switch(id).catch(() => {});
    refresh();
  };
  const handleCreateNew = () => {
    setInput('new ');
    setFocus('terminal');
  };

  // Wiki panel handlers (panel owns its own cursor now)
  const handleWikiSelect = (file: WikiFile) => {
    setState((prev) => ({ ...prev, previewFile: file }));
    setFocus('preview');
  };
  const handleWikiHighlight = (file: WikiFile) => {
    setState((prev) => ({ ...prev, previewFile: file }));
  };

  // Preview panel: follow a wikilink
  const handleFollowLink = (slug: string) => {
    navigateTo(slug);
  };

  // Graph panel handlers
  const handleGraphHighlight = (slug: string) => {
    setState((prev) => {
      const file = prev.wikiFiles.find((f) => f.slug === slug);
      return file ? { ...prev, previewFile: file } : prev;
    });
  };
  const handleGraphSelect = (file: WikiFile) => {
    setState((prev) => ({ ...prev, previewFile: file }));
    setViewMode('preview');
    setFocus('preview');
  };

  if (showHelp) {
    return (
      <Box flexDirection="column" padding={1}>
        <HelpOverlay onClose={() => setShowHelp(false)} />
      </Box>
    );
  }

  const activeRow = state.sessions.find((s) => s.isActive);
  const shortcuts = getContextShortcuts(focus, viewMode);

  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        <SessionsPanel
          sessions={state.sessions}
          selectedIndex={state.sessionsCursor}
          focused={focus === 'sessions'}
          onSelect={handleSessionSelect}
          onMove={handleSessionMove}
          onCreateNew={handleCreateNew}
        />
        <WikiPanel
          files={state.wikiFiles}
          focused={focus === 'wiki'}
          onSelect={handleWikiSelect}
          onHighlight={handleWikiHighlight}
        />
        {viewMode === 'graph' ? (
          <GraphPanel
            files={state.wikiFiles}
            highlightSlug={state.previewFile?.slug ?? null}
            focused={focus === 'preview'}
            onHighlightChange={handleGraphHighlight}
            onSelect={handleGraphSelect}
          />
        ) : (
          <PreviewPanel
            file={state.previewFile}
            focused={focus === 'preview'}
            allFiles={state.wikiFiles}
            onFollowLink={handleFollowLink}
          />
        )}
      </Box>

      <TerminalPanel
        log={log}
        inputValue={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        focused={focus === 'terminal'}
        busy={busy}
        placeholder={'try: ask "compare funding models"  ·  press ? for help'}
        history={history}
        totalCost={totalCost}
      />
      <ShortcutBar shortcuts={shortcuts} />
      <StatusBar
        sessionTopic={state.active?.config.topic}
        articles={activeRow?.articles}
        words={activeRow?.words}
        status={status}
        totalCost={totalCost}
      />
    </Box>
  );
}

/** Compute the keyboard shortcuts to display based on the currently focused panel. */
function getContextShortcuts(
  focus: FocusTarget,
  viewMode: 'preview' | 'graph',
): Shortcut[] {
  switch (focus) {
    case 'sessions':
      return [
        { key: '↑↓', label: 'navigate' },
        { key: '⏎', label: 'switch' },
        { key: 'n', label: 'new' },
        { key: 'Tab', label: 'next panel' },
        { key: '?', label: 'help' },
      ];
    case 'wiki':
      return [
        { key: '↑↓', label: 'navigate' },
        { key: '⏎', label: 'open' },
        { key: '/', label: 'search' },
        { key: 's', label: 'sort' },
        { key: 't', label: 'tag' },
        { key: 'c', label: 'clear' },
        { key: 'Tab', label: 'next' },
        { key: '?', label: 'help' },
      ];
    case 'preview':
      if (viewMode === 'graph') {
        return [
          { key: '↑↓←→', label: 'walk graph' },
          { key: '⏎', label: 'select' },
          { key: 't', label: 'tag filter' },
          { key: 'r', label: 'relayout' },
          { key: 'g', label: 'preview' },
          { key: 'Tab', label: 'next' },
          { key: '?', label: 'help' },
        ];
      }
      return [
        { key: 'j/k', label: 'scroll' },
        { key: 'PgUp/Dn', label: 'page' },
        { key: 'f', label: 'follow link' },
        { key: '[ ]', label: 'back/fwd' },
        { key: 'g', label: 'graph' },
        { key: 'Tab', label: 'next' },
        { key: '?', label: 'help' },
      ];
    case 'terminal':
      return [
        { key: '⏎', label: 'run' },
        { key: '↑↓', label: 'history' },
        { key: 'Tab', label: 'autocomplete' },
        { key: 'PgUp/Dn', label: 'scroll log' },
        { key: 'Esc', label: 'live tail' },
        { key: 'Tab→', label: 'leave for ?' },
      ];
  }
}
