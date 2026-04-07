import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import SelectInput from 'ink-select-input';
import { readWikiBody, type WikiFile } from '../utils/wiki-files.js';

interface Props {
  file: WikiFile | null;
  focused: boolean;
  /** All wiki files in the session — needed to validate that a wikilink target exists. */
  allFiles: WikiFile[];
  /** Called when user follows a wikilink. The slug is the target file's slug. */
  onFollowLink: (slug: string) => void;
}

const MAX_BODY_LINES = 2000;

function renderLine(line: string, key: number): React.ReactElement {
  if (/^#{1,6} /.test(line)) {
    const level = line.match(/^(#+)/)?.[1].length ?? 1;
    const text = line.replace(/^#+\s*/, '');
    const colors = ['cyan', 'cyan', 'magenta', 'yellow', 'green', 'blue'] as const;
    return (
      <Text key={key} bold color={colors[Math.min(level - 1, 5)]}>
        {text}
      </Text>
    );
  }
  if (/^[-*]\s/.test(line)) {
    return <Text key={key}>{'  \u00b7 ' + line.replace(/^[-*]\s/, '')}</Text>;
  }
  if (/^\d+\.\s/.test(line)) {
    return <Text key={key}>{'  ' + line}</Text>;
  }
  if (/^>\s?/.test(line)) {
    return (
      <Text key={key} dimColor italic>
        {line}
      </Text>
    );
  }
  if (!line.trim()) return <Text key={key}> </Text>;
  return <Text key={key}>{line}</Text>;
}

function extractLinks(body: string, allFiles: WikiFile[]): WikiFile[] {
  const slugs = new Set(allFiles.map((f) => f.slug));
  const found = new Set<string>();
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const target = m[1].split('|')[0].split('/').pop()?.replace(/\.md$/, '') ?? '';
    if (target && slugs.has(target)) found.add(target);
  }
  return [...found].map((slug) => allFiles.find((f) => f.slug === slug)!).filter(Boolean);
}

export function PreviewPanel({ file, focused, allFiles, onFollowLink }: Props): React.ReactElement {
  const { stdout } = useStdout();
  const [body, setBody] = useState<string>('');
  const [truncated, setTruncated] = useState<boolean>(false);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  useEffect(() => {
    setScrollOffset(0);
    setPickerOpen(false);
    setFlashMessage(null);
  }, [file?.path]);

  useEffect(() => {
    let cancelled = false;
    if (!file) {
      setBody('');
      setTruncated(false);
      return;
    }
    readWikiBody(file.path)
      .then((res) => {
        if (cancelled) return;
        const allLines = res.body.split('\n');
        if (allLines.length > MAX_BODY_LINES) {
          setBody(allLines.slice(0, MAX_BODY_LINES).join('\n'));
          setTruncated(true);
        } else {
          setBody(res.body);
          setTruncated(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setBody('');
        setTruncated(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file?.path]);

  useEffect(() => {
    if (!flashMessage) return;
    const t = setTimeout(() => setFlashMessage(null), 1000);
    return () => clearTimeout(t);
  }, [flashMessage]);

  const lines = useMemo(() => body.split('\n'), [body]);
  const visibleHeight = Math.max(10, (stdout?.rows ?? 30) - 18);
  const maxOffset = Math.max(0, lines.length - visibleHeight);

  const links = useMemo(() => extractLinks(body, allFiles), [body, allFiles]);

  useInput(
    (input, key) => {
      if (key.escape) {
        if (pickerOpen) setPickerOpen(false);
        return;
      }
      if (input === 'f') {
        if (links.length === 0) {
          setFlashMessage('No wikilinks in this file');
          return;
        }
        if (links.length === 1) {
          onFollowLink(links[0].slug);
          return;
        }
        setPickerOpen(true);
        return;
      }
      if (input === 'j' || key.downArrow) {
        setScrollOffset((o) => Math.min(maxOffset, o + 1));
        return;
      }
      if (input === 'k' || key.upArrow) {
        setScrollOffset((o) => Math.max(0, o - 1));
        return;
      }
      if (key.pageDown || input === ' ') {
        setScrollOffset((o) => Math.min(maxOffset, o + 10));
        return;
      }
      if (key.pageUp) {
        setScrollOffset((o) => Math.max(0, o - 10));
        return;
      }
      if (input === '0') {
        setScrollOffset(0);
        return;
      }
      if (input === 'G') {
        setScrollOffset(maxOffset);
        return;
      }
    },
    { isActive: focused && !pickerOpen },
  );

  const borderColor = focused ? 'cyan' : 'gray';

  if (!file) {
    return (
      <Box
        borderStyle="round"
        borderColor={borderColor}
        flexGrow={1}
        flexDirection="column"
        paddingX={1}
        justifyContent="center"
        alignItems="center"
      >
        <Text dimColor>Select a file to preview</Text>
      </Box>
    );
  }

  const visible = lines.slice(scrollOffset, scrollOffset + visibleHeight);
  const showScrollIndicator = lines.length > visibleHeight;
  const headerTitle = flashMessage ?? file.title;

  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      flexGrow={1}
      flexDirection="column"
      paddingX={1}
    >
      <Text bold color={flashMessage ? 'yellow' : 'white'}>
        {headerTitle}
      </Text>
      <Text dimColor>
        {`${file.type.toUpperCase()} \u00b7 ${file.wordCount.toLocaleString()} words \u00b7 ${file.backlinks} backlinks`}
      </Text>
      <Text dimColor>
        {`updated ${file.updated.slice(0, 10)}${
          showScrollIndicator
            ? ` \u00b7 [${Math.min(scrollOffset + 1, lines.length)}/${lines.length}]`
            : ''
        }`}
      </Text>
      <Text> </Text>
      {pickerOpen ? (
        <Box flexDirection="column">
          <Text bold color="cyan">FOLLOW LINK:</Text>
          <SelectInput
            items={links.map((l) => ({ key: l.slug, label: l.title, value: l.slug }))}
            onSelect={(item) => {
              setPickerOpen(false);
              onFollowLink(item.value as string);
            }}
          />
        </Box>
      ) : (
        <Box flexDirection="column">
          {visible.map((line, i) => renderLine(line, scrollOffset + i))}
          {truncated && scrollOffset + visibleHeight >= lines.length ? (
            <Text dimColor>... (truncated)</Text>
          ) : null}
        </Box>
      )}
    </Box>
  );
}
