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
  groupIssues,
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

describe('field-test fixes', () => {
  const src = (file: string, line = 1) => ({ file, line, column: 1 });
  const btn = (label: string, source: ReturnType<typeof src>, owner?: ReturnType<typeof src>) =>
    node({ interactive: true, role: 'button', label, frame: frame(48, 48), source, ownerSources: owner ? [owner] : undefined });
  const heading = () => node({ type: 'RCTText', role: 'header', text: 'Title' });

  it('duplicate-label ignores list rows from one call site, but not different call sites', () => {
    const rows = [1, 2, 3].map(() => btn('Like', src('src/Post.tsx', 10), src('src/Feed.tsx', 5)));
    expect(ids(screen(node({ children: [heading(), ...rows] })), { extends: 'strict' })).toEqual([]);
    const two = screen(node({ children: [heading(), btn('Edit', src('src/Order.tsx', 10)), btn('Edit', src('src/Order.tsx', 20))] }));
    expect(ids(two, { extends: 'strict' })).toEqual(['duplicate-label', 'duplicate-label']);
    const withRows = { extends: 'strict' as const, rules: { 'duplicate-label': ['warning', { includeRepeated: true }] as ['warning', { includeRepeated: boolean }] } };
    expect(ids(screen(node({ children: [heading(), ...rows] })), withRows)).toHaveLength(3);
  });

  it('duplicate-label still catches different uses of one shared component', () => {
    // Three segmented controls on one screen, each rendered through the same component line.
    const seg = (screenLine: number) =>
      btn('Dark', src('src/components/Button.tsx', 577), src('src/components/SegmentedControl.tsx', 199));
    const nodes = [221, 250].map((line) => {
      const n = seg(line);
      n.ownerSources = [...(n.ownerSources ?? []), src('src/screens/Appearance.tsx', line)];
      return n;
    });
    expect(ids(screen(node({ children: [heading(), ...nodes] })), { extends: 'strict' })).toEqual(['duplicate-label', 'duplicate-label']);
  });

  it('reports issues inside a shared component at the call site (designSystem config)', () => {
    const s = screen(node({ children: [node({ interactive: true, frame: frame(48, 48), label: 'Go', source: src('src/components/Button.tsx', 9), ownerSources: [src('src/screens/Home.tsx', 42)] })] }));
    const [issue] = audit(s, { rules: { 'missing-role': 'error' }, designSystem: ['src/components/**'] });
    expect(issue?.location).toEqual(src('src/screens/Home.tsx', 42));
    expect(issue?.via).toEqual(src('src/components/Button.tsx', 9));
  });

  it('moves to call sites automatically when one component line has 3+ call sites', () => {
    const at = (line: number) => node({ interactive: true, frame: frame(48, 48), label: 'Go', source: src('src/Button.tsx', 9), ownerSources: [src('src/A.tsx', line)] });
    const two = audit(screen(node({ children: [at(1), at(2)] })));
    expect(two.every((i) => i.location?.file === 'src/Button.tsx' && !i.via)).toBe(true);
    // One use is fine, so the defect isn't inside Button: report at each call site.
    const fine = node({ interactive: true, role: 'button', frame: frame(48, 48), label: 'Ok', source: src('src/Button.tsx', 9), ownerSources: [src('src/A.tsx', 4)] });
    const three = audit(screen(node({ children: [at(1), at(2), at(3), fine] })));
    expect(three.map((i) => i.location?.line)).toEqual([1, 2, 3]);
    expect(three.every((i) => i.via?.file === 'src/Button.tsx' && i.scope === 'call-site')).toBe(true);
  });

  it('only lists "used at" for uses in another file', () => {
    const inScreen = node({ interactive: true, role: 'button', frame: frame(48, 48), source: src('src/Home.tsx', 20), ownerSources: [src('src/Home.tsx', 5)] });
    const elsewhere = node({ interactive: true, role: 'button', frame: frame(48, 48), source: src('src/IconButton.tsx', 9), ownerSources: [src('src/Home.tsx', 30)] });
    const groups = groupIssues(audit(screen(node({ children: [inScreen, elsewhere] }))));
    expect(groups.map((g) => [g.issue.source?.file, g.usedAt.map((u) => u.file)])).toEqual([
      ['src/Home.tsx', []],
      ['src/IconButton.tsx', ['src/Home.tsx']],
    ]);
  });

  it('reports a defect every use shares once, at the component, with its call sites', () => {
    const at = (line: number) => node({ interactive: true, frame: frame(48, 48), label: 'Go', source: src('src/Menu.tsx', 9), ownerSources: [src('src/A.tsx', line)] });
    const issues = audit(screen(node({ children: [at(1), at(2), at(3)] })));
    expect(issues.every((i) => i.scope === 'component' && i.location?.file === 'src/Menu.tsx' && !i.via)).toBe(true);
    expect(issues[0]?.callSites?.map((s) => s.line)).toEqual([1, 2, 3]);
  });

  it('never treats duplicate labels as a component defect', () => {
    const edit = (line: number) => node({ interactive: true, role: 'button', label: 'Edit', frame: frame(48, 48), source: src('src/Button.tsx', 9), ownerSources: [src('src/Order.tsx', line)] });
    const issues = audit(screen(node({ children: [node({ type: 'RCTText', role: 'header', text: 'T' }), edit(1), edit(2)] })), { extends: 'strict' });
    expect(issues.map((i) => [i.ruleId, i.scope])).toEqual([['duplicate-label', 'call-site'], ['duplicate-label', 'call-site']]);
  });

  it('blames the wrapper when state a caller passed never reaches the native view', () => {
    const tab = node({ interactive: true, role: 'tab', label: 'Dark', frame: frame(48, 48), state: { disabled: false }, droppedState: ['selected'], source: src('src/components/Button.tsx', 577), ownerSources: [src('src/screens/Appearance.tsx', 221)] });
    const [issue] = audit(screen(tab));
    expect(issue?.ruleId).toBe('state-not-exposed');
    expect(issue?.scope).toBe('component');
    expect(issue?.location?.file).toBe('src/components/Button.tsx');
    expect(issue?.message).toMatch(/passes accessibilityState.selected, but a wrapper component drops it/);
  });

  it('does not double-report an image inside a labelled pressable', () => {
    const s = screen(node({ interactive: true, role: 'button', frame: frame(48, 48), children: [node({ type: 'RCTImageView', accessible: true })] }));
    expect(ids(s)).toEqual(['missing-label']);
  });

  it('accepts selected on radios', () => {
    const r = (state: A11yNode['state']) => screen(node({ interactive: true, role: 'radio', label: 'Dark', state, frame: frame(48, 48) }));
    expect(ids(r({ selected: true }))).toEqual([]);
    expect(ids(r(undefined))).toEqual(['state-not-exposed']);
  });

  it('points missing-heading at the first title-like text, not the largest or a list footer', () => {
    const t = (text: string, fontSize: number, fontWeight?: string) => node({ type: 'RCTText', text, style: { fontSize, fontWeight } });
    const rows = Array.from({ length: 8 }, (_, i) => t(`Post ${i}`, 15));
    const s = screen(
      node({
        children: [
          t('Settings', 16.9, '600'), // header title (Bluesky's size)
          node({ type: 'RCTScrollView', children: [t('Alice', 22, '700'), ...rows, t("You've reached the end", 18, '700')] }),
        ],
      }),
    );
    expect(audit(s, { extends: 'strict' })[0]?.message).toMatch(/^"Settings" looks like/);
    const noHeader = screen(node({ children: [node({ type: 'RCTScrollView', children: [...rows, t("You've reached the end", 18, '700')] })] }));
    expect(audit(noHeader, { extends: 'strict' })[0]?.message).toMatch(/^This screen has no heading/);
  });

  it('points missing-heading at a 17pt bold nav-style title', () => {
    const s = screen(node({ children: [node({ type: 'RCTText', text: 'Settings', style: { fontSize: 17, fontWeight: '600' } }), node({ type: 'RCTText', text: 'body', style: { fontSize: 15 } })] }));
    expect(audit(s, { extends: 'strict' })[0]?.message).toMatch(/^"Settings" looks like/);
  });

  it('never rounds a failing contrast ratio up to the threshold', () => {
    const s = screen(node({ style: { backgroundColor: '#ffffff' }, children: [node({ type: 'RCTText', text: 'Delete', style: { color: '#e91646' } })] }));
    const [issue] = audit(s);
    expect(issue?.message).toMatch(/4\.49:1/);
  });

  it('honours node kinds from custom host types', () => {
    const s = screen(node({ style: { backgroundColor: '#fff' }, children: [node({ type: 'RNSelectableText', kind: 'text', text: 'Faint', style: { color: '#bbbbbb' } })] }));
    expect(ids(s)).toEqual(['text-contrast']);
  });
});

