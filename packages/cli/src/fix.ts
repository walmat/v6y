/**
 * `v6y fix`: writes mechanical accessibility fixes into source, at the JSX
 * element each issue points to, as a plain reviewable diff. Fixes that need
 * judgment (what a button does, what an image shows) are listed for a person
 * or a coding agent instead.
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { A11yNode, Issue, ScreenSnapshot, SourceLocation } from '@v6y/core';
import { analyze, snapshotFrom } from './index';
import { ChangedOptions } from './changed';

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface FixOptions {
  cwd?: string;
  changed?: ChangedOptions | boolean;
  /** Report what would change without writing files. */
  dryRun?: boolean;
}

type Edit =
  | { kind: 'add-attr'; name: string; value: string; reason: string }
  | { kind: 'remove-attr'; name: string; reason: string }
  | { kind: 'set-attr'; name: string; value: string; reason: string };

interface PlannedFix {
  issue: Issue;
  at: SourceLocation;
  edit: Edit;
}

export interface FixResult {
  /** Fixes written (or that would be, with dryRun), by file. */
  applied: { file: string; line: number; description: string; ruleId: string }[];
  /** Issues that need a person or an agent, with why. */
  manual: { issue: Issue; why: string }[];
  /** Planned fixes skipped (stale snapshot, element not found, already present). */
  skipped: { file: string; line: number; why: string }[];
}

/** Apps ship to both platforms: 48 meets Material (48dp) and Apple (44pt). */
const TARGET = 48;

const MANUAL_WHY: Record<string, string> = {
  'missing-label': 'needs a label that says what it does',
  'meaningless-label': 'needs a label that says what it does',
  'image-missing-label': 'needs a description of the image (or remove accessible if decorative)',
  'input-missing-label': 'needs the field name as a label',
  'duplicate-label': 'needs labels that say which item each control acts on',
  'nested-interactive': 'needs the controls restructured as siblings',
  'text-contrast': 'needs a colour change (the colour is usually set in a style elsewhere)',
  'state-not-exposed': 'needs accessibilityState wired to the component state',
};

function nodesById(root: A11yNode): Map<string, A11yNode> {
  const map = new Map<string, A11yNode>();
  const walk = (n: A11yNode) => {
    map.set(n.id, n);
    n.children.forEach(walk);
  };
  walk(root);
  return map;
}

/** The mechanical edit for an issue, if there is one. */
function planEdit(issue: Issue, node: A11yNode | undefined, platformMin: number): Edit | undefined {
  switch (issue.ruleId) {
    case 'missing-role':
      return { kind: 'add-attr', name: 'accessibilityRole', value: '"button"', reason: 'add accessibilityRole="button"' };
    case 'missing-heading':
      // Only when v6y found the likely title (the issue is on a text node).
      return issue.message.startsWith('"')
        ? { kind: 'add-attr', name: 'accessibilityRole', value: '"header"', reason: 'mark the title as a heading' }
        : undefined;
    case 'touch-target-size': {
      if (!node?.frame || node.hitSlop) return undefined;
      const slop = Math.ceil((platformMin - Math.min(node.frame.width, node.frame.height)) / 2);
      return slop > 0 ? { kind: 'add-attr', name: 'hitSlop', value: `{${slop}}`, reason: `add hitSlop={${slop}} (${platformMin}pt target on iOS and Android)` } : undefined;
    }
    case 'font-scaling-disabled':
      return node?.allowFontScaling === false
        ? { kind: 'remove-attr', name: 'allowFontScaling', reason: 'remove allowFontScaling={false}' }
        : { kind: 'set-attr', name: 'maxFontSizeMultiplier', value: '{2}', reason: 'raise maxFontSizeMultiplier to 2' };
    default:
      return undefined;
  }
}

/** Babel from the user's project (every React Native project has it). */
function loadBabel(cwd: string): any {
  const req = createRequire(path.join(cwd, 'package.json'));
  try {
    return req('@babel/core');
  } catch {
    throw new Error('v6y fix needs @babel/core in the project (React Native and Expo projects include it).');
  }
}

/** Finds the JSX opening element that starts at a 1-based line and column. */
function findOpening(ast: any, line: number, column: number): any {
  let found: any;
  const visit = (n: any) => {
    if (found || !n || typeof n.type !== 'string') return;
    if (n.type === 'JSXOpeningElement' && n.loc?.start.line === line && n.loc.start.column + 1 === column) {
      found = n;
      return;
    }
    for (const key of Object.keys(n)) {
      if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
      const v = n[key];
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object') visit(v);
    }
  };
  visit(ast.program ?? ast);
  return found;
}

const attrNamed = (opening: any, name: string) =>
  opening.attributes.find((a: any) => a.type === 'JSXAttribute' && a.name?.name === name);

/** Applies planned edits to one file's text; returns the new text and which edits applied. */
function applyToFile(babel: any, file: string, text: string, fixes: PlannedFix[]) {
  const ast = babel.parseSync(text, {
    filename: file,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['jsx', 'typescript'] },
  });
  const splices: { start: number; end: number; insert: string }[] = [];
  const applied: PlannedFix[] = [];
  const skipped: { fix: PlannedFix; why: string }[] = [];
  const seen = new Set<string>();
  for (const fix of fixes) {
    const key = `${fix.at.line}:${fix.at.column}:${fix.edit.kind}:${fix.edit.name}`;
    if (seen.has(key)) continue; // same element, same fix (e.g. several snapshots)
    seen.add(key);
    const opening = findOpening(ast, fix.at.line, fix.at.column);
    if (!opening) {
      skipped.push({ fix, why: 'element not found at that position (file changed?)' });
      continue;
    }
    const existing = attrNamed(opening, fix.edit.name);
    if (fix.edit.kind === 'add-attr') {
      if (existing) {
        skipped.push({ fix, why: `${fix.edit.name} is already set` });
        continue;
      }
      splices.push({ start: opening.name.end, end: opening.name.end, insert: ` ${fix.edit.name}=${fix.edit.value}` });
    } else if (fix.edit.kind === 'remove-attr') {
      if (!existing) {
        skipped.push({ fix, why: `${fix.edit.name} not found` });
        continue;
      }
      // Remove the attribute and the whitespace before it.
      let start = existing.start;
      while (start > 0 && /[ \t]/.test(text[start - 1]!)) start--;
      if (text[start - 1] === '\n') {
        start--;
        while (start > 0 && /[ \t]/.test(text[start - 1]!)) start--;
      }
      splices.push({ start, end: existing.end, insert: '' });
    } else {
      if (existing?.value) splices.push({ start: existing.value.start, end: existing.value.end, insert: fix.edit.value });
      else splices.push({ start: opening.name.end, end: opening.name.end, insert: ` ${fix.edit.name}=${fix.edit.value}` });
    }
    applied.push(fix);
  }
  // Several insertions at one point (two attributes on one element) read in a fixed order.
  const ORDER = ['accessibilityRole', 'accessibilityLabel', 'accessibilityState', 'hitSlop'];
  const rank = (insert: string) => {
    const i = ORDER.findIndex((name) => insert.startsWith(` ${name}=`));
    return i < 0 ? ORDER.length : i;
  };
  splices.sort((a, b) => a.start - b.start || rank(a.insert) - rank(b.insert));
  const merged: typeof splices = [];
  for (const sp of splices) {
    const same = merged.find((m) => m.start === sp.start && m.end === sp.end && m.start === m.end && sp.start === sp.end);
    if (same) same.insert += sp.insert;
    else merged.push({ ...sp });
  }
  let out = text;
  for (const sp of merged.sort((a, b) => b.start - a.start)) out = out.slice(0, sp.start) + sp.insert + out.slice(sp.end);
  return { text: out, applied, skipped };
}

/** Plans and applies fixes for the issues found in the given snapshots. */
export async function fix(files: string[], options: FixOptions = {}): Promise<FixResult> {
  const cwd = options.cwd ?? process.cwd();
  const analysis = await analyze(files, { cwd, changed: options.changed });

  // Node data (frames, props) for each issue, from its snapshot.
  const snapshots: ScreenSnapshot[] = files.flatMap((f) => {
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    return (Array.isArray(data) ? data : [data]).map(snapshotFrom).filter(Boolean) as ScreenSnapshot[];
  });
  const byScreen = new Map(snapshots.map((s) => [s.screen, { snap: s, nodes: nodesById(s.root) }]));

  const result: FixResult = { applied: [], manual: [], skipped: [] };
  const planned = new Map<string, PlannedFix[]>();
  for (const issue of analysis.issues) {
    const s = byScreen.get(issue.screen);
    const node = s?.nodes.get(issue.nodeId);
    const edit = issue.source ? planEdit(issue, node, TARGET) : undefined;
    if (!edit || !issue.source) {
      result.manual.push({ issue, why: MANUAL_WHY[issue.ruleId] ?? 'needs a manual fix' });
      continue;
    }
    // Line numbers are only trustworthy if the file hasn't changed since the snapshot.
    const abs = path.join(cwd, issue.source.file);
    const taken = s?.snap.capturedAt ? Date.parse(s.snap.capturedAt) : NaN;
    if (!fs.existsSync(abs)) {
      result.skipped.push({ file: issue.source.file, line: issue.source.line, why: 'file not found' });
      continue;
    }
    if (!Number.isNaN(taken) && fs.statSync(abs).mtimeMs > taken) {
      result.skipped.push({ file: issue.source.file, line: issue.source.line, why: 'file changed since the snapshot; re-run its test first' });
      continue;
    }
    const list = planned.get(issue.source.file) ?? [];
    list.push({ issue, at: issue.source, edit });
    planned.set(issue.source.file, list);
  }

  if (planned.size) {
    const babel = loadBabel(cwd);
    for (const [file, fixes] of planned) {
      const abs = path.join(cwd, file);
      const before = fs.readFileSync(abs, 'utf8');
      const { text, applied, skipped } = applyToFile(babel, file, before, fixes);
      for (const a of applied) result.applied.push({ file, line: a.at.line, description: a.edit.reason, ruleId: a.issue.ruleId });
      for (const k of skipped) result.skipped.push({ file, line: k.fix.at.line, why: k.why });
      if (!options.dryRun && text !== before) fs.writeFileSync(abs, text);
    }
  }
  return result;
}

/** Human-readable summary of a fix run. */
export function renderFix(r: FixResult, dryRun = false): string {
  const out: string[] = [];
  const verb = dryRun ? 'Would fix' : 'Fixed';
  if (r.applied.length) {
    out.push(`${verb} ${r.applied.length} issue${r.applied.length === 1 ? '' : 's'}:`);
    for (const a of r.applied) out.push(`  ✓ ${a.file}:${a.line}  ${a.description}  [${a.ruleId}]`);
  } else out.push('Nothing to fix automatically.');
  if (r.manual.length) {
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const { issue, why } of r.manual) {
      const at = issue.location ?? issue.source;
      const key = `${issue.ruleId}|${at?.file}:${at?.line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`  • ${at ? `${at.file}:${at.line}` : issue.screen}  ${why}  [${issue.ruleId}]`);
    }
    out.push('', `${lines.length} need a person or your coding agent:`, ...lines);
  }
  if (r.skipped.length) {
    out.push('', 'Skipped:');
    for (const s of r.skipped) out.push(`  - ${s.file}:${s.line}  ${s.why}`);
  }
  if (r.applied.length && !dryRun) out.push('', 'Review the changes with `git diff`, then re-run your tests to refresh the snapshots.');
  return out.join('\n');
}
