import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';

interface Props {
  sessionTopic?: string;
  articles?: number;
  words?: number;
  status?: string;
  totalCost?: number;
}

function formatWords(words: number): string {
  if (words > 1000) return `${(words / 1000).toFixed(0)}K`;
  return `${words}`;
}

function formatNow(): string {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${time} \u00b7 ${yyyy}-${mm}-${dd}`;
}

export function StatusBar({
  sessionTopic,
  articles,
  words,
  status,
  totalCost,
}: Props): React.ReactElement {
  const [now, setNow] = useState<string>(formatNow());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(formatNow());
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const sep = '  \u2502  ';
  const topicNode = sessionTopic ? (
    <Text backgroundColor="cyan" color="black">
      {sessionTopic}
    </Text>
  ) : (
    <Text backgroundColor="cyan" color="black" dimColor>
      no session
    </Text>
  );

  const articlesText = `${articles ?? 0} articles`;
  const wordsText = `${formatWords(words ?? 0)} words`;
  const statusText = status ?? 'idle';
  const costText = totalCost && totalCost > 0 ? `$${totalCost.toFixed(4)}` : null;

  return (
    <Box paddingX={1}>
      <Text backgroundColor="cyan" color="black">
        {' '}
      </Text>
      {topicNode}
      <Text backgroundColor="cyan" color="black">
        {sep}
        {articlesText}
        {sep}
        {wordsText}
        {sep}
        {statusText}
        {costText ? `${sep}${costText}` : ''}
        {sep}
        {now}
        {' '}
      </Text>
    </Box>
  );
}
