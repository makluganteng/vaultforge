import { readFile } from 'node:fs/promises';
import type { WikiFile, WikiFileType } from './wiki-files.js';

export interface GraphNode {
  slug: string;
  title: string;
  type: WikiFileType;
  x: number;
  y: number;
  dx: number;
  dy: number;
  degree: number;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface WikiGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Build a graph by extracting [[wikilink]] edges from each file. */
export async function buildWikiGraph(files: WikiFile[]): Promise<WikiGraph> {
  const slugs = new Set(files.map((f) => f.slug));
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    let raw: string;
    try {
      raw = await readFile(file.path, 'utf-8');
    } catch {
      continue;
    }
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    let m: RegExpExecArray | null;
    while ((m = linkRegex.exec(raw)) !== null) {
      const target = m[1].split('|')[0].split('/').pop()?.replace(/\.md$/, '') ?? '';
      if (!target || target === file.slug || !slugs.has(target)) continue;
      const key = `${file.slug}->${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: file.slug, to: target });
    }
  }

  // Initialize nodes in a small ring so the force-directed layout
  // has a non-degenerate starting state.
  const nodes: GraphNode[] = files.map((file, i) => {
    const angle = (i / Math.max(1, files.length)) * Math.PI * 2;
    return {
      slug: file.slug,
      title: file.title,
      type: file.type,
      x: Math.cos(angle) * 10,
      y: Math.sin(angle) * 10,
      dx: 0,
      dy: 0,
      degree: 0,
    };
  });

  const nodeMap = new Map(nodes.map((n) => [n.slug, n]));
  for (const edge of edges) {
    const a = nodeMap.get(edge.from);
    const b = nodeMap.get(edge.to);
    if (a) a.degree++;
    if (b) b.degree++;
  }

  return { nodes, edges };
}

/** Run Fruchterman-Reingold force-directed layout in-place. */
export function layoutGraph(graph: WikiGraph, width = 100, height = 100, iterations = 150): void {
  const { nodes, edges } = graph;
  if (nodes.length < 2) return;

  const area = width * height;
  const k = Math.sqrt(area / nodes.length) * 0.75;
  let temperature = width / 8;
  const cooling = 0.96;

  const nodeMap = new Map(nodes.map((n) => [n.slug, n]));

  for (let iter = 0; iter < iterations; iter++) {
    for (const v of nodes) {
      v.dx = 0;
      v.dy = 0;
    }

    // Repulsive forces (every pair)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const v = nodes[i];
        const u = nodes[j];
        let dx = v.x - u.x;
        let dy = v.y - u.y;
        let d = Math.sqrt(dx * dx + dy * dy);
        if (d < 0.01) {
          dx = (Math.random() - 0.5) * 0.1;
          dy = (Math.random() - 0.5) * 0.1;
          d = Math.sqrt(dx * dx + dy * dy);
        }
        const force = (k * k) / d;
        const fx = (dx / d) * force;
        const fy = (dy / d) * force;
        v.dx += fx;
        v.dy += fy;
        u.dx -= fx;
        u.dy -= fy;
      }
    }

    // Attractive forces (each edge)
    for (const e of edges) {
      const v = nodeMap.get(e.from);
      const u = nodeMap.get(e.to);
      if (!v || !u) continue;
      const dx = v.x - u.x;
      const dy = v.y - u.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (d * d) / k;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      v.dx -= fx;
      v.dy -= fy;
      u.dx += fx;
      u.dy += fy;
    }

    // Apply, capped by temperature
    for (const v of nodes) {
      const d = Math.sqrt(v.dx * v.dx + v.dy * v.dy);
      if (d > 0) {
        v.x += (v.dx / d) * Math.min(d, temperature);
        v.y += (v.dy / d) * Math.min(d, temperature);
      }
      v.x = Math.max(-width / 2, Math.min(width / 2, v.x));
      v.y = Math.max(-height / 2, Math.min(height / 2, v.y));
    }

    temperature *= cooling;
  }
}
