/**
 * Tests the built output (dist/), exactly as Metro loads it. Run `npm run build` first
 * (the root `npm test` script does).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import type { AddressInfo } from 'net';

const req = createRequire(import.meta.url);
const dist = path.resolve(import.meta.dirname, '../dist');

let project: string;
let upstreamCalls: any[];

beforeAll(() => {
  project = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v6y-metro-')));
  fs.writeFileSync(path.join(project, 'package.json'), JSON.stringify({ name: 'app', main: 'index.js' }));
  fs.writeFileSync(path.join(project, 'index.js'), '');
  fs.writeFileSync(path.join(project, 'v6y.config.js'), "module.exports = { extends: 'strict' };");
  // A fake upstream transformer that records what it's given.
  fs.writeFileSync(
    path.join(project, 'upstream.js'),
    `module.exports = { transform(a) { globalThis.__v6yCalls.push(a); return { ast: null }; }, getCacheKey() { return 'up'; }, extra: 1 };`,
  );
});

afterEach(() => vi.restoreAllMocks());

function load() {
  (globalThis as any).__v6yCalls = upstreamCalls = [];
  for (const k of Object.keys(req.cache)) if (k.startsWith(dist)) delete req.cache[k];
  const { withV6y } = req(path.join(dist, 'index.js'));
  const config = withV6y({
    projectRoot: project,
    transformer: { babelTransformerPath: path.join(project, 'upstream.js'), other: true },
    resolver: {},
    server: {},
  });
  const transformer = req(config.transformer.babelTransformerPath);
  return { config, transformer };
}

describe('withV6y', () => {
  it('swaps in the v6y transformer and keeps other settings', () => {
    const { config } = load();
    expect(config.transformer.babelTransformerPath).toBe(path.join(dist, 'transformer.js'));
    expect(config.transformer.other).toBe(true);
    expect(process.env.V6Y_ENTRY).toBe(path.join(project, 'index.js'));
  });

  it('is a no-op when disabled', () => {
    const { withV6y } = req(path.join(dist, 'index.js'));
    const c = { projectRoot: project };
    expect(withV6y(c, { enabled: false })).toBe(c);
  });

  it('resolves the project config module to v6y.config.js and defers everything else', () => {
    const { config } = load();
    const context = { resolveRequest: vi.fn(() => ({ type: 'empty' })) };
    expect(config.resolver.resolveRequest(context, '@v6y/react-native/project-config', 'ios')).toEqual({
      type: 'sourceFile',
      filePath: path.join(project, 'v6y.config.js'),
    });
    expect(config.resolver.resolveRequest(context, 'react', 'ios')).toEqual({ type: 'empty' });
    expect(context.resolveRequest).toHaveBeenCalledWith(context, 'react', 'ios');
  });
});

describe('transformer', () => {
  const opts = (dev: boolean) => ({ dev, projectRoot: project });

  it('adds the babel plugin to app code in dev only', () => {
    const { transformer } = load();
    transformer.transform({ filename: 'src/App.tsx', src: 'x', options: opts(true), plugins: ['a'] });
    transformer.transform({ filename: 'node_modules/lib/index.js', src: 'x', options: opts(true), plugins: ['a'] });
    transformer.transform({ filename: 'src/App.tsx', src: 'x', options: opts(false), plugins: ['a'] });
    expect(upstreamCalls[0].plugins).toHaveLength(2);
    expect(upstreamCalls[0].plugins[1][1]).toEqual({ root: project, enabled: true });
    expect(upstreamCalls[1].plugins).toEqual(['a']);
    expect(upstreamCalls[2].plugins).toEqual(['a']);
  });

  it('injects the auto import into the entry file only, without shifting lines', () => {
    const { transformer } = load();
    transformer.transform({ filename: 'index.js', src: "import App from './App';\nregister(App);", options: opts(true) });
    transformer.transform({ filename: 'src/App.tsx', src: 'x', options: opts(true) });
    transformer.transform({ filename: 'index.js', src: 'x', options: opts(false) });
    expect(upstreamCalls[0].src).toBe("import '@v6y/react-native/auto'; import App from './App';\nregister(App);");
    expect(upstreamCalls[1].src).toBe('x');
    expect(upstreamCalls[2].src).toBe('x');
  });

  it('keeps the upstream exports and extends the cache key', () => {
    const { transformer } = load();
    expect(transformer.extra).toBe(1);
    expect(transformer.getCacheKey()).toMatch(/^up\|v6y\|/);
  });
});

describe('dev server middleware', () => {
  it('receives reports on /v6y/report and passes everything else through', async () => {
    const { config } = load();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    const fallthrough = vi.fn((_req: any, res: any) => res.end('metro'));
    const server = http.createServer(config.server.enhanceMiddleware(fallthrough, {}));
    await new Promise<void>((r) => server.listen(0, r));
    const { port } = server.address() as AddressInfo;
    const snapshot = {
      screen: 'Home',
      platform: 'ios',
      root: { id: '0', type: 'Root', children: [{ id: '1', type: 'RCTView', interactive: true, children: [] }] },
    };
    const res = await fetch(`http://127.0.0.1:${port}/v6y/report`, { method: 'POST', body: JSON.stringify(snapshot) });
    // strict preset from v6y.config.js: missing-label, missing-role (error), missing-heading
    expect(await res.json()).toEqual({ issues: 3 });
    expect(fs.existsSync(path.join(project, '.v6y/snapshots/Home.ios.json'))).toBe(true);
    expect(await (await fetch(`http://127.0.0.1:${port}/index.bundle`)).text()).toBe('metro');
    server.close();
  });
});
