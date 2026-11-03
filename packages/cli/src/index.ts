import fs from 'fs';
import http from 'http';
import path from 'path';
import { pathToFileURL } from 'url';
import { createRequire } from 'module';
import { execFile, execFileSync } from 'child_process';
import { ChangeSet, ChangedOptions, Coverage, changedFiles, coverage, githubAnnotations, issueFiles, touchesChange } from './changed';
import {
  Issue,
  ScreenSnapshot,
  SnapshotReport,
  V6yConfig,
  allRules,
  auditScreen,
  groupIssues,
  presets,
  resolveConfig,
  shouldFail,
} from '@v6y/core';
import { bold, dim, formatIssues, yellow } from './format';

export { formatIssues } from './format';
export * from './changed';

export const DEFAULT_PORT = 8973;
export const CONFIG_FILES = ['v6y.config.ts', 'v6y.config.mts', 'v6y.config.js', 'v6y.config.mjs', 'v6y.config.cjs', 'v6y.config.json'];

export function findConfigFile(cwd = process.cwd()): string | undefined {
  return CONFIG_FILES.map((f) => path.join(cwd, f)).find((f) => fs.existsSync(f));
}

// TypeScript compiles `import()` to `require()` for CommonJS output; keep a real dynamic import.
const dynamicImport = new Function('specifier', 'return import(specifier)') as (s: string) => Promise<any>; // eslint-disable-line

/** Loads v6y.config.* from `cwd`. TypeScript configs need Node ≥ 22.18 (built-in type stripping). */
export async function loadConfig(cwd = process.cwd()): Promise<V6yConfig> {
  const file = findConfigFile(cwd);
  if (!file) return {};
  let config: V6yConfig;
  if (file.endsWith('.json')) {
    config = JSON.parse(fs.readFileSync(file, 'utf8'));
  } else {
    try {
      let mod: any; // eslint-disable-line @typescript-eslint/no-explicit-any
      const restore = muteWarning('MODULE_TYPELESS_PACKAGE_JSON');
      try {
        mod = await dynamicImport(pathToFileURL(file).href);
      } catch (e) {
        // Some hosts (e.g. VM contexts) can't do dynamic import; Node ≥ 22.12 can require() ESM.
        if ((e as NodeJS.ErrnoException).code !== 'ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING') throw e;
        mod = createRequire(file)(file);
      } finally {
        restore();
      }
      config = mod.default ?? mod;
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (/\.m?ts$/.test(file) && (err.code === 'ERR_UNKNOWN_FILE_EXTENSION' || /Unknown file extension/.test(err.message))) {
        throw new Error(`${path.basename(file)}: loading TypeScript configs needs Node 22.18 or newer (you have ${process.version}). Use v6y.config.js instead.`);
      }
      throw new Error(`${path.basename(file)}: ${err.message}`);
    }
  }
  resolveConfig(config); // validate early with a helpful error
  return config;
}

/**
 * A v6y.config.ts written with `export default` in a package without
 * "type": "module" makes Node print a warning on every load. That's expected
 * here, so hide just that one while loading the config.
 */
function muteWarning(code: string): () => void {
  const original = process.emitWarning;
  process.emitWarning = function (this: unknown, warning: string | Error, ...rest: unknown[]) {
    const opts = rest[0] as { code?: string } | string | undefined;
    const warnCode = typeof opts === 'object' ? opts?.code : (rest[1] as string | undefined);
    if (warnCode === code || (warning instanceof Error && (warning as NodeJS.ErrnoException).code === code)) return;
    return (original as (...a: unknown[]) => void).call(process, warning, ...rest);
  } as typeof process.emitWarning;
  return () => {
    process.emitWarning = original;
  };
}

export function isSnapshot(value: unknown): value is ScreenSnapshot {
  const v = value as ScreenSnapshot;
  return !!v && typeof v === 'object' && typeof v.screen === 'string' && !!v.root && Array.isArray(v.root.children);
}

/** Accepts a raw snapshot or a report sent by the app. */
export function snapshotFrom(value: unknown): ScreenSnapshot | undefined {
  if (isSnapshot(value)) return value;
  const r = value as SnapshotReport;
  return r && isSnapshot(r.snapshot) ? r.snapshot : undefined;
}

export interface CheckOptions {
  /** Print issues as JSON instead of text. */
  json?: boolean;
  /** "github": also emit workflow annotations so issues show on the PR's lines. */
  format?: 'text' | 'json' | 'github';
  cwd?: string;
  /** Only issues touching changed files (and warn about stale or missing snapshots). */
  changed?: ChangedOptions | boolean;
}

export interface Analysis {
  issues: Issue[];
  /** Issues before filtering to the change. */
  total: number;
  suppressed: number;
  skippedStale: number;
  change?: ChangeSet;
  cover?: Coverage;
  failed: boolean;
  snapshots: number;
}

/** Re-audits saved snapshots with the project config, optionally limited to a change. No output. */
export async function analyze(files: string[], options: Pick<CheckOptions, 'cwd' | 'changed'> = {}): Promise<Analysis> {
  const cwd = options.cwd ?? process.cwd();
  const config = resolveConfig(await loadConfig(cwd));
  const snapshots: ScreenSnapshot[] = [];
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const item of Array.isArray(data) ? data : [data]) {
      const snapshot = snapshotFrom(item);
      if (!snapshot) throw new Error(`${f}: not a v6y snapshot`);
      snapshots.push(snapshot);
    }
  }
  const change = options.changed ? changedFiles(cwd, options.changed === true ? {} : options.changed) : undefined;
  const cover = change ? coverage(snapshots, change, cwd) : undefined;
  const staleFiles = new Map(cover?.stale.map((s) => [s.screen, new Set(s.files)]));

  let issues: Issue[] = [];
  let suppressed = 0;
  let skippedStale = 0;
  for (const snapshot of snapshots) {
    const r = auditScreen(snapshot, config);
    suppressed += r.suppressed.length;
    // A file edited after this snapshot was taken: its line numbers can't be trusted.
    const stale = staleFiles.get(snapshot.screen);
    for (const i of r.issues) {
      if (stale && issueFiles(i).some((f) => stale.has(f))) skippedStale++;
      else issues.push(i);
    }
  }
  const total = issues.length;
  if (change) issues = issues.filter((i) => touchesChange(i, change));
  return { issues, total, suppressed, skippedStale, change, cover, failed: shouldFail(issues, config), snapshots: snapshots.length };
}

/** The human-readable report for an analysis (what `v6y check` prints). */
export function renderAnalysis(a: Analysis): string {
  const out: string[] = [];
  if (a.change) {
    const n = a.change.files.size;
    out.push(dim(`Checking ${a.change.description}: ${n} changed file${n === 1 ? '' : 's'}, ${a.issues.length} of ${a.total} issues touch them.`));
  }
  out.push(formatIssues(a.issues));
  if (a.suppressed) out.push(dim(`${a.suppressed} suppressed by v6y-ignore comments or config.`));
  if (a.cover) {
    for (const s of a.cover.stale) {
      out.push(yellow(`⚠ Snapshot "${s.screen}" is older than your edits to ${s.files.join(', ')}. Re-open that screen or re-run its test.`));
    }
    if (a.skippedStale) out.push(dim(`${a.skippedStale} issue${a.skippedStale === 1 ? '' : 's'} from stale snapshots skipped (their line numbers are out of date).`));
    if (a.cover.uncovered.length) {
      out.push(yellow(`⚠ No snapshot renders ${a.cover.uncovered.join(', ')}. Open those screens in the app or add a toBeAccessible() test.`));
    }
  }
  return out.join('\n');
}

/** `v6y check <files…>`: re-audits saved snapshots with the project config. Returns the exit code. */
export async function check(files: string[], options: CheckOptions = {}): Promise<number> {
  const cwd = options.cwd ?? process.cwd();
  const format = options.format ?? (options.json ? 'json' : 'text');
  const a = await analyze(files, { cwd, changed: options.changed });
  if (format === 'json') {
    console.log(JSON.stringify(a.issues, null, 2));
  } else {
    if (format === 'github') {
      for (const line of githubAnnotations(groupIssues(a.issues).map((g) => g.issue), a.change?.prefix ?? gitPrefix(cwd))) console.log(line);
    }
    console.log(renderAnalysis(a));
  }
  return a.failed ? 1 : 0;
}

function gitPrefix(cwd: string): string {
  try {
    return execFileSync('git', ['rev-parse', '--show-prefix'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

/** Prints and saves one report. Shared by `v6y dev` and the Metro middleware. */
export function handleReport(report: SnapshotReport, { cwd = process.cwd() } = {}) {
  const { snapshot, issues, suppressed } = report;
  const outDir = path.join(cwd, '.v6y', 'snapshots');
  fs.mkdirSync(outDir, { recursive: true });
  const safe = snapshot.screen.replace(/[^\w.-]+/g, '_');
  fs.writeFileSync(path.join(outDir, `${safe}.${snapshot.platform}.json`), JSON.stringify(snapshot, null, 2));
  console.log(`\n${bold(`v6y · ${snapshot.screen}`)} ${dim(`${snapshot.platform} · ${new Date().toLocaleTimeString()}`)}`);
  console.log(formatIssues(issues, { screenHeadings: false }));
  if (suppressed?.length) console.log(dim(`${suppressed.length} suppressed.`));
}

/** Reads a JSON request body and turns it into a report (re-auditing raw snapshots). */
export function readReport(req: http.IncomingMessage, config: V6yConfig): Promise<SnapshotReport> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => (body += chunk));
    req.on('error', reject);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const snapshot = snapshotFrom(data);
        if (!snapshot) throw new Error('not a v6y snapshot');
        if (Array.isArray(data.issues)) return resolve(data as SnapshotReport);
        const r = auditScreen(snapshot, config);
        resolve({ snapshot, issues: r.issues, suppressed: r.suppressed });
      } catch (e) {
        reject(e);
      }
    });
  });
}

/** `v6y dev`: standalone report server, for setups without `withV6y` in metro.config.js. */
export function dev({ port = DEFAULT_PORT, cwd = process.cwd() } = {}): http.Server {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, name: 'v6y' }));
    }
    if (req.method !== 'POST' || (req.url !== '/v6y/report' && req.url !== '/snapshot')) {
      res.writeHead(404);
      return res.end();
    }
    try {
      const report = await readReport(req, await loadConfig(cwd));
      handleReport(report, { cwd });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ issues: report.issues.length }));
    } catch (e) {
      res.writeHead(400);
      res.end(String(e));
    }
  });

  server.listen(port, () => {
    console.log(`${bold('v6y')} listening on :${port}. Navigate around your app; each screen is audited as it appears.`);
    console.log(dim(`Point the app at it with configure({}, { endpoint: 'http://<host>:${port}/v6y/report' }).`));
    adbReverse(port);
  });
  return server;
}

function adbReverse(port: number) {
  execFile('adb', ['reverse', `tcp:${port}`, `tcp:${port}`], (err) => {
    if (!err) console.log(dim(`adb reverse tcp:${port} set up for Android devices.`));
  });
}

/** `v6y rules`: the rule catalog with each preset's level. */
export function formatRules(): string {
  const names = Object.keys(presets) as (keyof typeof presets)[];
  const cell = (v: unknown) => {
    const level = Array.isArray(v) ? v[0] : v;
    return level === 'error' ? 'error' : level === 'warning' ? 'warn' : '—';
  };
  const idW = Math.max(...allRules.map((r) => r.meta.id.length));
  const head = `${'rule'.padEnd(idW)}  ${names.map((n) => n.padEnd(11)).join(' ')}  wcag`;
  const rows = allRules.map((r) => {
    const levels = names.map((n) => cell(presets[n][r.meta.id as keyof (typeof presets)[typeof n]]).padEnd(11)).join(' ');
    return `${r.meta.id.padEnd(idW)}  ${levels}  ${r.meta.wcag.join(', ')}${r.meta.heuristic ? dim(' (heuristic)') : ''}\n${' '.repeat(idW + 2)}${dim(r.meta.title)}`;
  });
  return [bold(head), ...rows].join('\n');
}

/** The package users import defineConfig from (rewritten to `v6y` in the published bundle). */
const CONFIG_PACKAGE = '@v6y/core';
const METRO_PACKAGE = '@v6y/metro';

const CONFIG_TEMPLATE = `import { defineConfig } from '${CONFIG_PACKAGE}';

export default defineConfig({
  // 'recommended' | 'strict' | 'wcag21-aa' (EU Accessibility Act, ADA Title II) | 'wcag22-aa'
  extends: 'recommended',
  rules: {
    // 'touch-target-size': ['error', { minimum: 32 }],
    // 'missing-role': 'off',
  },
  // ignore: ['src/legacy/**'],
  // screens: { ignore: ['Storybook*'] },
});
`;

/** `v6y init`: writes v6y.config.ts and explains the one Metro line. */
export function init({ cwd = process.cwd() } = {}): number {
  const existing = findConfigFile(cwd);
  if (existing) console.log(dim(`${path.basename(existing)} already exists, leaving it alone.`));
  else {
    fs.writeFileSync(path.join(cwd, 'v6y.config.ts'), CONFIG_TEMPLATE);
    console.log(`Created ${bold('v6y.config.ts')}`);
  }
  const metro = ['metro.config.js', 'metro.config.cjs'].map((f) => path.join(cwd, f)).find((f) => fs.existsSync(f));
  const wired = metro && /withV6y/.test(fs.readFileSync(metro, 'utf8'));
  if (wired) console.log(dim('metro.config.js already uses withV6y.'));
  else {
    console.log(`\nLast step: wrap your Metro config in ${metro ? path.basename(metro) : 'metro.config.js'}:\n`);
    console.log(`  const { withV6y } = require('${METRO_PACKAGE}');`);
    console.log(`  module.exports = withV6y(getDefaultConfig(__dirname));\n`);
  }
  console.log(dim('Then start your app as usual; issues appear in the Metro terminal as you navigate.'));
  return 0;
}
