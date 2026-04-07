import React from 'react';
import { Box, Text, useInput } from 'ink';

interface Props {
  onClose: () => void;
}

interface Section {
  title: string;
  bindings: Array<{ key: string; description: string }>;
}

const SECTIONS: Section[] = [
  {
    title: 'Global',
    bindings: [
      { key: 'Tab', description: 'cycle focus between panels' },
      { key: '?', description: 'toggle this help overlay' },
      { key: 'g', description: 'toggle graph view (when not in terminal)' },
      { key: 'Ctrl+C', description: 'quit' },
    ],
  },
  {
    title: 'Sessions panel',
    bindings: [
      { key: '↑↓', description: 'move cursor' },
      { key: 'Enter', description: 'switch to highlighted session' },
      { key: 'n', description: 'start new session command' },
    ],
  },
  {
    title: 'Wiki panel',
    bindings: [
      { key: '↑↓', description: 'move cursor' },
      { key: 'Enter', description: 'select file (focus preview)' },
      { key: '/', description: 'search files by name' },
      { key: 's', description: 'cycle sort mode' },
      { key: 't', description: 'cycle tag filter' },
      { key: 'c', description: 'clear search and tag filter' },
      { key: 'Esc', description: 'exit search mode' },
    ],
  },
  {
    title: 'Preview panel',
    bindings: [
      { key: 'j / ↓', description: 'scroll down 1 line' },
      { key: 'k / ↑', description: 'scroll up 1 line' },
      { key: 'PgDn / Space', description: 'scroll down 10 lines' },
      { key: 'PgUp', description: 'scroll up 10 lines' },
      { key: '0', description: 'jump to top' },
      { key: 'G', description: 'jump to bottom' },
      { key: 'f', description: 'follow wikilink in current file' },
      { key: '[', description: 'go back in nav history' },
      { key: ']', description: 'go forward in nav history' },
    ],
  },
  {
    title: 'Graph panel',
    bindings: [
      { key: '↑↓←→', description: 'navigate to nearest connected neighbor' },
      { key: 'Enter', description: 'select highlighted node' },
      { key: 't', description: 'cycle tag filter' },
      { key: 'r', description: 're-run layout' },
    ],
  },
  {
    title: 'Terminal panel',
    bindings: [
      { key: 'type & Enter', description: 'run command (research, ask, compile, add, health, new, switch)' },
      { key: '↑↓', description: 'history navigation' },
      { key: 'Tab', description: 'autocomplete command' },
      { key: 'PgUp/PgDn', description: 'scroll log' },
      { key: 'Esc', description: 'return to live tail' },
    ],
  },
];

export function HelpOverlay({ onClose }: Props): React.ReactElement {
  useInput((input, key) => {
    if (key.escape || input === '?' || input === 'q') onClose();
  });

  return (
    <Box
      borderStyle="double"
      borderColor="cyan"
      flexDirection="column"
      paddingX={2}
      paddingY={1}
    >
      <Text bold color="cyan">
        kb · keyboard shortcuts
      </Text>
      <Text> </Text>
      {SECTIONS.map((section) => (
        <Box key={section.title} flexDirection="column" marginBottom={1}>
          <Text bold color="yellow">
            {section.title}
          </Text>
          {section.bindings.map((b) => (
            <Box key={b.key}>
              <Box width={18}>
                <Text color="cyan">{b.key}</Text>
              </Box>
              <Text dimColor>{b.description}</Text>
            </Box>
          ))}
        </Box>
      ))}
      <Text dimColor>Press Esc, ?, or q to close</Text>
    </Box>
  );
}
