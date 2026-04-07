import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import type { SortMode } from '../../types/index.js';
import type { WikiFile, WikiFileType } from '../utils/wiki-files.js';

interface Props {
  files: WikiFile[];
  focused: boolean;
  onSelect: (file: WikiFile) => void;
  onHighlight: (file: WikiFile) => void;
}

const TYPE_COLORS: Record<WikiFileType, string> = {
  concept: 'green',
  summary: 'yellow',
  output: 'magenta',
  index: 'cyan',
  raw: 'gray',
};

const TYPE_ORDER: Record<WikiFileType, number> = {
  concept: 0,
  summary: 1,
  output: 2,
  index: 3,
  raw: 4,
};

const SORT_CYCLE: SortMode[] = ['title', 'type', 'words', 'recent', 'backlinks'];

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : text.slice(0, Math.max(0, max - 1)) + '…';

function sortFiles(list: WikiFile[], mode: SortMode): WikiFile[] {
  const copy = [...list];
  if (mode === 'title') return copy.sort((a, b) => a.title.localeCompare(b.title));
  if (mode === 'type')
    return copy.sort(
      (a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || a.title.localeCompare(b.title),
    );
  if (mode === 'words') return copy.sort((a, b) => b.wordCount - a.wordCount);
  if (mode === 'recent') return copy.sort((a, b) => b.updated.localeCompare(a.updated));
  return copy.sort((a, b) => b.backlinks - a.backlinks);
}

export function WikiPanel({ files, focused, onSelect, onHighlight }: Props): React.ReactElement {
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('title');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [cursorIndex, setCursorIndex] = useState(0);

  useEffect(() => setCursorIndex(0), [files]);

  const sortedTags = useMemo(() => {
    const set = new Set<string>();
    for (const f of files) for (const t of f.tags) set.add(t);
    return Array.from(set).sort();
  }, [files]);

  const visibleFiles = useMemo(() => {
    let list = files;
    const q = searchQuery.trim().toLowerCase();
    if (q) list = list.filter((f) => f.title.toLowerCase().includes(q) || f.slug.includes(q));
    if (tagFilter) list = list.filter((f) => f.tags.includes(tagFilter));
    return sortFiles(list, sortMode);
  }, [files, searchQuery, tagFilter, sortMode]);

  useEffect(() => {
    if (cursorIndex >= visibleFiles.length)
      setCursorIndex(Math.max(0, visibleFiles.length - 1));
  }, [visibleFiles.length, cursorIndex]);

  useInput(
    (input, key) => {
      if (key.upArrow || key.downArrow) {
        const delta = key.upArrow ? -1 : 1;
        const next = Math.max(0, Math.min(visibleFiles.length - 1, cursorIndex + delta));
        setCursorIndex(next);
        if (visibleFiles[next]) onHighlight(visibleFiles[next]);
        return;
      }
      if (key.return) {
        if (visibleFiles[cursorIndex]) onSelect(visibleFiles[cursorIndex]);
        return;
      }
      if (input === '/') return setSearchMode(true);
      if (input === 's') {
        const idx = SORT_CYCLE.indexOf(sortMode);
        return setSortMode(SORT_CYCLE[(idx + 1) % SORT_CYCLE.length]);
      }
      if (input === 't') {
        const options: (string | null)[] = [null, ...sortedTags];
        const cur = options.indexOf(tagFilter);
        return setTagFilter(options[(cur + 1) % options.length]);
      }
      if (input === 'c') {
        setSearchQuery('');
        setTagFilter(null);
      }
    },
    { isActive: focused && !searchMode },
  );

  useInput(
    (_input, key) => {
      if (key.escape) {
        setSearchMode(false);
        setSearchQuery('');
      }
    },
    { isActive: focused && searchMode },
  );

  const handleSearchSubmit = (): void => {
    setSearchMode(false);
    if (visibleFiles[0]) {
      setCursorIndex(0);
      onHighlight(visibleFiles[0]);
    }
  };

  return (
    <Box
      flexDirection="column"
      width={32}
      borderStyle="round"
      borderColor={focused ? 'cyan' : 'gray'}
      paddingX={1}
    >
      <Box>
        <Text color="cyan" dimColor bold>WIKI</Text>
      </Box>
      {searchMode && (
        <Box>
          <Text color="cyan">/</Text>
          <TextInput value={searchQuery} onChange={setSearchQuery} onSubmit={handleSearchSubmit} />
        </Box>
      )}
      <Box marginBottom={1}>
        <Text dimColor>
          sort: {sortMode}
          {tagFilter ? ` · #${tagFilter}` : ''}
        </Text>
      </Box>
      {visibleFiles.length === 0 ? (
        <Text dimColor>No files</Text>
      ) : (
        visibleFiles.map((file, i) => {
          const isCursor = i === cursorIndex;
          return (
            <Box key={file.path} justifyContent="space-between">
              <Box>
                <Text color="cyan">{isCursor ? '▸ ' : '  '}</Text>
                <Text bold={isCursor} color={isCursor ? 'white' : undefined}>
                  {truncate(file.title, 20)}
                </Text>
              </Box>
              <Text color={TYPE_COLORS[file.type]}>{file.type}</Text>
            </Box>
          );
        })
      )}
      <Box marginTop={1}>
        <Text dimColor>{visibleFiles.length}/{files.length} files</Text>
      </Box>
    </Box>
  );
}
