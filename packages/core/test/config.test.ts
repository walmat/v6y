import { describe, expect, it } from 'vitest';
import {
  A11yNode,
  ConfigError,
  ScreenSnapshot,
  allRules,
  audit,
  auditScreen,
  defineConfig,
  globToRegExp,
  presets,
  resolveConfig,
  shouldFail,
  WCAG,
} from '@v6y/core';

let nextId = 0;
const node = (p: Partial<A11yNode> = {}): A11yNode => ({ id: String(nextId++), type: 'RCTView', children: [], ...p });
const frame = (w: number, h: number) => ({ x: 0, y: 0, width: w, height: h });
const screen = (root: A11yNode, name = 'Home', platform: ScreenSnapshot['platform'] = 'ios'): ScreenSnapshot => ({ screen: name, platform, root });
const ids = (s: ScreenSnapshot, cfg?: Parameters<typeof audit>[1]) => audit(s, cfg).map((i) => i.ruleId).sort();

describe('rule catalog', () => {
  it('every rule has docs, valid WCAG refs and a level in every preset', () => {
    for (const r of allRules) {
      expect(r.meta.docs.length, r.meta.id).toBeGreaterThan(40);
      for (const c of r.meta.wcag) expect(WCAG[c], `${r.meta.id} → ${c}`).toBeDefined();
      for (const [name, p] of Object.entries(presets)) expect(p[r.meta.id as keyof typeof p], `${name}: ${r.meta.id}`).toBeDefined();
    }
  });
});

describe('new rules', () => {
  it('image-missing-label: only images exposed to screen readers', () => {
    expect(ids(screen(node({ children: [node({ type: 'RCTImageView' })] })))).toEqual([]);
    expect(ids(screen(node({ children: [node({ type: 'RCTImageView', accessible: true })] })))).toEqual(['image-missing-label']);
    expect(ids(screen(node({ children: [node({ type: 'RCTImageView', role: 'image', label: 'Sam' })] })))).toEqual([]);
  });

  it('input-missing-label: placeholder-only inputs', () => {
    const input = (p: Partial<A11yNode>) => screen(node({ children: [node({ type: 'RCTSinglelineTextInputView', ...p })] }));
    const [issue] = audit(input({ placeholder: 'Email' }));
    expect(issue?.message).toMatch(/only by its placeholder/);
    expect(issue?.severity).toBe('warning');
    expect(audit(input({ labelledBy: 'emailLabel' }))).toEqual([]);
    expect(audit(input({ placeholder: 'Email' }), { rules: { 'input-missing-label': ['error', { allowPlaceholder: true }] } })).toEqual([]);
  });

  it('nested-interactive: pressable inside an accessible pressable', () => {
    const inner = node({ interactive: true, role: 'button', label: 'Favorite', frame: frame(48, 48) });
    const card = (accessible?: boolean) =>
      screen(node({ interactive: true, role: 'button', label: 'Open item', accessible, frame: frame(300, 100), children: [inner] }));
    expect(ids(card(true))).toEqual(['nested-interactive']);
    expect(ids(card(false))).toEqual([]);
  });

  it('state-not-exposed: stateful roles need state', () => {
    const toggle = (state?: A11yNode['state']) =>
      screen(node({ interactive: true, role: 'checkbox', label: 'Remember me', state, frame: frame(48, 48) }));
    expect(ids(toggle())).toEqual(['state-not-exposed']);
    expect(ids(toggle({ checked: false }))).toEqual([]);
  });

  it('duplicate-label and missing-heading are strict-only', () => {
    const btn = () => node({ interactive: true, role: 'button', label: 'Delete', frame: frame(48, 48) });
    const s = screen(node({ children: [btn(), btn()] }));
    expect(ids(s)).toEqual([]);
    expect(ids(s, { extends: 'strict' })).toEqual(['duplicate-label', 'duplicate-label', 'missing-heading']);
    const withHeading = screen(node({ children: [node({ type: 'RCTText', role: 'header', text: 'Cart' }), btn()] }));
    expect(ids(withHeading, { extends: 'strict' })).toEqual([]);
  });
});

describe('config', () => {
  const tiny = () => screen(node({ interactive: true, role: 'button', label: 'Close', frame: frame(30, 30) }));

  it('defaults to recommended', () => {
    expect([...resolveConfig().rules.keys()].sort()).toEqual(
      Object.entries(presets.recommended).filter(([, v]) => v !== 'off').map(([k]) => k).sort(),
    );
  });

  it('applies rule options and levels', () => {
    expect(audit(tiny())[0]?.severity).toBe('warning'); // below 44 (advisory)
    expect(audit(tiny(), { rules: { 'touch-target-size': ['error', { minimum: 32 }] } })[0]?.severity).toBe('error');
    expect(audit(tiny(), { rules: { 'touch-target-size': ['error', { platformGuidelines: false }] } })).toEqual([]);
  });

  it('advisory findings stay warnings even when the rule is an error', () => {
    expect(audit(tiny(), { rules: { 'touch-target-size': 'error' } })[0]?.severity).toBe('warning');
  });

  it('presets layer: wcag21-aa drops touch targets, wcag22-aa only enforces 24×24', () => {
    expect(ids(tiny(), { extends: 'wcag21-aa' })).toEqual(['missing-heading']);
    const s = screen(node({ children: [node({ type: 'RCTText', role: 'header', text: 'Hi' }), node({ interactive: true, role: 'button', label: 'Close', frame: frame(20, 20) })] }));
    expect(audit(s, { extends: 'wcag22-aa' }).map((i) => [i.ruleId, i.severity])).toEqual([['touch-target-size', 'error']]);
  });

  it('text-contrast AAA level', () => {
    const s = screen(node({ style: { backgroundColor: '#fff' }, children: [node({ type: 'RCTText', text: 'Hi', style: { color: '#666' } })] }));
    expect(audit(s)).toEqual([]); // 5.74:1 passes AA
    const [aaa] = audit(s, { rules: { 'text-contrast': ['error', { level: 'AAA' }] } });
    expect(aaa?.ruleId).toBe('text-contrast');
    expect(aaa?.wcag).toEqual(['1.4.6']);
  });

  it('rejects unknown rules, levels, options and presets with helpful errors', () => {
    expect(() => resolveConfig({ rules: { 'missing-lable': 'error' } as never })).toThrow(/Unknown rule "missing-lable".*missing-label/);
    expect(() => resolveConfig({ rules: { 'missing-label': 'warn' as never } })).toThrow(ConfigError);
    expect(() => resolveConfig({ rules: { 'text-contrast': ['error', { lvl: 'AAA' } as never] } })).toThrow(/Options: level/);
    expect(() => resolveConfig({ rules: { 'missing-label': ['error', { x: 1 } as never] } })).toThrow(/takes no options/);
    expect(() => resolveConfig({ extends: 'eaa' as never })).toThrow(/Unknown preset/);
  });

  it('suppresses by source glob and by inline comment, keeping them for reports', () => {
    const src = (file: string) => ({ file, line: 1, column: 1 });
    const s = screen(
      node({
        children: [
          node({ interactive: true, role: 'button', frame: frame(48, 48), source: src('src/legacy/Old.tsx') }),
          node({ interactive: true, role: 'button', frame: frame(48, 48), source: src('src/New.tsx'), ignore: [{ rules: ['missing-label'], reason: 'labelled natively' }] }),
          node({ interactive: true, role: 'button', frame: frame(48, 48), source: src('src/Other.tsx') }),
        ],
      }),
    );
    const r = auditScreen(s, { ignore: ['src/legacy/**'] });
    expect(r.issues.map((i) => i.source?.file)).toEqual(['src/Other.tsx']);
    expect(r.suppressed.map((i) => i.suppressed)).toEqual([{ by: 'config' }, { by: 'inline', reason: 'labelled natively' }]);
  });

  it('skips ignored screens', () => {
    expect(auditScreen(tiny(), { screens: { ignore: ['Dev*'] } }).skipped).toBeUndefined();
    const s = { ...tiny(), screen: 'DevMenu' };
    expect(auditScreen(s, { screens: { ignore: ['Dev*'] } })).toEqual({ issues: [], suppressed: [], skipped: true });
  });

  it('failOn', () => {
    const warnings = audit(tiny());
    expect(shouldFail(warnings)).toBe(false);
    expect(shouldFail(warnings, { failOn: 'warning' })).toBe(true);
    expect(shouldFail(audit(screen(node({ interactive: true, frame: frame(48, 48) }))), { failOn: 'never' })).toBe(false);
  });

  it('defineConfig is an identity helper', () => {
    const c = defineConfig({ extends: ['strict'], rules: { 'missing-role': 'off' } });
    expect(c.rules?.['missing-role']).toBe('off');
  });
});

describe('globToRegExp', () => {
  it.each([
    ['src/legacy/**', 'src/legacy/a/b.tsx', true],
    ['src/legacy/**', 'src/legacyx.tsx', false],
    ['**/*.stories.tsx', 'src/Button.stories.tsx', true],
    ['**/*.stories.tsx', 'Button.stories.tsx', true],
    ['Dev*', 'DevMenu', true],
    ['Dev*', 'Home', false],
    ['src/?.ts', 'src/a.ts', true],
  ])('%s matches %s → %s', (glob, path, expected) => {
    expect(globToRegExp(glob).test(path)).toBe(expected);
  });
});
