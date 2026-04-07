import React from 'react';
import { Box, Text, useInput } from 'ink';

export interface SessionRow {
  id: string;
  topic: string;
  dir: string;
  articles: number;
  words: number;
  isActive: boolean;
}

interface Props {
  sessions: SessionRow[];
  selectedIndex: number;
  focused: boolean;
  onSelect: (id: string) => void;
  onMove: (delta: number) => void;
  onCreateNew: () => void;
}

export function SessionsPanel({
  sessions,
  selectedIndex,
  focused,
  onSelect,
  onMove,
  onCreateNew,
}: Props): React.ReactElement {
  useInput(
    (input, key) => {
      if (key.upArrow) {
        onMove(-1);
        return;
      }
      if (key.downArrow) {
        onMove(1);
        return;
      }
      if (key.return) {
        if (sessions.length > 0 && selectedIndex >= 0 && selectedIndex < sessions.length) {
          onSelect(sessions[selectedIndex].id);
        } else {
          onCreateNew();
        }
        return;
      }
      if (input === 'n') {
        onCreateNew();
      }
    },
    { isActive: focused },
  );

  return (
    <Box
      flexDirection="column"
      width={28}
      borderStyle="round"
      borderColor={focused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text color="cyan" dimColor bold>
          SESSIONS
        </Text>
      </Box>

      {sessions.length === 0 ? (
        <Text dimColor>No sessions</Text>
      ) : (
        sessions.map((session, i) => {
          const isCursor = i === selectedIndex;
          const nameColor = session.isActive ? 'cyan' : 'white';
          return (
            <Box key={session.id} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color="cyan">{isCursor ? '▸ ' : '  '}</Text>
                <Text color={nameColor} bold={session.isActive || isCursor}>
                  {session.topic}
                </Text>
              </Box>
              <Box>
                <Text>{'  '}</Text>
                <Text dimColor>
                  {session.articles} articles · {session.words.toLocaleString()} words
                </Text>
              </Box>
            </Box>
          );
        })
      )}

      <Box marginTop={1}>
        <Text color={focused ? 'cyan' : 'gray'} dimColor={!focused}>
          + new session
        </Text>
      </Box>
    </Box>
  );
}
