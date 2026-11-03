import { afterAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fix, renderFix } from '../src/fix';

// Under the repo so the project's @babel/core resolves, as it would in an app.
const repoRoot = path.resolve(import.meta.dirname, '../../..');
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })));

const SCREEN = `import { Pressable, Text } from 'react-native';

export function Screen({ go }) {
  return (
    <Pressable onPress={go} style={{ width: 20, height: 20 }}>
      <Text allowFontScaling={false}>Hi</Text>
    </Pressable>
  );
}
`;

function project(opts: { editedAfter?: boolean } = {}) {
  const dir = fs.mkdtempSync(path.join(repoRoot, '.tmp-fix-'));
  dirs.push(dir);
  fs.writeFileSync(path.join(dir, 'package.json'), '{}');
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src/Screen.tsx'), SCREEN);
  const capturedAt = new Date(Date.now() + (opts.editedAfter ? -60_000 : 60_000)).toISOString();
  const snap = path.join(dir, 'snap.json');
  fs.writeFileSync(
    snap,
    JSON.stringify({
      screen: 'Screen', platform: 'ios', capturedAt,
      root: { id: '0', type: 'Root', children: [
        { id: '1', type: 'RCTView', interactive: true, frame: { x: 0, y: 0, width: 20, height: 20 }, source: { file: 'src/Screen.tsx', line: 5, column: 5 }, children: [
          { id: '2', type: 'RCTText', text: 'Hi', allowFontScaling: false, source: { file: 'src/Screen.tsx', line: 6, column: 7 }, children: [] },
        ] },
      ] },
    }),
  );
  return { dir, snap, file: path.join(dir, 'src/Screen.tsx') };
}

describe('v6y fix', () => {
  it('writes mechanical fixes into source, keeping formatting', async () => {
    const { dir, snap, file } = project();
    const r = await fix([snap], { cwd: dir });
    expect(fs.readFileSync(file, 'utf8')).toBe(`import { Pressable, Text } from 'react-native';

export function Screen({ go }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={14} onPress={go} style={{ width: 20, height: 20 }}>
      <Text>Hi</Text>
    </Pressable>
  );
}
`);
    expect(r.applied.map((a) => a.ruleId).sort()).toEqual(['font-scaling-disabled', 'missing-role', 'touch-target-size']);
    // "Hi" names the button, so no label issue; nothing left for a person.
    expect(r.manual).toEqual([]);
    expect(renderFix(r)).toMatch(/Fixed 3 issues/);
  });

  it('lists what needs judgment, and is idempotent', async () => {
    const { dir, snap, file } = project();
    fs.writeFileSync(file, SCREEN.replace('<Text allowFontScaling={false}>Hi</Text>', '<Image source={icon} />'));
    const s = JSON.parse(fs.readFileSync(snap, 'utf8'));
    s.root.children[0].children = [];
    fs.writeFileSync(snap, JSON.stringify(s));
    const first = await fix([snap], { cwd: dir });
    expect(first.manual.map((m) => m.issue.ruleId)).toEqual(['missing-label']);
    expect(renderFix(first)).toMatch(/1 need a person or your coding agent:\n  • src\/Screen\.tsx:5  needs a label/);
    // Running again with the same (now outdated) snapshot doesn't double-apply.
    s.capturedAt = new Date(Date.now() + 120_000).toISOString();
    fs.writeFileSync(snap, JSON.stringify(s));
    const second = await fix([snap], { cwd: dir });
    expect(second.applied).toEqual([]);
    expect(second.skipped.map((k) => k.why).sort()).toEqual(['accessibilityRole is already set', 'hitSlop is already set']);
  });

  it('dry run writes nothing', async () => {
    const { dir, snap, file } = project();
    const r = await fix([snap], { cwd: dir, dryRun: true });
    expect(r.applied).toHaveLength(3);
    expect(fs.readFileSync(file, 'utf8')).toBe(SCREEN);
    expect(renderFix(r, true)).toMatch(/Would fix 3 issues/);
  });

  it('refuses to edit a file changed since its snapshot', async () => {
    const { dir, snap, file } = project({ editedAfter: true });
    const r = await fix([snap], { cwd: dir });
    expect(r.applied).toEqual([]);
    expect(r.skipped[0]?.why).toMatch(/changed since the snapshot/);
    expect(fs.readFileSync(file, 'utf8')).toBe(SCREEN);
  });
});
