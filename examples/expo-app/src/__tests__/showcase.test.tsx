/**
 * The showcase's contract, checked with the real v6y collector and rules:
 * - every BEFORE screen demonstrates the issues annotated in its source,
 * - together they cover every v6y rule,
 * - every AFTER screen is clean (only deliberate suppressions remain).
 *
 * It also records the snapshots `npm run a11y:check` reads. In a real project
 * the running app records those as you navigate (see .v6y/snapshots/).
 *
 * Jest renders React Native without a device: host components have their Jest
 * names ('View', 'Text') and there is no layout engine, so frames come from
 * explicit width/height styles. Everything else is the real pipeline.
 */
import fs from 'fs';
import path from 'path';
import type { ComponentType, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { allRules, type Issue, type SnapshotReport } from '@v6y/core';
import { V6yProvider, capture, configure } from '@v6y/react-native';

import config from '../../v6y.config';
import { DemoScreen, FixedModeProvider } from '@/demo/FixedMode';
import AccountAfter from '@/screens/account/After';
import AccountBefore from '@/screens/account/Before';
import MenuAfter from '@/screens/menu/After';
import MenuBefore from '@/screens/menu/Before';
import OrderAfter from '@/screens/order/After';
import OrderBefore from '@/screens/order/Before';
import ProductAfter from '@/screens/product/After';
import ProductBefore from '@/screens/product/Before';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'flat-white' }),
}));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
// Ionicons loads a font file, which Jest can't. Render what it renders on device:
// a Text holding a Private Use Area glyph (which screen readers can't speak).
jest.mock('@expo/vector-icons', () => {
  const { createElement } = require('react');
  const { Text } = require('react-native');
  const Ionicons = ({ size, color }: { size: number; color: string }) =>
    createElement(Text, { style: { fontSize: size, color, fontFamily: 'ionicons' } }, '\uf3a1');
  Ionicons.glyphMap = {};
  return { Ionicons };
});

const measureFromStyle = async (stateNode: any) => {
  const style = StyleSheet.flatten(stateNode?.props?.style) ?? {};
  const width = style.width ?? style.minWidth;
  const height = style.height ?? style.minHeight;
  return typeof width === 'number' && typeof height === 'number' ? { x: 0, y: 0, width, height } : undefined;
};

configure(config, { collect: { measure: measureFromStyle }, report: false, log: false, autoCapture: false });

/** On device, tab screens get a navigation header whose title has role "heading". */
function NavigationHeader({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <Text role="heading" style={{ color: '#1c1c1e', fontSize: 17, fontWeight: '600' }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

interface ScreenCase {
  route: string;
  before: ComponentType;
  after: ComponentType;
  header?: string;
  safeTop?: boolean;
  /** Rule → number of issues the BEFORE screen is built to show. */
  expected: Record<string, number>;
  /** Issues deliberately suppressed (config `ignore` or v6y-ignore comments), in both versions. */
  suppressed: number;
}

const SCREENS: ScreenCase[] = [
  {
    route: 'menu',
    before: MenuBefore,
    after: MenuAfter,
    header: 'Menu',
    expected: {
      'missing-label': 2, // IconButton ×2
      'missing-role': 2, // IconButton ×2
      'touch-target-size': 2, // IconButton ×2 (32×32 < 44, advisory)
      'text-contrast': 1, // delivery note
      'nested-interactive': 3, // favorite inside each card
      'duplicate-label': 6, // "Favorite" ×3, "Add" ×3
    },
    suppressed: 4, // LegacyPromoBanner: contrast + close button (label, role, size)
  },
  {
    route: 'product/[id]',
    before: ProductBefore,
    after: ProductAfter,
    expected: {
      'image-missing-label': 1,
      'missing-heading': 1,
      'font-scaling-disabled': 1,
      'state-not-exposed': 3, // size radios
      'touch-target-size': 2, // stepper buttons 20×20
      'meaningless-label': 1, // "btn_add_to_order"
      'missing-role': 1, // TouchableOpacity CTA
      'text-contrast': 1, // white on #0a84ff
    },
    suppressed: 0,
  },
  {
    route: 'order',
    before: OrderBefore,
    after: OrderAfter,
    header: 'Order',
    expected: {
      'input-missing-label': 2,
      'state-not-exposed': 1, // custom "Leave at door" switch
      'font-scaling-disabled': 1, // maxFontSizeMultiplier 1.3
      'text-contrast': 1, // terms
      'missing-role': 1, // Place order
    },
    suppressed: 0,
  },
  {
    route: 'account',
    before: AccountBefore,
    after: AccountAfter,
    safeTop: true,
    expected: {
      'missing-heading': 1,
      'missing-role': 3, // two rows + "Sign out" text
      'text-contrast': 1, // "Sign out" red
    },
    suppressed: 1, // v6y-ignore on the version long-press
  },
];

const snapshotDir = path.resolve(__dirname, '../../.v6y/snapshots');

async function auditScreen(c: ScreenCase, variant: 'before' | 'after'): Promise<SnapshotReport> {
  let renderer!: ReactTestRenderer;
  const screen = <DemoScreen before={c.before} after={c.after} safeTop={c.safeTop} />;
  await act(async () => {
    renderer = create(
      <V6yProvider>
        <FixedModeProvider initialFixed={variant === 'after'}>
          {c.header ? <NavigationHeader title={c.header}>{screen}</NavigationHeader> : screen}
        </FixedModeProvider>
      </V6yProvider>,
    );
  });
  const name = `${c.route} (${variant})`;
  const report = await capture(name);
  act(() => renderer.unmount());
  if (!report) throw new Error(`no report for ${name}`);

  fs.mkdirSync(snapshotDir, { recursive: true });
  const file = `${c.route.replace(/[^\w]+/g, '_')}.${variant}.json`;
  fs.writeFileSync(path.join(snapshotDir, file), JSON.stringify(report.snapshot, null, 2));
  return report;
}

const countByRule = (issues: Issue[]) =>
  issues.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.ruleId]: (acc[i.ruleId] ?? 0) + 1 }), {});

describe.each(SCREENS)('$route', (c) => {
  it('BEFORE shows the issues annotated in its source', async () => {
    const report = await auditScreen(c, 'before');
    expect(countByRule(report.issues)).toEqual(c.expected);
    expect(report.suppressed).toHaveLength(c.suppressed);
  });

  it('AFTER is clean', async () => {
    const report = await auditScreen(c, 'after');
    expect(report.issues).toEqual([]);
    expect(report.suppressed).toHaveLength(c.suppressed);
  });
});

it('the BEFORE screens demonstrate every v6y rule', () => {
  const demonstrated = new Set(SCREENS.flatMap((c) => Object.keys(c.expected)));
  expect([...demonstrated].sort()).toEqual(allRules.map((r) => r.meta.id).sort());
});

it('points shared-component issues at the component, with each call site', async () => {
  const report = await auditScreen(SCREENS[0]!, 'before');
  const missingLabels = report.issues.filter((i) => i.ruleId === 'missing-label');
  expect(missingLabels.map((i) => i.source?.file)).toEqual([
    'src/components/before/IconButton.tsx',
    'src/components/before/IconButton.tsx',
  ]);
  const callSites = missingLabels.map((i) => `${i.ownerSources?.[0]?.file}:${i.ownerSources?.[0]?.line}`);
  expect(new Set(callSites).size).toBe(2);
  expect(callSites.every((s) => s.startsWith('src/screens/menu/Before.tsx:'))).toBe(true);
});

it('keeps the reason for inline suppressions', async () => {
  const report = await auditScreen(SCREENS[3]!, 'after');
  expect(report.suppressed[0]?.suppressed).toEqual({
    by: 'inline',
    reason: 'hidden developer shortcut (long-press), not a user-facing control',
  });
});
