import React from 'react';
import { Text } from 'ink';
import type { ProgressEvent } from '../../types/index.js';

export function ProgressLine({ event }: { event: ProgressEvent }): React.ReactElement {
  switch (event.kind) {
    case 'init':
      return <Text dimColor>  · Claude initialized</Text>;
    case 'tool':
      return (
        <Text>
          <Text color="cyan">  → {event.tool}</Text>
          {event.detail ? <Text dimColor>  {event.detail}</Text> : null}
        </Text>
      );
    case 'text':
      return <Text dimColor>    {event.text}</Text>;
    case 'done': {
      const dur = event.durationMs ? `${(event.durationMs / 1000).toFixed(1)}s` : '';
      const cost = event.costUsd ? `$${event.costUsd.toFixed(4)}` : '';
      return (
        <Text color="green">
          {'  ✓ Done '}
          <Text dimColor>
            {dur} {cost}
          </Text>
        </Text>
      );
    }
    default:
      return <Text> </Text>;
  }
}
