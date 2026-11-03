/**
 * Diff awareness for `v6y check --changed`: which files a change touches, which
 * issues touch them, and which snapshots are older than the code they audit.
 */
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { A11yNode, Issue, ScreenSnapshot, SourceLocation, ruleDocsUrl } from '@v6y/core';

export interface ChangedOptions {
  /** Compare against this ref (e.g. origin/main). Default: uncommitted changes vs HEAD. */
  base?: string;
  /** Only staged changes (for a pre-commit hook). */
  staged?: boolean;
}

export interface ChangeSet {
  /** Changed files, relative to the project directory (the paths issues use). */
  files: Set<string>;
  /** The project directory relative to the git root, e.g. "apps/mobile/" ("" at the root). */
  prefix: string;
  /** What was compared, for messages. */
  description: string;
}

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);

/** Files changed in the working tree, the index, or since a base ref. */
export function changedFiles(cwd: string, options: ChangedOptions = {}): ChangeSet {
  let prefix: string;
  try {
    prefix = git(cwd, ['rev-parse', '--show-prefix']).trim();
  } catch {
    throw new Error('--changed needs a git repository.');
  }
  // --relative: paths relative to cwd, and only files under it.
  const diff = (extra: string[]) => lines(git(cwd, ['diff', '--name-only', '--relative', '--diff-filter=ACMR', ...extra]));
  let files: string[];
  let description: string;
  if (options.staged) {
    files = diff(['--cached']);
    description = 'staged changes';
  } else if (options.base) {
    // Shallow CI checkouts may not contain the merge base; fall back to the base itself.
    let from = options.base;
    try {
      from = git(cwd, ['merge-base', options.base, 'HEAD']).trim();
    } catch {
      // keep options.base
    }
    files = [...diff([from]), ...lines(git(cwd, ['ls-files', '--others', '--exclude-standard']))];
    description = `changes since ${options.base}`;
  } else {
    files = [...diff(['HEAD']), ...lines(git(cwd, ['ls-files', '--others', '--exclude-standard']))];
    description = 'uncommitted changes';
  }
  return { files: new Set(files.map((f) => f.split(path.sep).join('/'))), prefix, description };
}

/** Every place an issue could be fixed: where it's reported, the component it came through, its call sites. */
export function issueFiles(issue: Issue): string[] {
  const locs: (SourceLocation | undefined)[] = [issue.location, issue.source, issue.via, ...(issue.callSites ?? [])];
  return [...new Set(locs.filter(Boolean).map((l) => l!.file))];
}

export function touchesChange(issue: Issue, change: ChangeSet): boolean {
  return issueFiles(issue).some((f) => change.files.has(f));
}

/** Files a snapshot actually renders on screen (hidden subtrees, like background tabs, don't count). */
function sourceFiles(root: A11yNode, out = new Set<string>()): Set<string> {
  if (root.hidden) return out;
  if (root.source) out.add(root.source.file);
  for (const s of root.ownerSources ?? []) out.add(s.file);
  for (const c of root.children) sourceFiles(c, out);
  return out;
}

export interface Coverage {
  /** Snapshots whose screen uses a changed file that was edited after the snapshot was taken. */
  stale: { screen: string; files: string[] }[];
  /** Changed component files (.tsx/.jsx) that no snapshot renders. */
  uncovered: string[];
}

/** Which snapshots are out of date for this change, and which changed screens no snapshot covers. */
export function coverage(snapshots: ScreenSnapshot[], change: ChangeSet, cwd: string): Coverage {
  const covered = new Set<string>();
  const stale: Coverage['stale'] = [];
  for (const snap of snapshots) {
    const files = sourceFiles(snap.root);
    files.forEach((f) => covered.add(f));
    const taken = snap.capturedAt ? Date.parse(snap.capturedAt) : NaN;
    if (Number.isNaN(taken)) continue;
    const newer = [...files].filter((f) => {
      if (!change.files.has(f)) return false;
      try {
        return fs.statSync(path.join(cwd, f)).mtimeMs > taken;
      } catch {
        return false;
      }
    });
    if (newer.length) stale.push({ screen: snap.screen, files: newer });
  }
  const uncovered = [...change.files].filter((f) => /\.(tsx|jsx)$/.test(f) && !covered.has(f) && !/(\.test|\.spec)\.|__tests__\//.test(f));
  return { stale, uncovered };
}

/** GitHub Actions workflow commands: issues appear inline on the PR's changed lines. */
export function githubAnnotations(issues: Issue[], prefix: string): string[] {
  const esc = (s: string) => s.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
  const escProp = (s: string) => esc(s).replace(/:/g, '%3A').replace(/,/g, '%2C');
  return issues
    .filter((i) => i.location ?? i.source)
    .map((i) => {
      const at = (i.location ?? i.source)!;
      const level = i.severity === 'error' ? 'error' : 'warning';
      const title = `v6y ${i.ruleId} (WCAG ${i.wcag.join(', ')})`;
      const body = `${i.message}${i.fix ? `\n\nFix: ${i.fix}` : ''}\n\nDocs: ${ruleDocsUrl(i.ruleId)}`;
      return `::${level} file=${escProp(prefix + at.file)},line=${at.line},col=${at.column},title=${escProp(title)}::${esc(body)}`;
    });
}
