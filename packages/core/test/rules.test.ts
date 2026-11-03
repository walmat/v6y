import { describe, expect, it } from 'vitest';
import {
  A11yNode,
  ScreenSnapshot,
  audit,
  contrastRatio,
  meaninglessLabelReason,
  parseColor,
} from '@v6y/core';

let nextId = 0;
function node(partial: Partial<A11yNode> & { type?: string } = {}): A11yNode {
  return { id: String(nextId++), type: 'RCTView', children: [], ...partial };
}
function text(t: string, extra: Partial<A11yNode> = {}): A11yNode {
  return node({ type: 'RCTText', text: t, ...extra });
}
function screen(root: A11yNode, platform: ScreenSnapshot['platform'] = 'ios'): ScreenSnapshot {
  return { screen: 'Test', platform, root };
}
const ids = (s: ScreenSnapshot) => audit(s).map((i) => i.ruleId);
const frame = (width: number, height: number) => ({ x: 0, y: 0, width, height });

describe('color', () => {
  it('parses common formats', () => {
    expect(parseColor('#fff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor('#00000080')?.a).toBeCloseTo(0.5, 2);
    expect(parseColor('rgba(10, 20, 30, 0.5)')).toEqual({ r: 10, g: 20, b: 30, a: 0.5 });
    expect(parseColor('white')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor(0xff0000ff)).toEqual({ r: 0, g: 0, b: 255, a: 1 });
    expect(parseColor('var(--x)')).toBeUndefined();
  });

  it('computes WCAG contrast', () => {
    expect(contrastRatio(parseColor('#000')!, parseColor('#fff')!)).toBeCloseTo(21, 1);
    expect(contrastRatio(parseColor('#777')!, parseColor('#fff')!)).toBeCloseTo(4.48, 2);
  });
});

describe('missing-label', () => {
  it('flags an icon-only pressable', () => {
    const s = screen(
      node({ children: [node({ interactive: true, role: 'button', frame: frame(48, 48), children: [node({ type: 'RCTImageView' })] })] }),
    );
    expect(ids(s)).toEqual(['missing-label']);
  });

  it('does not count icon-font glyphs as a name', () => {
    const icon = String.fromCharCode(0xf4a5); // e.g. an Ionicons glyph
    const s = screen(node({ interactive: true, role: 'button', frame: frame(48, 48), children: [text(icon)] }));
    expect(ids(s)).toEqual(['missing-label']);
  });

  it('accepts text content as the name', () => {
    const s = screen(node({ interactive: true, role: 'button', frame: frame(100, 48), children: [text('Buy now')] }));
    expect(ids(s)).toEqual([]);
  });

  it('ignores names that only come from hidden children', () => {
    const s = screen(
      node({ interactive: true, role: 'button', frame: frame(48, 48), children: [node({ hidden: true, children: [text('x')] })] }),
    );
    expect(ids(s)).toContain('missing-label');
  });

  it('does not flag native text inputs or switches', () => {
    const s = screen(node({ children: [node({ type: 'RCTSinglelineTextInputView', interactive: true, label: 'Email', frame: frame(200, 48) })] }));
    expect(ids(s)).toEqual([]);
  });
});

describe('meaningless-label', () => {
  it.each([
    ['button', 'button'],
    ['icon_23', undefined],
    ['closeIcon', undefined],
    ['close.png', undefined],
    ['x', undefined],
  ])('flags %s', (label, role) => {
    expect(meaninglessLabelReason(label, role)).toBeDefined();
  });

  it.each(['Close', 'Add to cart', 'Page 2', '2'])('accepts %s', (label) => {
    expect(meaninglessLabelReason(label)).toBeUndefined();
  });
});

describe('missing-role', () => {
  it('flags pressables without a role', () => {
    const s = screen(node({ interactive: true, frame: frame(100, 48), children: [text('Continue')] }));
    expect(ids(s)).toEqual(['missing-role']);
  });
});

describe('touch-target-size', () => {
  const pressable = (w: number, h: number, extra: Partial<A11yNode> = {}) =>
    node({ interactive: true, role: 'button', label: 'Close', frame: frame(w, h), ...extra });

  it('errors below 24×24', () => {
    const [issue] = audit(screen(pressable(20, 20)));
    expect(issue?.ruleId).toBe('touch-target-size');
    expect(issue?.severity).toBe('error');
  });

  it('warns below the platform minimum', () => {
    expect(audit(screen(pressable(40, 40), 'ios'))[0]?.severity).toBe('warning');
    expect(audit(screen(pressable(44, 44), 'ios'))).toEqual([]);
    expect(audit(screen(pressable(44, 44), 'android'))[0]?.severity).toBe('warning');
  });

  it('counts hitSlop', () => {
    expect(audit(screen(pressable(24, 24, { hitSlop: { top: 10, bottom: 10, left: 10, right: 10 } })))).toEqual([]);
  });

  it('skips elements with no layout', () => {
    expect(audit(screen(pressable(0, 0)))).toEqual([]);
  });
});

describe('text-contrast', () => {
  it('flags light gray on white and suggests a passing color', () => {
    const s = screen(node({ style: { backgroundColor: '#ffffff' }, children: [text('Terms apply', { style: { color: '#aaaaaa' } })] }));
    const [issue] = audit(s);
    expect(issue?.ruleId).toBe('text-contrast');
    expect(issue?.message).toMatch(/2\.3\d:1/);
    expect(issue?.fix).toMatch(/#[0-9a-f]{6}/);
    const suggested = parseColor(issue!.fix!.match(/#[0-9a-f]{6}/)![0])!;
    expect(contrastRatio(suggested, parseColor('#fff')!)).toBeGreaterThanOrEqual(4.5);
  });

  it('uses the 3:1 threshold for large text', () => {
    const s = screen(node({ style: { backgroundColor: '#fff' }, children: [text('Big', { style: { color: '#888', fontSize: 28 } })] }));
    expect(audit(s)).toEqual([]);
  });

  it('inherits color from parent Text and composites translucent backgrounds', () => {
    const s = screen(
      node({
        style: { backgroundColor: '#000' },
        children: [
          node({
            style: { backgroundColor: 'rgba(255,255,255,0.9)' },
            children: [text('', { style: { color: '#bbb' }, children: [node({ type: 'RCTVirtualText', text: 'nested' })] })],
          }),
        ],
      }),
    );
    expect(ids(s)).toEqual(['text-contrast']);
  });

  it('skips text when colors are unknown', () => {
    expect(audit(screen(node({ children: [text('hello', { style: { color: '#aaa' } })] })))).toEqual([]);
  });

  it('skips disabled controls', () => {
    const s = screen(
      node({
        style: { backgroundColor: '#fff' },
        children: [node({ state: { disabled: true }, children: [text('Submit', { style: { color: '#ccc' } })] })],
      }),
    );
    expect(audit(s)).toEqual([]);
  });
});

describe('font-scaling-disabled', () => {
  it('errors on allowFontScaling={false}', () => {
    expect(ids(screen(text('Hi', { allowFontScaling: false })))).toEqual(['font-scaling-disabled']);
  });
  it('errors on maxFontSizeMultiplier below 2', () => {
    expect(audit(screen(text('Hi', { maxFontSizeMultiplier: 1.3 })))[0]?.severity).toBe('error');
    expect(audit(screen(text('Hi', { maxFontSizeMultiplier: 2 })))).toEqual([]);
  });
});

describe('engine', () => {
  it('can disable and re-grade rules', () => {
    const s = screen(node({ interactive: true, frame: frame(20, 20) }));
    const issues = audit(s, { rules: { 'missing-label': 'off', 'touch-target-size': 'warning' } });
    expect(issues.map((i) => [i.ruleId, i.severity])).toEqual([
      ['missing-role', 'warning'],
      ['touch-target-size', 'warning'],
    ]);
  });

  it('carries source locations onto issues', () => {
    const src = { file: 'src/App.tsx', line: 12, column: 4 };
    const [issue] = audit(screen(node({ interactive: true, role: 'button', frame: frame(48, 48), source: src })));
    expect(issue?.source).toEqual(src);
  });
});
