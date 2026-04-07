import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { WikiFile, WikiFileType } from '../utils/wiki-files.js';
import { buildWikiGraph, layoutGraph, type WikiGraph, type GraphNode } from '../utils/wiki-graph.js';

interface Props {
  files: WikiFile[];
  highlightSlug: string | null;
  focused: boolean;
  /** Called when user navigates to a neighbor inside the graph. */
  onHighlightChange: (slug: string) => void;
  /** Called when user presses Enter to "select" a node. */
  onSelect: (file: WikiFile) => void;
}

interface Cell { char: string; color?: string }

const TYPE_COLORS: Record<WikiFileType, string> = {
  concept: 'green', summary: 'yellow', output: 'magenta', index: 'cyan', raw: 'gray',
};

const DIR_VECS = {
  up: [0, -1] as const, down: [0, 1] as const, left: [-1, 0] as const, right: [1, 0] as const,
};

function makeGrid(rows: number, cols: number): Cell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ char: ' ' }) as Cell),
  );
}

/** Bresenham's line algorithm — paints `·` on empty cells along a line. */
function drawLine(grid: Cell[][], x0: number, y0: number, x1: number, y1: number, color: string): void {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy, x = x0, y = y0;
  for (let i = 0; i < dx + dy + 1; i++) {
    if (y >= 0 && y < rows && x >= 0 && x < cols && grid[y][x].char === ' ') {
      grid[y][x] = { char: '·', color };
    }
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
}

/** Glyph based on connection degree. */
function nodeGlyph(degree: number): { char: string; color?: string } {
  if (degree === 0) return { char: '·', color: 'gray' };
  if (degree <= 2) return { char: '●' };
  if (degree <= 5) return { char: '⬤' };
  return { char: '◉' };
}

/** Find the nearest connected neighbor in a compass direction. */
function findNeighbor(
  graph: WikiGraph, current: GraphNode, direction: 'up' | 'down' | 'left' | 'right',
): GraphNode | null {
  const neighborSlugs = new Set<string>();
  for (const e of graph.edges) {
    if (e.from === current.slug) neighborSlugs.add(e.to);
    if (e.to === current.slug) neighborSlugs.add(e.from);
  }
  const neighbors = graph.nodes.filter((n) => neighborSlugs.has(n.slug));
  if (neighbors.length === 0) return null;
  const dirVec = DIR_VECS[direction];
  let best: GraphNode | null = null;
  let bestScore = 0;
  for (const n of neighbors) {
    const dx = n.x - current.x, dy = n.y - current.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const score = (dx * dirVec[0] + dy * dirVec[1]) / dist;
    if (score > bestScore) { bestScore = score; best = n; }
  }
  return best;
}

function buildCanvas(
  graph: WikiGraph, cols: number, rows: number,
  highlightSlug: string | null, matching: Set<string> | null,
): Cell[][] {
  const grid = makeGrid(rows, cols);
  if (graph.nodes.length === 0) return grid;
  const xs = graph.nodes.map((n) => n.x), ys = graph.nodes.map((n) => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1, rangeY = maxY - minY || 1, margin = 2;
  const project = (x: number, y: number) => ({
    col: Math.floor(((x - minX) / rangeX) * (cols - margin * 2 - 1)) + margin,
    row: Math.floor(((y - minY) / rangeY) * (rows - margin * 2 - 1)) + margin,
  });
  const positions = new Map<string, { col: number; row: number }>();
  for (const node of graph.nodes) positions.set(node.slug, project(node.x, node.y));

  // Edges: dim those that don't touch a matching node
  for (const edge of graph.edges) {
    const a = positions.get(edge.from), b = positions.get(edge.to);
    if (!a || !b) continue;
    const lit = !matching || matching.has(edge.from) || matching.has(edge.to);
    drawLine(grid, a.col, a.row, b.col, b.row, lit ? 'gray' : 'blackBright');
  }
  // Nodes overlay edges
  for (const node of graph.nodes) {
    const p = positions.get(node.slug);
    if (!p || p.row < 0 || p.row >= rows || p.col < 0 || p.col >= cols) continue;
    if (node.slug === highlightSlug) {
      grid[p.row][p.col] = { char: '◉', color: 'white' };
      continue;
    }
    if (matching && !matching.has(node.slug)) {
      grid[p.row][p.col] = { char: '·', color: 'gray' };
      continue;
    }
    const g = nodeGlyph(node.degree);
    grid[p.row][p.col] = { char: g.char, color: g.color ?? TYPE_COLORS[node.type] ?? 'white' };
  }
  return grid;
}

/** Render a row by collapsing consecutive same-color cells into spans. */
function renderRow(row: Cell[], key: number): React.ReactElement {
  const segments: Array<{ text: string; color?: string }> = [];
  let current: { text: string; color?: string } | null = null;
  for (const cell of row) {
    if (current && current.color === cell.color) current.text += cell.char;
    else { if (current) segments.push(current); current = { text: cell.char, color: cell.color }; }
  }
  if (current) segments.push(current);
  return (
    <Text key={key}>
      {segments.map((s, i) =>
        s.color ? <Text key={i} color={s.color}>{s.text}</Text> : <Text key={i}>{s.text}</Text>,
      )}
    </Text>
  );
}

export function GraphPanel({
  files, highlightSlug, focused, onHighlightChange, onSelect,
}: Props): React.ReactElement {
  const { stdout } = useStdout();
  const [graph, setGraph] = useState<WikiGraph | null>(null);
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  // All tags across the file set, sorted alphabetically
  const sortedTags = useMemo(() => {
    const set = new Set<string>();
    for (const f of files) for (const t of f.tags) set.add(t);
    return Array.from(set).sort();
  }, [files]);

  // Reset filter if it no longer exists in the file set
  useEffect(() => {
    if (tagFilter && !sortedTags.includes(tagFilter)) setTagFilter(null);
  }, [sortedTags, tagFilter]);

  // (Re)build graph + layout when files change OR `r` is pressed
  const slugKey = files.map((f) => f.slug).join('|');
  useEffect(() => {
    let cancelled = false;
    buildWikiGraph(files).then((g) => {
      if (cancelled) return;
      layoutGraph(g, 100, 60, 180);
      setGraph(g);
    });
    return () => { cancelled = true; };
  }, [slugKey, layoutVersion]);

  // Slugs that match the active tag filter (plus their direct neighbors)
  const matchingSlugs = useMemo<Set<string> | null>(() => {
    if (!tagFilter || !graph) return null;
    const direct = new Set<string>();
    for (const f of files) if (f.tags.includes(tagFilter)) direct.add(f.slug);
    const expanded = new Set<string>(direct);
    for (const e of graph.edges) {
      if (direct.has(e.from)) expanded.add(e.to);
      if (direct.has(e.to)) expanded.add(e.from);
    }
    return expanded;
  }, [tagFilter, graph, files]);

  useInput(
    (input, key) => {
      if (!graph) return;
      const current = highlightSlug ? graph.nodes.find((n) => n.slug === highlightSlug) : null;
      if (key.upArrow || key.downArrow || key.leftArrow || key.rightArrow) {
        if (!current) return;
        const dir = key.upArrow ? 'up' : key.downArrow ? 'down' : key.leftArrow ? 'left' : 'right';
        const next = findNeighbor(graph, current, dir);
        if (next) onHighlightChange(next.slug);
        return;
      }
      if (key.return) {
        if (current) {
          const file = files.find((f) => f.slug === current.slug);
          if (file) onSelect(file);
        }
        return;
      }
      if (input === 't') {
        const options: (string | null)[] = [null, ...sortedTags];
        const cur = options.indexOf(tagFilter);
        setTagFilter(options[(cur + 1) % options.length]);
        return;
      }
      if (input === 'c') { setTagFilter(null); return; }
      if (input === 'r') setLayoutVersion((v) => v + 1);
    },
    { isActive: focused },
  );

  // Estimated canvas size: subtract sessions(28) + wiki(32) + borders/padding
  const cols = Math.max(30, (stdout?.columns ?? 120) - 72);
  const rows = Math.max(12, Math.min(28, (stdout?.rows ?? 30) - 16));
  const borderColor = focused ? 'cyan' : 'gray';

  if (!graph || graph.nodes.length === 0) {
    return (
      <Box borderStyle="round" borderColor={borderColor} flexGrow={1} flexDirection="column"
           paddingX={1} justifyContent="center" alignItems="center">
        <Text dimColor>No wiki files to graph yet.</Text>
      </Box>
    );
  }

  const grid = buildCanvas(graph, cols, rows, highlightSlug, matchingSlugs);
  const highlighted = highlightSlug ? graph.nodes.find((n) => n.slug === highlightSlug) : null;

  return (
    <Box borderStyle="round" borderColor={borderColor} flexGrow={1} flexDirection="column" paddingX={1}>
      <Text bold color="cyan">GRAPH</Text>
      <Text dimColor>
        {graph.nodes.length} notes · {graph.edges.length} links
        {tagFilter ? ` · #${tagFilter}` : ''}
        {highlighted ? ` · highlighted: ${highlighted.title} (${highlighted.degree} connections)` : ''}
      </Text>
      <Text> </Text>
      <Box flexDirection="column">{grid.map((row, i) => renderRow(row, i))}</Box>
    </Box>
  );
}
