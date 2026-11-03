import { describe, expect, it } from 'vitest';
import * as React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { auditRendered, matchers } from '../src/jest';

/* eslint-disable @typescript-eslint/no-explicit-any */
expect.extend(matchers as any);
const h = React.createElement;
const config = { extends: 'recommended' as const };

// Stand-ins for React Native components, as in collect.test.tsx.
const Pressable = ({ children, onPress, ...rest }: any) =>
  h('RCTView', { ...rest, accessible: true, onClick: onPress, onResponderRelease: onPress }, children);
const IconButton = (props: any) => h(Pressable, { onPress: () => {}, style: { width: 48, height: 48 }, ...props }, h('RCTImageView'));

describe('toBeAccessible', () => {
  it('fails with a readable report for an inaccessible element', async () => {
    let message = '';
    try {
      await (expect(h(IconButton)) as any).toBeAccessible({ config, platform: 'ios' });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/v6y found 1 accessibility issue/);
    expect(message).toMatch(/missing-label/);
  });

  it('passes for an accessible element, and supports .not', async () => {
    const ok = h(IconButton, { accessibilityRole: 'button', accessibilityLabel: 'Search' });
    await (expect(ok) as any).toBeAccessible({ config, platform: 'ios' });
    await (expect(h(IconButton)) as any).not.toBeAccessible({ config, platform: 'ios' });
  });

  it('accepts a react-test-renderer instance', async () => {
    let renderer: any;
    await act(async () => {
      renderer = TestRenderer.create(h(IconButton, { accessibilityRole: 'button', accessibilityLabel: 'Search' }));
    });
    await (expect(renderer) as any).toBeAccessible({ config, platform: 'ios' });
  });

  it('honours failOn and config overrides', async () => {
    // Role missing only: a warning under "recommended".
    const el = h(IconButton, { accessibilityLabel: 'Search' });
    await (expect(el) as any).toBeAccessible({ config, platform: 'ios' });
    await (expect(el) as any).not.toBeAccessible({ config, platform: 'ios', failOn: 'warning' });
    await (expect(el) as any).toBeAccessible({ config: { rules: { 'missing-role': 'off' } }, platform: 'ios', failOn: 'warning' });
  });

  it('measures touch targets from explicit sizes', async () => {
    const tiny = h(IconButton, { accessibilityRole: 'button', accessibilityLabel: 'Close', style: { width: 20, height: 20 } });
    const result = await auditRendered(tiny, { config, platform: 'ios' });
    expect(result.issues.map((i) => i.ruleId)).toEqual(['touch-target-size']);
  });

  it('explains what it accepts', async () => {
    await expect(auditRendered({ nope: true }, { config })).rejects.toThrow(/expects a React element/);
  });
});
