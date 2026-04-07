import React from 'react';
import { Box, Text } from 'ink';

export interface Shortcut {
  key: string;
  label: string;
}

interface Props {
  shortcuts: Shortcut[];
}

export function ShortcutBar({ shortcuts }: Props): React.ReactElement {
  return (
    <Box paddingX={1} flexWrap="wrap">
      {shortcuts.map((s, i) => (
        <Box key={i} marginRight={2}>
          <Text color="black" backgroundColor="cyan" bold>
            {' '}
            {s.key}
            {' '}
          </Text>
          <Text dimColor> {s.label}</Text>
        </Box>
      ))}
    </Box>
  );
}
