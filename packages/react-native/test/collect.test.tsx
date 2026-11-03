import { describe, expect, it } from 'vitest';
import * as React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { A11yNode, audit } from '@v6y/core';
import { V6yProvider, collect, focusedRouteName } from '@v6y/react-native';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Stand-ins for React Native's host components and the components that wrap them.
const h = React.createElement;
const RCTView = (props: any) => h('RCTView', props);
const RCTText = (props: any) => h('RCTText', props);

function Pressable({ children, onPress, ...rest }: any) {
  // Like RN's Pressable: forwards press handling to the host as responder props.
  return h(RCTView, { ...rest, accessible: true, onClick: onPress, onResponderRelease: onPress }, children);
}
function Text(props: any) {
  return h(RCTText, props);
}
function IconButton({ onPress, __v6y }: any) {
  // App component; Babel stamps elements written in app code with __v6y.
  return h(Pressable, { onPress, style: { width: 20, height: 20 }, __v6y: 'src/IconButton.tsx:4:10' }, h(RCTView, { __v6y: 'src/IconButton.tsx:5:12' }));
}

// Test measure function: derive frames from style width/height.
const measure = async (stateNode: any) => {
  const style = stateNode?.props?.style ?? {};
  return { x: 0, y: 0, width: style.width ?? 100, height: style.height ?? 50 };
};

async function rootFiberOf(element: React.ReactElement) {
  let provider: any;
  await act(async () => {
    TestRenderer.create(h(V6yProvider, { ref: (r: any) => (provider = r), autoCapture: false } as any, element));
  });
  let root = provider._reactInternals;
  while (root.return) root = root.return;
  return root.stateNode.current;
}

async function snapshotOf(element: React.ReactElement) {
  return (await collect(await rootFiberOf(element), { measure })).root;
}

function find(node: A11yNode, pred: (n: A11yNode) => boolean): A11yNode | undefined {
  if (pred(node)) return node;
  for (const c of node.children) {
    const r = find(c, pred);
    if (r) return r;
  }
  return undefined;
}

describe('collect', () => {
  it('builds host nodes with text, roles, labels and state', async () => {
    const tree = await snapshotOf(
      h(RCTView, { style: [{ backgroundColor: '#fff' }, null] },
        h(Pressable, { onPress: () => {}, accessibilityRole: 'button', accessibilityState: { disabled: true }, 'aria-selected': true },
          h(Text, { style: { color: '#333', fontSize: 16 } }, 'Buy ', 'now'),
        ),
      ),
    );
    const button = find(tree, (n) => !!n.interactive)!;
    expect(button.role).toBe('button');
    expect(button.state).toEqual({ disabled: true, selected: true });
    expect(button.frame).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    const text = find(tree, (n) => n.type === 'RCTText')!;
    expect(text.text).toBe('Buy now');
    expect(text.style).toEqual({ color: '#333', fontSize: 16 });
    expect(tree.children[0]?.style?.backgroundColor).toBe('#fff');
  });

  it('attributes host nodes to the app component and source that rendered them', async () => {
    const tree = await snapshotOf(h(RCTView, null, h(IconButton, { onPress: () => {}, __v6y: 'src/Header.tsx:22:7' })));
    const button = find(tree, (n) => !!n.interactive)!;
    expect(button.component).toBe('Pressable');
    expect(button.source).toEqual({ file: 'src/IconButton.tsx', line: 4, column: 10 });
    expect(button.ownerSources).toEqual([{ file: 'src/Header.tsx', line: 22, column: 7 }]);
    const inner = button.children[0]!;
    expect(inner.source).toEqual({ file: 'src/IconButton.tsx', line: 5, column: 12 });
  });

  it('marks hidden subtrees and inactive react-native-screens', async () => {
    const tree = await snapshotOf(
      h(RCTView, null,
        h('RNSScreen', { activityState: 0 }, h(Pressable, { onPress: () => {} })),
        h(RCTView, { importantForAccessibility: 'no-hide-descendants' }),
        h(RCTView, { style: { display: 'none' } }),
      ),
    );
    expect(tree.children[0]!.children.map((c) => c.hidden)).toEqual([true, true, true]);
  });

  it('does not treat scroll views as pressable', async () => {
    const tree = await snapshotOf(h('RCTScrollView', { onResponderRelease: () => {} }));
    expect(tree.children[0]!.interactive).toBeUndefined();
  });

  it('feeds the rules engine end to end', async () => {
    const tree = await snapshotOf(h(RCTView, null, h(IconButton, { onPress: () => {}, __v6y: 'src/Header.tsx:22:7' })));
    const issues = audit({ screen: 'Home', platform: 'ios', root: tree });
    expect(issues.map((i) => i.ruleId).sort()).toEqual(['missing-label', 'missing-role', 'touch-target-size']);
    expect(issues.every((i) => i.source?.file === 'src/IconButton.tsx')).toBe(true);
  });

  it('propagates inline ignores to everything an element renders', async () => {
    const ignore = JSON.stringify({ rules: ['missing-role'], reason: 'decorative' });
    const tree = await snapshotOf(
      h(RCTView, null,
        h(IconButton, { onPress: () => {}, __v6y: 'src/Header.tsx:22:7', __v6yIgnore: ignore }),
        h(IconButton, { onPress: () => {}, __v6y: 'src/Header.tsx:23:7' }),
      ),
    );
    const [a, b] = tree.children[0]!.children;
    expect(a!.ignore).toEqual([{ rules: ['missing-role'], reason: 'decorative', source: { file: 'src/Header.tsx', line: 22, column: 7 } }]);
    expect(a!.children[0]!.ignore).toHaveLength(1);
    expect(b!.ignore).toBeUndefined();
    const result = audit({ screen: 'Home', platform: 'ios', root: tree });
    expect(result.filter((i) => i.ruleId === 'missing-role')).toHaveLength(1);
  });

  it('records placeholders and labelledBy on inputs', async () => {
    const tree = await snapshotOf(h('RCTSinglelineTextInputView', { placeholder: 'Email', 'aria-labelledby': 'emailLabel' }));
    expect(tree.children[0]).toMatchObject({ placeholder: 'Email', labelledBy: 'emailLabel' });
  });

  it('hides unfocused navigation screens and finds the focused route', async () => {
    const nav = (focused: boolean) => ({ isFocused: () => focused });
    // A tab bar button: the navigator's navigation (focused) + a route that is NOT the focused one.
    const tabsNav = { isFocused: () => true, getState: () => ({ index: 1, routes: [{ key: 'feed' }, { key: 'profile' }] }) };
    function TabButton(_: any) {
      return h(Pressable, { onPress: () => {} });
    }
    function Screen(_: any) {
      return h(Pressable, { onPress: () => {} });
    }
    function Tabs() {
      return h(RCTView, null,
        h(Screen, { route: { name: 'Feed' }, navigation: nav(false) }),
        h(Screen, { route: { name: 'Profile' }, navigation: nav(true) }),
        h(RCTView, null, h(RCTView, null, h(TabButton, { route: { name: 'Feed', key: 'feed' }, navigation: tabsNav }))),
      );
    }
    const element = h(Tabs, { route: { name: 'Home' }, navigation: nav(true) });
    const tree = await snapshotOf(element);
    const [feed, profile] = tree.children[0]!.children;
    expect(feed!.hidden).toBe(true);
    expect(profile!.hidden).toBeUndefined();
    expect(focusedRouteName(await rootFiberOf(element))).toBe('Profile');
  });

  it('does not count onClick-only wrapper Views as pressable (native)', async () => {
    const tree = await snapshotOf(h(RCTView, { onClick: () => {} }, h(Pressable, { onPress: () => {} })));
    const wrapper = tree.children[0]!;
    expect(wrapper.interactive).toBeUndefined();
    expect(wrapper.children[0]!.interactive).toBe(true);
  });

  it('audits only the topmost modal when one is open', async () => {
    const tree = await snapshotOf(
      h(RCTView, null,
        h(Pressable, { onPress: () => {} }),
        h('RCTModalHostView', { visible: true }, h(Pressable, { onPress: () => {}, accessibilityLabel: 'Close' })),
      ),
    );
    const [screenContent] = tree.children;
    const background = screenContent!.children[0]!;
    const modal = screenContent!.children[1]!;
    expect(background.hidden).toBe(true);
    expect(modal.kind).toBe('modal');
    expect(modal.hidden).toBeUndefined();
    expect(modal.children[0]!.hidden).toBeUndefined();
  });

  it('treats aria-modal / accessibilityViewIsModal views as modal', async () => {
    const tree = await snapshotOf(h(RCTView, null, h(RCTView, { testID: 'bg' }), h(RCTView, { 'aria-modal': true })));
    expect(tree.children[0]!.children.map((c) => c.hidden)).toEqual([true, undefined]);
  });

  it('classifies custom host types and reads text from a text prop', async () => {
    let provider: any;
    await act(async () => {
      TestRenderer.create(h(V6yProvider, { ref: (r: any) => (provider = r), autoCapture: false } as any, h('MySelectableText', { text: 'Hello' }), h('RNUITextView', { text: 'Built in' })));
    });
    let root = provider._reactInternals;
    while (root.return) root = root.return;
    const { root: tree } = await collect(root.stateNode.current, { measure, hostTypes: { text: ['MySelectableText'] } });
    expect(tree.children.map((c) => [c.kind, c.text])).toEqual([['text', 'Hello'], ['text', 'Built in']]);
  });

  it('carries owner chains across host boundaries so they reach app code', async () => {
    // App screen → Card (design system, renders a View) → Button (design system) → Pressable host.
    function Button({ __v6y }: any) {
      return h(Pressable, { onPress: () => {}, __v6y: 'src/components/Button.tsx:9:5' });
    }
    function Card(_: any) {
      return h(RCTView, { __v6y: 'src/components/Card.tsx:4:5' }, h(Button, { __v6y: 'src/components/Card.tsx:5:7' }));
    }
    const tree = await snapshotOf(h(Card, { __v6y: 'src/screens/Home.tsx:42:7' }));
    const button = find(tree, (n) => !!n.interactive)!;
    expect(button.source?.file).toBe('src/components/Button.tsx');
    expect(button.ownerSources?.map((s) => `${s.file}:${s.line}`)).toEqual([
      'src/components/Card.tsx:5',
      'src/components/Card.tsx:4',
      'src/screens/Home.tsx:42',
    ]);
    const issues = audit({ screen: 'Home', platform: 'ios', root: tree }, { designSystem: ['src/components/**'] });
    expect(issues.every((i) => i.location?.file === 'src/screens/Home.tsx')).toBe(true);
  });

  it('records accessibility state a wrapper dropped', async () => {
    // Like Bluesky's Button: spreads props, then overwrites accessibilityState with {disabled}.
    function Button({ accessibilityState: _ignored, ...rest }: any) {
      return h(Pressable, { ...rest, accessibilityRole: 'tab', accessibilityState: { disabled: false }, onPress: () => {} });
    }
    const tree = await snapshotOf(h(Button, { accessibilityState: { selected: true } }));
    const tab = find(tree, (n) => n.role === 'tab')!;
    expect(tab.droppedState).toEqual(['selected']);
  });

  it('ignores undefined state keys (React Native Pressable passes them all)', async () => {
    function Tab(_: any) {
      return h(RCTView, { accessibilityState: { busy: undefined, selected: undefined, disabled: false } }, h(Pressable, { onPress: () => {}, accessibilityRole: 'tab', accessibilityState: { disabled: false } }));
    }
    function Wrapper(_: any) {
      return h(Pressable, { onPress: () => {}, accessibilityRole: 'tab', accessibilityState: { selected: undefined, checked: undefined, disabled: false } });
    }
    const tree = await snapshotOf(h(RCTView, null, h(Tab), h(Wrapper)));
    const tabs: A11yNode[] = [];
    const all = (n: A11yNode) => { if (n.role === 'tab') tabs.push(n); n.children.forEach(all); };
    all(tree);
    expect(tabs.every((t) => !t.droppedState)).toBe(true);
    expect(tabs.every((t) => t.state && !('selected' in t.state))).toBe(true);
  });
});

