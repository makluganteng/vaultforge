import React, { useEffect, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { ProgressLine } from '../components/progress-line.js';
import type { ProgressEvent } from '../../types/index.js';

export type LogEntry =
  | { kind: 'event'; event: ProgressEvent }
  | { kind: 'message'; text: string }
  | { kind: 'command'; text: string };

interface Props {
  log: LogEntry[];
  inputValue: string;
  onInputChange: (v: string) => void;
  onSubmit: (v: string) => void;
  focused: boolean;
  busy: boolean;
  placeholder?: string;
  history: string[];
  totalCost: number;
}

const MAX_VISIBLE_LINES = 8;
const COMMANDS = ['new', 'switch', 'research', 'compile', 'ask', 'add', 'health', 'help'];

// NOTE: Tab is captured here for autocomplete; parent must skip Tab focus
// cycling when this panel is focused.
export function TerminalPanel({
  log,
  inputValue,
  onInputChange,
  onSubmit,
  focused,
  busy,
  placeholder,
  history,
  totalCost,
}: Props): React.ReactElement {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [historyCursor, setHistoryCursor] = useState(history.length);
  const [tabMatches, setTabMatches] = useState<string[]>([]);
  const [tabIndex, setTabIndex] = useState(0);

  // Reset history cursor when the parent's history array grows (after a submit).
  useEffect(() => {
    setHistoryCursor(history.length);
  }, [history.length]);

  // Clamp scroll if log shrinks.
  useEffect(() => {
    const maxOffset = Math.max(0, log.length - MAX_VISIBLE_LINES);
    if (scrollOffset > maxOffset) setScrollOffset(maxOffset);
  }, [log.length, scrollOffset]);

  useInput(
    (input, key) => {
      // Tab autocomplete (cycles on repeated Tab)
      if (key.tab) {
        if (tabMatches.length === 0) {
          const tokens = inputValue.split(/\s+/);
          const prefix = tokens[0] ?? '';
          const matches = COMMANDS.filter((c) => c.startsWith(prefix));
          if (matches.length === 0) return;
          setTabMatches(matches);
          setTabIndex(0);
          onInputChange(matches[0] + (matches.length === 1 ? ' ' : ''));
        } else {
          const next = (tabIndex + 1) % tabMatches.length;
          setTabIndex(next);
          onInputChange(tabMatches[next] + (tabMatches.length === 1 ? ' ' : ''));
        }
        return;
      }

      // Reset tab cycling on any other meaningful key.
      if (tabMatches.length > 0) {
        setTabMatches([]);
        setTabIndex(0);
      }

      // Scroll: PgUp / Shift+Up
      if (key.pageUp || (key.shift && key.upArrow)) {
        const maxOffset = Math.max(0, log.length - MAX_VISIBLE_LINES);
        setScrollOffset((o) => Math.min(maxOffset, o + 1));
        return;
      }
      // Scroll: PgDn / Shift+Down
      if (key.pageDown || (key.shift && key.downArrow)) {
        setScrollOffset((o) => Math.max(0, o - 1));
        return;
      }
      // Esc: return to live tail
      if (key.escape) {
        if (scrollOffset > 0) setScrollOffset(0);
        return;
      }

      // History navigation (plain arrows, no shift)
      if (key.upArrow) {
        if (history.length === 0) return;
        const next = Math.max(0, historyCursor - 1);
        setHistoryCursor(next);
        onInputChange(history[next] ?? '');
        return;
      }
      if (key.downArrow) {
        if (history.length === 0) return;
        const next = Math.min(history.length, historyCursor + 1);
        setHistoryCursor(next);
        onInputChange(next === history.length ? '' : (history[next] ?? ''));
        return;
      }
    },
    { isActive: focused },
  );

  const visibleStart = Math.max(0, log.length - MAX_VISIBLE_LINES - scrollOffset);
  const visibleEnd = log.length - scrollOffset;
  const visible = log.slice(visibleStart, visibleEnd);

  const costLabel = totalCost > 0 ? `$${totalCost.toFixed(4)}` : '';
  const scrolled = scrollOffset > 0;

  const handleSubmit = (v: string): void => {
    setHistoryCursor(history.length + 1);
    setScrollOffset(0);
    setTabMatches([]);
    setTabIndex(0);
    onSubmit(v);
  };

  return (
    <Box flexDirection="column">
      <Box
        borderStyle="round"
        borderColor={focused ? 'cyan' : 'gray'}
        flexDirection="column"
        paddingX={1}
        height={MAX_VISIBLE_LINES + 2}
      >
        <Box justifyContent="space-between">
          <Box>
            <Text dimColor color="cyan">
              TERMINAL
            </Text>
            {scrolled ? (
              <Text dimColor> [scrolled · ESC for live]</Text>
            ) : null}
          </Box>
          {costLabel ? <Text dimColor color="cyan">{costLabel}</Text> : null}
        </Box>
        {visible.length === 0 ? (
          <Text dimColor>  Welcome. Type a command below or press Tab to autocomplete.</Text>
        ) : (
          visible.map((entry, i) => {
            const key = visibleStart + i;
            if (entry.kind === 'event') {
              return <ProgressLine key={key} event={entry.event} />;
            }
            if (entry.kind === 'command') {
              return (
                <Text key={key} color="cyan">
                  {'\u25B8 '}
                  {entry.text}
                </Text>
              );
            }
            return <Text key={key}>  {entry.text}</Text>;
          })
        )}
      </Box>

      <Box
        borderStyle="round"
        borderColor={focused ? 'cyan' : 'gray'}
        paddingX={1}
        marginTop={0}
      >
        {busy ? (
          <Text color="yellow">
            <Spinner type="dots" />
            {' '}
          </Text>
        ) : (
          <Text color="cyan">{'\u25B8 '}</Text>
        )}
        <TextInput
          value={inputValue}
          onChange={onInputChange}
          onSubmit={handleSubmit}
          placeholder={placeholder ?? 'try: kb ask "compare funding models"'}
          showCursor={focused}
        />
        <Box flexGrow={1} />
        <Text dimColor>{'\u23CE run'}</Text>
      </Box>
    </Box>
  );
}
