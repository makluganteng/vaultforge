export interface SessionConfig {
  id: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
  sources: Source[];
  status: 'active' | 'archived';
}

export interface Source {
  id: string;
  url?: string;
  filePath: string;
  type: 'web' | 'pdf' | 'file' | 'markdown';
  title: string;
  addedAt: string;
}

export interface ActiveSession {
  config: SessionConfig;
  dir: string;
}

export interface KbConfig {
  sessionsDir: string;
  activeSession: string | null;
  defaultModel: string;
}

export interface ResearchOptions {
  maxSources?: number;
  depth?: 'shallow' | 'normal' | 'deep';
}

export interface CompileOptions {
  force?: boolean;
}

export interface RepoIngestOptions {
  depth?: 'shallow' | 'normal' | 'deep';
  includeTests?: boolean;
  force?: boolean;
}

export interface RepoInfo {
  /** Absolute path to the repo root (same as process.cwd() when the command is run). */
  absPath: string;
  /** Directory basename — used as the wiki topic. */
  name: string;
  /** Detected primary language, if any. */
  primaryLanguage?: string;
  /** Known manifest files found at the repo root (e.g. package.json). */
  manifestFiles: string[];
  /** True if a README.md / README.rst / README exists at the root. */
  hasReadme: boolean;
  /** Current git commit SHA, if this is a git repo. */
  commitSha?: string;
  /** Current git branch, if this is a git repo. */
  branch?: string;
}

export interface RepoWikiMeta {
  type: 'repo';
  name: string;
  primaryLanguage?: string;
  commitSha?: string;
  branch?: string;
  depth: 'shallow' | 'normal' | 'deep';
  includeTests: boolean;
  lastRun: string;
}

export type SortMode = 'title' | 'type' | 'words' | 'recent' | 'backlinks';

export interface ProgressEvent {
  kind: 'init' | 'tool' | 'text' | 'done';
  /** Tool name when kind === 'tool' */
  tool?: string;
  /** Tool argument summary, e.g. file path or query */
  detail?: string;
  /** Assistant text snippet when kind === 'text' */
  text?: string;
  /** Total duration in ms when kind === 'done' */
  durationMs?: number;
  /** Total cost in USD when kind === 'done' */
  costUsd?: number;
}

export interface HealthReport {
  totalArticles: number;
  totalSources: number;
  orphanedSources: string[];
  missingConcepts: string[];
  suggestions: string[];
  score: number;
}
