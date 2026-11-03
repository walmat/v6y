/** Rules about what screen readers announce: accessible names and labels. */
import { defineRule, describeNode, ScreenFinding } from '../rule';
import type { A11yNode, SourceLocation } from '../types';

const loc = (s?: SourceLocation) => (s ? `${s.file}:${s.line}:${s.column}` : '');
import { accessibleName, hasIntrinsicRole, isImage, isTextInput } from '../tree';

export const missingLabel = defineRule({
  meta: {
    id: 'missing-label',
    title: 'Interactive elements need an accessible name',
    wcag: ['4.1.2'],
    docs: `A pressable element with no label and no text inside (typically an icon button) is announced as just "button", or not at all. Screen reader users can't tell what it does.

**Fix:** add \`accessibilityLabel\` describing the action: \`<Pressable accessibilityLabel="Close" …>\`.`,
  },
  defaultOptions: {},
  check(node) {
    if (!node.interactive || hasIntrinsicRole(node)) return [];
    if (accessibleName(node)) return [];
    return [
      {
        message: `${describeNode(node)} has no accessible name. Screen readers will announce just "${node.role ?? 'button'}" or skip it.`,
        fix: 'Add accessibilityLabel="…" describing what it does (e.g. "Close", "Add to cart").',
      },
    ];
  },
});

// ---------------------------------------------------------------------------

export interface MeaninglessLabelOptions {
  /** Labels to always accept, e.g. ["OK"]. Case-insensitive. */
  allow: string[];
  /** Extra words to treat as generic, e.g. your design system's component names. */
  generic: string[];
}

const GENERIC = [
  'button', 'btn', 'icon', 'image', 'img', 'picture', 'photo', 'graphic', 'logo', 'link',
  'touchable', 'pressable', 'view', 'container', 'tap', 'click', 'click here', 'tap here',
  'press here', 'here', 'more', 'label', 'text', 'untitled',
];
const IDENTIFIER = /^[a-z][a-z0-9]*([_-][a-z0-9]+)+$/i; // icon_23, ic-close
const CAMEL = /^[a-z]+[A-Z][A-Za-z0-9]*$/; // closeIcon
const FILENAME = /\.(png|jpe?g|svg|gif|webp|pdf)$/i;

export function meaninglessLabelReason(
  label: string,
  role?: string,
  options: Pick<MeaninglessLabelOptions, 'generic'> = { generic: [] },
): string | undefined {
  const l = label.trim();
  const lower = l.toLowerCase();
  if (l.length === 0) return undefined; // missing-label's job
  if (role && lower === role.toLowerCase()) return 'it just repeats the role';
  if (GENERIC.includes(lower) || options.generic.some((g) => g.toLowerCase() === lower))
    return "it is generic and doesn't say what the element does";
  if (FILENAME.test(l)) return 'it looks like a file name';
  if (IDENTIFIER.test(l) || CAMEL.test(l)) return 'it looks like a code identifier';
  if (l.length < 2 && !/\d/.test(l)) return 'it is a single character';
  return undefined;
}

export const meaninglessLabel = defineRule<MeaninglessLabelOptions>({
  meta: {
    id: 'meaningless-label',
    title: 'Labels should describe purpose, not implementation',
    wcag: ['2.4.6'],
    heuristic: true,
    docs: `Labels like "button", "icon_23", "closeIcon" or "close.png" are often left over from code. Screen readers read them aloud as-is.

**Fix:** describe the action or destination: "Close dialog", "Open settings". Use \`allow\` for intentional short labels like "OK".`,
  },
  defaultOptions: { allow: [], generic: [] },
  check(node, _ctx, options) {
    if (!node.label || isTextInput(node)) return []; // "Search" on a search field is fine
    if (options.allow.some((a) => a.toLowerCase() === node.label!.trim().toLowerCase())) return [];
    const reason = meaninglessLabelReason(node.label, node.role, options);
    if (!reason) return [];
    return [
      {
        message: `Label "${node.label}" on ${describeNode(node)} is not meaningful: ${reason}.`,
        fix: 'Describe the purpose or destination, e.g. "Close dialog", "Open settings".',
      },
    ];
  },
});

// ---------------------------------------------------------------------------

export const imageMissingLabel = defineRule({
  meta: {
    id: 'image-missing-label',
    title: 'Images exposed to screen readers need a description',
    wcag: ['1.1.1'],
    docs: `React Native images are skipped by screen readers by default, which is right for decorative images. If you make an image focusable (\`accessible\`) or give it \`accessibilityRole="image"\`, it must also have a label. Otherwise it is announced as "image" with no description.

**Fix:** add \`accessibilityLabel\` describing the content ("Profile photo of Sam"). If it's decorative, remove \`accessible\` and the role instead.`,
  },
  defaultOptions: {},
  check(node, ctx) {
    if (!isImage(node) || node.interactive) return []; // pressable images are missing-label's job
    // Inside an accessible pressable, the image is merged into it; missing-label covers it.
    if (ctx.ancestors.some((a) => a.interactive && a.accessible !== false)) return [];
    if (node.accessible !== true && node.role !== 'image' && node.role !== 'img') return [];
    if (accessibleName(node)) return [];
    return [
      {
        message: `${describeNode(node)} is exposed to screen readers but has no description; it will be announced as just "image".`,
        fix: 'Add accessibilityLabel describing the image, or make it decorative by removing accessible/accessibilityRole.',
      },
    ];
  },
});

// ---------------------------------------------------------------------------

export interface InputMissingLabelOptions {
  /** Accept a placeholder as the only label. Default false (placeholders disappear when typing). */
  allowPlaceholder: boolean;
}

export const inputMissingLabel = defineRule<InputMissingLabelOptions>({
  meta: {
    id: 'input-missing-label',
    title: 'Text fields need a label, not just a placeholder',
    wcag: ['3.3.2', '4.1.2'],
    docs: `A placeholder disappears as soon as the user types, and a visible label above a field isn't connected to it for screen readers unless you link them.

**Fix:** add \`accessibilityLabel="Email"\` to the input, or link it to its visible label with \`accessibilityLabelledBy\` / \`aria-labelledby\` (the label's \`nativeID\`).`,
  },
  defaultOptions: { allowPlaceholder: false },
  check(node, _ctx, options) {
    if (!isTextInput(node)) return [];
    if (node.label?.trim() || node.labelledBy) return [];
    if (options.allowPlaceholder && node.placeholder?.trim()) return [];
    const ph = node.placeholder?.trim();
    return [
      {
        message: ph
          ? `Text field "${ph}" is labelled only by its placeholder, which disappears once the user starts typing.`
          : `Text field has no label; screen readers will announce only "text field".`,
        fix: `Add accessibilityLabel="${ph ?? '…'}" or link a visible label with accessibilityLabelledBy.`,
      },
    ];
  },
});

// ---------------------------------------------------------------------------

export interface DuplicateLabelOptions {
  /** Treat "Delete" and "delete" as the same. Default true. */
  ignoreCase: boolean;
  /**
   * Also flag repeats that come from one call site rendered many times (list
   * rows: "Like" on every post). Off by default; the row gives context.
   */
  includeRepeated: boolean;
}

export const duplicateLabel = defineRule<DuplicateLabelOptions>({
  meta: {
    id: 'duplicate-label',
    title: 'Different controls on one screen should have different names',
    wcag: ['2.4.6'],
    heuristic: true,
    docs: `Five buttons all announced as "Delete" force screen reader users to guess which item each one affects. This is common in lists.

**Fix:** include the item in the label: \`accessibilityLabel={\`Delete \${item.name}\`}\`.`,
  },
  defaultOptions: { ignoreCase: true, includeRepeated: false },
  checkScreen(_snapshot, visible, options) {
    const groups = new Map<string, typeof visible[number][]>();
    for (const n of visible) {
      if (!n.interactive) continue;
      const name = accessibleName(n);
      if (!name) continue;
      const key = options.ignoreCase ? name.toLowerCase() : name;
      groups.set(key, [...(groups.get(key) ?? []), n]);
    }
    const findings: ScreenFinding[] = [];
    // Rows rendered by one .map()/list share their whole chain of callers; separate uses of a
    // shared component (three SegmentedControls) differ somewhere up the chain.
    // Without source info we can't tell repeats apart, so each node counts as its own call site.
    const callSite = (n: A11yNode) =>
      n.source ? [n.source, ...(n.ownerSources ?? [])].map(loc).join('>') : n.id;
    for (const all of groups.values()) {
      // One representative per call site unless repeats are wanted: N list rows are one thing.
      const nodes = options.includeRepeated
        ? all
        : [...new Map(all.map((n) => [callSite(n), n] as const)).values()];
      if (nodes.length < 2) continue;
      const name = accessibleName(nodes[0]!);
      for (const node of nodes) {
        findings.push({
          node,
          message: `Controls on this screen share the name "${name}", so screen reader users can't tell them apart.`,
          fix: 'Make each label specific, e.g. include the item it acts on.',
        });
      }
    }
    return findings;
  },
});
