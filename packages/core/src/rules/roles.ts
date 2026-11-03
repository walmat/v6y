/** Rules about roles, states and structure. */
import { defineRule, describeNode } from '../rule';
import type { A11yNode } from '../types';
import { hasIntrinsicRole, isText, speakableText } from '../tree';

export const missingRole = defineRule({
  meta: {
    id: 'missing-role',
    title: 'Interactive elements should expose a role',
    wcag: ['4.1.2'],
    docs: `Without a role, VoiceOver and TalkBack read the label but don't say it's a button, link or tab, so users don't know they can activate it.

**Fix:** add \`accessibilityRole="button"\` (or \`"link"\`, \`"tab"\`, \`"checkbox"\`, …).`,
  },
  defaultOptions: {},
  check(node) {
    if (!node.interactive || node.role || hasIntrinsicRole(node)) return [];
    return [
      {
        message: `${describeNode(node)} responds to presses but has no role, so VoiceOver/TalkBack won't announce it as a button or link.`,
        fix: 'Add accessibilityRole="button" (or "link", "tab", "checkbox", … as appropriate).',
      },
    ];
  },
});

// ---------------------------------------------------------------------------

export const nestedInteractive = defineRule({
  meta: {
    id: 'nested-interactive',
    title: "Don't put pressable elements inside other pressable elements",
    wcag: ['4.1.2'],
    docs: `A pressable inside another pressable (e.g. a "favorite" button inside a tappable card) is merged into its parent for screen readers. The inner action becomes unreachable with VoiceOver and TalkBack.

**Fix:** make them siblings. Or set \`accessible={false}\` on the outer element and expose the card's action separately, e.g. via \`accessibilityActions\`.`,
  },
  defaultOptions: {},
  check(node, ctx) {
    if (!node.interactive) return [];
    const outer = [...ctx.ancestors].reverse().find((a) => a.interactive && a.accessible !== false);
    if (!outer) return [];
    return [
      {
        message: `${describeNode(node)} is nested inside another pressable (${describeNode(outer)}). Screen readers merge them, so the inner one can't be reached.`,
        fix: 'Make them siblings, or set accessible={false} on the outer element and use accessibilityActions.',
      },
    ];
  },
});

// ---------------------------------------------------------------------------

const STATEFUL: Record<string, 'checked' | 'selected'> = {
  checkbox: 'checked',
  switch: 'checked',
  radio: 'checked',
  togglebutton: 'checked',
  tab: 'selected',
};

export const stateNotExposed = defineRule({
  meta: {
    id: 'state-not-exposed',
    title: 'Toggles, checkboxes and tabs must expose their state',
    wcag: ['4.1.2'],
    docs: `A custom checkbox, switch, radio button or tab that doesn't report its state sounds the same whether it's on or off.

**Fix:** pass \`accessibilityState={{ checked }}\` (or \`selected\` for tabs), or \`aria-checked\` / \`aria-selected\`.`,
  },
  defaultOptions: {},
  check(node) {
    if (!node.role || hasIntrinsicRole(node)) return [];
    const key = STATEFUL[node.role];
    if (!key) return [];
    if (node.state?.[key] !== undefined) return [];
    return [
      {
        message: `${describeNode(node)} has role "${node.role}" but doesn't expose whether it's ${key}.`,
        fix: `Add accessibilityState={{ ${key}: … }} (or aria-${key}).`,
      },
    ];
  },
});

// ---------------------------------------------------------------------------

export const missingHeading = defineRule({
  meta: {
    id: 'missing-heading',
    title: 'Screens should have at least one heading',
    wcag: ['1.3.1', '2.4.6'],
    heuristic: true,
    docs: `Screen reader users jump between headings to skim a screen. A screen title styled as big bold text isn't a heading unless it has the role.

**Fix:** add \`accessibilityRole="header"\` to the screen title. Note: native navigation bars (e.g. native-stack headers) aren't visible to v6y; if yours provides the heading, disable this rule for those screens.`,
  },
  defaultOptions: {},
  checkScreen(_snapshot, visible) {
    if (visible.some((n) => n.role === 'header' || n.role === 'heading')) return [];
    // Point at the text that looks like the title (the largest, at least 20pt), so the fix location is obvious.
    let title: A11yNode | undefined;
    for (const n of visible) {
      const size = n.style?.fontSize ?? 0;
      if (isText(n) && speakableText(n.text) && size >= 20 && size > (title?.style?.fontSize ?? 0)) title = n;
    }
    if (title) {
      return [
        {
          node: title,
          message: `"${speakableText(title.text)}" looks like this screen's title but isn't a heading, so screen reader users can't jump to it.`,
          fix: 'Add accessibilityRole="header" to it.',
        },
      ];
    }
    const first = visible.find((n) => n.type !== 'Root');
    if (!first) return [];
    return [
      {
        node: first,
        message: 'This screen has no heading, so screen reader users can\'t jump to its title.',
        fix: 'Add accessibilityRole="header" to the screen title.',
      },
    ];
  },
});
