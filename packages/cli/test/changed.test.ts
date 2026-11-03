import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import type { ScreenSnapshot } from '@v6y/core';
import { changedFiles, check, githubAnnotations } from '../src/index';

afterEach(() => vi.restoreAllMocks());

// Isolated from the developer's git config (signing, hooks, default branch…).
const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe', env: gitEnv }).toString();

/** A repo with the app in apps/mobile, two screens committed, and a snapshot of both. */
function repo() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v6y-git-')));
  const app = path.join(root, 'apps/mobile');
  fs.mkdirSync(path.join(app, 'src'), { recursive: true });
  fs.writeFileSync(path.join(app, 'src/Home.tsx'), 'export {}\n');
  fs.writeFileSync(path.join(app, 'src/Cart.tsx'), 'export {}\n');
  git(root, 'init', '-q', '-b', 'main');
  git(root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.');
  git(root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init');
  const button = (file: string, id: string) => ({
    id, type: 'RCTView', interactive: true, role: 'button', frame: { x: 0, y: 0, width: 48, height: 48 },
    source: { file, line: 3, column: 5 }, children: [],
  });
  const snapshot: ScreenSnapshot = {
    screen: 'Home', platform: 'ios', capturedAt: new Date(Date.now() - 60_000).toISOString(),
    root: { id: '0', type: 'Root', children: [button('src/Home.tsx', '1'), button('src/Cart.tsx', '2')] },
  };
  const snap = path.join(app, 'snap.json');
  fs.writeFileSync(snap, JSON.stringify(snapshot));
  return { root, app, snap };
}

/** Re-take the snapshot after the edits (as a test run in CI would). */
const freshen = (snap: string) => {
  const s = JSON.parse(fs.readFileSync(snap, 'utf8'));
  s.capturedAt = new Date(Date.now() + 1000).toISOString();
  fs.writeFileSync(snap, JSON.stringify(s));
};

const output = () => {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  return () => log.mock.calls.map((c) => c.join(' ')).join('\n');
};

describe('check --changed', () => {
  it('only reports issues in changed files, relative to the project inside the repo', async () => {
    const { app, snap } = repo();
    fs.appendFileSync(path.join(app, 'src/Home.tsx'), '// edit\n');
    freshen(snap);
    expect([...changedFiles(app).files].sort()).toEqual(['snap.json', 'src/Home.tsx']);
    const out = output();
    expect(await check([snap], { cwd: app, changed: true })).toBe(1);
    const text = out();
    expect(text).toContain('src/Home.tsx:3:5');
    expect(text).not.toContain('src/Cart.tsx');
    expect(text).toMatch(/1 of 2 issues touch them/);
  });

  it('passes when the change touches no file with issues', async () => {
    const { app, snap } = repo();
    fs.writeFileSync(path.join(app, 'README.md'), 'hi\n');
    output();
    expect(await check([snap], { cwd: app, changed: true })).toBe(0);
  });

  it('--staged looks at the index only', async () => {
    const { root, app, snap } = repo();
    fs.appendFileSync(path.join(app, 'src/Home.tsx'), '// edit\n');
    fs.appendFileSync(path.join(app, 'src/Cart.tsx'), '// edit\n');
    freshen(snap);
    git(root, 'add', 'apps/mobile/src/Cart.tsx');
    expect([...changedFiles(app, { staged: true }).files]).toEqual(['src/Cart.tsx']);
    const out = output();
    await check([snap], { cwd: app, changed: { staged: true } });
    expect(out()).toContain('src/Cart.tsx:3:5');
  });

  it('--base compares against a ref', async () => {
    const { root, app } = repo();
    git(root, 'checkout', '-qb', 'feature');
    fs.appendFileSync(path.join(app, 'src/Cart.tsx'), '// edit\n');
    git(root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qam', 'edit cart');
    const files = changedFiles(app, { base: 'main' }).files;
    expect(files.has('src/Cart.tsx')).toBe(true);
    expect(files.has('src/Home.tsx')).toBe(false);
  });

  it('warns about stale snapshots and changed screens no snapshot covers', async () => {
    const { app, snap } = repo();
    fs.appendFileSync(path.join(app, 'src/Home.tsx'), '// edit after the snapshot\n');
    fs.writeFileSync(path.join(app, 'src/Settings.tsx'), 'export {}\n');
    const out = output();
    await check([snap], { cwd: app, changed: true });
    const text = out();
    expect(text).toMatch(/Snapshot "Home" is older than your edits to src\/Home\.tsx/);
    expect(text).toMatch(/No snapshot renders src\/Settings\.tsx/);
    // Its Home.tsx line numbers are out of date, so that issue is skipped rather than misplaced.
    expect(text).toMatch(/1 issue from stale snapshots skipped/);
    expect(text).not.toContain('src/Home.tsx:3:5');
  });

  it('emits GitHub annotations with repo-relative paths', async () => {
    const { app, snap } = repo();
    fs.appendFileSync(path.join(app, 'src/Home.tsx'), '// edit\n');
    freshen(snap);
    const out = output();
    await check([snap], { cwd: app, changed: true, format: 'github' });
    expect(out()).toMatch(/^::error file=apps\/mobile\/src\/Home\.tsx,line=3,col=5,title=v6y missing-label \(WCAG 4\.1\.2\)::/m);
  });

  it('escapes annotation text', () => {
    const [line] = githubAnnotations(
      [{ ruleId: 'r', severity: 'warning', message: 'a,b: 100%\nnext', wcag: ['1.1.1'], screen: 's', nodeId: '1', source: { file: 'a,b.tsx', line: 1, column: 1 } }],
      '',
    );
    expect(line).toBe('::warning file=a%2Cb.tsx,line=1,col=1,title=v6y r (WCAG 1.1.1)::a,b: 100%25%0Anext');
  });
});
