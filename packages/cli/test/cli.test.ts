import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { AddressInfo } from 'net';
import type { ScreenSnapshot } from '@v6y/core';
import { check, dev, formatIssues, formatRules, init, loadConfig } from '../src/index';

const snapshot: ScreenSnapshot = {
  screen: 'Checkout',
  platform: 'ios',
  root: {
    id: '0',
    type: 'Root',
    children: [
      {
        id: '1',
        type: 'RCTView',
        component: 'Pressable',
        interactive: true,
        role: 'button',
        frame: { x: 0, y: 0, width: 20, height: 20 },
        source: { file: 'src/Checkout.tsx', line: 42, column: 7 },
        children: [],
      },
    ],
  },
};

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'v6y-'));

afterEach(() => vi.restoreAllMocks());

describe('check', () => {
  it('reports issues with file:line and exits 1 on errors', async () => {
    const dir = tmp();
    const file = path.join(dir, 'snap.json');
    fs.writeFileSync(file, JSON.stringify(snapshot));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await check([file], { cwd: dir })).toBe(1);
    const out = log.mock.calls.join('\n');
    expect(out).toContain('src/Checkout.tsx:42:7');
    expect(out).toContain('missing-label');
  });

  it('respects v6y.config.json', async () => {
    const dir = tmp();
    const file = path.join(dir, 'snap.json');
    fs.writeFileSync(file, JSON.stringify(snapshot));
    fs.writeFileSync(path.join(dir, 'v6y.config.json'), JSON.stringify({ rules: { 'missing-label': 'off', 'touch-target-size': 'off' } }));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await check([file], { cwd: dir })).toBe(0);
  });

  it('loads v6y.config.js and v6y.config.ts', async () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'v6y.config.mjs'), `export default { extends: 'strict', failOn: 'never' };`);
    expect(await loadConfig(dir)).toEqual({ extends: 'strict', failOn: 'never' });
    const ts = tmp();
    fs.writeFileSync(path.join(ts, 'v6y.config.ts'), `const c: { failOn: 'warning' } = { failOn: 'warning' };\nexport default c;`);
    expect(await loadConfig(ts)).toEqual({ failOn: 'warning' });
  });

  it('reports invalid config clearly', async () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, 'v6y.config.json'), JSON.stringify({ rules: { 'missing-lable': 'error' } }));
    await expect(loadConfig(dir)).rejects.toThrow(/Unknown rule "missing-lable"/);
  });

  it('accepts reports sent by the app, re-auditing with the project config', async () => {
    const dir = tmp();
    const file = path.join(dir, 'report.json');
    fs.writeFileSync(file, JSON.stringify({ snapshot, issues: [], suppressed: [] }));
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await check([file], { cwd: dir })).toBe(1);
  });
});

describe('dev server', () => {
  it('accepts snapshots over HTTP, audits and saves them', async () => {
    const dir = tmp();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const server = dev({ port: 0, cwd: dir });
    await new Promise((r) => server.once('listening', r));
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/v6y/report`, { method: 'POST', body: JSON.stringify(snapshot) });
    expect(await res.json()).toEqual({ issues: 2 });
    expect(fs.existsSync(path.join(dir, '.v6y/snapshots/Checkout.ios.json'))).toBe(true);
    const bad = await fetch(`http://127.0.0.1:${port}/snapshot`, { method: 'POST', body: '{}' });
    expect(bad.status).toBe(400);
    server.close();
  });
});

describe('init and rules', () => {
  it('writes a config template once', () => {
    const dir = tmp();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    init({ cwd: dir });
    const first = fs.readFileSync(path.join(dir, 'v6y.config.ts'), 'utf8');
    expect(first).toContain("extends: 'recommended'");
    fs.writeFileSync(path.join(dir, 'v6y.config.ts'), '// mine');
    init({ cwd: dir });
    expect(fs.readFileSync(path.join(dir, 'v6y.config.ts'), 'utf8')).toBe('// mine');
  });

  it('lists every rule', () => {
    const out = formatRules();
    for (const id of ['missing-label', 'nested-interactive', 'missing-heading']) expect(out).toContain(id);
  });
});

describe('formatIssues', () => {
  it('shows the call site with the shared component it came through', () => {
    const out = formatIssues([
      {
        ruleId: 'missing-role', severity: 'error', message: 'm', wcag: ['4.1.2'], screen: 'Home', nodeId: '1',
        source: { file: 'src/components/Button.tsx', line: 9, column: 3 },
        location: { file: 'src/screens/Home.tsx', line: 42, column: 7 },
        via: { file: 'src/components/Button.tsx', line: 9, column: 3 },
      },
    ]);
    expect(out).toContain('src/screens/Home.tsx:42:7 via src/components/Button.tsx:9');
  });

  it('says so when clean', () => {
    expect(formatIssues([])).toMatch(/No accessibility issues/);
  });
});
