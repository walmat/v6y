import { describe, expect, it, vi, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn, execFileSync } from 'child_process';
import { callTool, expandGlob, handleMessage } from '../src/mcp';

afterEach(() => vi.restoreAllMocks());

const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe', env: gitEnv });

/** A git project with one committed screen, then edited, and a fresh snapshot of it in .v6y/snapshots. */
function project() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'v6y-mcp-')));
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src/Home.tsx'), 'export {}\n');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '.');
  git(dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init');
  fs.appendFileSync(path.join(dir, 'src/Home.tsx'), '// edit\n');
  fs.mkdirSync(path.join(dir, '.v6y/snapshots'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, '.v6y/snapshots/Home.ios.json'),
    JSON.stringify({
      screen: 'Home', platform: 'ios', capturedAt: new Date(Date.now() + 1000).toISOString(),
      root: { id: '0', type: 'Root', children: [{ id: '1', type: 'RCTView', interactive: true, role: 'button', frame: { x: 0, y: 0, width: 48, height: 48 }, source: { file: 'src/Home.tsx', line: 3, column: 5 }, children: [] }] },
    }),
  );
  return dir;
}

describe('MCP tools', () => {
  it('check_accessibility reports issues in changed files with structured output', async () => {
    const res = await callTool('check_accessibility', {}, project());
    expect(res.content[0]!.text).toMatch(/^FAIL/);
    expect(res.content[0]!.text).toContain('src/Home.tsx:3:5');
    expect(res.content[0]!.text).toContain('docs/rules/missing-label.md');
    expect((res.structuredContent as any).issues[0]).toMatchObject({ rule: 'missing-label', severity: 'error' });
  });

  it('accepts an explicit projectDir and CLAUDE_PROJECT_DIR', async () => {
    const dir = project();
    const res = await callTool('check_accessibility', { projectDir: dir }, os.tmpdir());
    expect(res.content[0]!.text).toContain('src/Home.tsx:3:5');
  });

  it('explains what to do when there are no snapshots', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v6y-mcp-empty-'));
    const res = await callTool('check_accessibility', {}, dir);
    expect(res.content[0]!.text).toMatch(/V6Y_SNAPSHOTS=\.v6y\/snapshots/);
  });

  it('explain_rule and list_rules', async () => {
    expect((await callTool('explain_rule', { rule: 'missing-label' })).content[0]!.text).toMatch(/^<!--[\s\S]*# missing-label/);
    expect((await callTool('explain_rule', { rule: 'nope' })).isError).toBe(true);
    expect((await callTool('list_rules')).content[0]!.text).toContain('nested-interactive');
  });

  it('expands globs', () => {
    const dir = project();
    expect(expandGlob('.v6y/snapshots/*.json', dir).map((f) => path.basename(f))).toEqual(['Home.ios.json']);
    expect(expandGlob('**/*.ios.json', dir).length).toBe(1);
    expect(expandGlob('missing/*.json', dir)).toEqual([]);
  });
});

describe('MCP protocol', () => {
  it('handles initialize, tools/list, unknown methods and notifications', async () => {
    const init: any = await handleMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
    expect(init.result).toMatchObject({ protocolVersion: '2025-06-18', serverInfo: { name: 'v6y' }, capabilities: { tools: {} } });
    expect(init.result.instructions).toMatch(/check_accessibility/);
    const list: any = await handleMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    expect(list.result.tools.map((t: any) => t.name)).toEqual(['check_accessibility', 'explain_rule', 'list_rules']);
    expect(await handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' })).toBeUndefined();
    expect(((await handleMessage({ jsonrpc: '2.0', id: 3, method: 'nope' })) as any).error.code).toBe(-32601);
  });

  it('speaks JSON-RPC over stdio end to end (built CLI)', async () => {
    const bin = path.resolve(import.meta.dirname, '../dist/bin.js');
    const cwd = project();
    const child = spawn(process.execPath, [bin, 'mcp'], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
    const responses: any[] = [];
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        responses.push(JSON.parse(buf.slice(0, i)));
        buf = buf.slice(i + 1);
      }
    });
    const send = (m: object) => child.stdin.write(JSON.stringify(m) + '\n');
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } } });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'check_accessibility', arguments: {} } });
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error(`timeout; got ${JSON.stringify(responses)}`)), 10000);
      const iv = setInterval(() => {
        if (responses.length >= 2) {
          clearTimeout(t);
          clearInterval(iv);
          resolve();
        }
      }, 20);
    });
    child.kill();
    expect(responses[0].result.serverInfo.name).toBe('v6y');
    expect(responses[1].id).toBe(2);
    expect(responses[1].result.content[0].text).toContain('src/Home.tsx:3:5');
  });
});
