/**
 * Snapshot format: a platform-neutral description of what a screen exposes to
 * assistive technology. The React Native collector produces it; the rules
 * engine consumes it. Keep it plain JSON so snapshots can be saved, diffed and
 * sent over the wire.
 */

export interface SourceLocation {
  /** Path relative to the project root, e.g. "src/screens/Checkout.tsx". */
  file: string;
  line: number;
  column: number;
}

export interface InlineIgnore {
  /** Rule ids, or "*" for every rule. */
  rules: string[] | '*';
  reason?: string;
  source?: SourceLocation;
}

export interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface A11yState {
  disabled?: boolean;
  selected?: boolean;
  checked?: boolean | 'mixed';
  expanded?: boolean;
  busy?: boolean;
}

export interface NodeStyle {
  color?: string;
  backgroundColor?: string;
  fontSize?: number;
  fontWeight?: string;
  opacity?: number;
}

export interface A11yNode {
  /** Stable within one snapshot. */
  id: string;
  /** Native host type, e.g. "RCTView", "RCTText", "RCTImageView". */
  type: string;
  /** Nearest named user-level component, e.g. "Pressable", "CheckoutButton". */
  component?: string;

  role?: string;
  /** Explicit label (accessibilityLabel / aria-label). */
  label?: string;
  hint?: string;
  /** Raw text content of this node (host text nodes only). */
  text?: string;
  state?: A11yState;

  /** `accessible` prop: true makes this node one focusable element that merges its descendants. */
  accessible?: boolean;
  /** Hidden from assistive tech, including descendants. */
  hidden?: boolean;
  /** Responds to presses. */
  interactive?: boolean;

  frame?: Frame;
  hitSlop?: Insets;
  style?: NodeStyle;

  /** Text only: false disables Dynamic Type / font scaling. */
  allowFontScaling?: boolean;
  /** Text only: cap on font scaling. 0 or undefined means no cap. */
  maxFontSizeMultiplier?: number;

  /** Text inputs only. */
  placeholder?: string;
  /** accessibilityLabelledBy / aria-labelledby: the nativeID of a visible label. */
  labelledBy?: string;

  /** Inline `v6y-ignore` comments that apply to this node (inherited from enclosing elements). */
  ignore?: InlineIgnore[];

  /** Where the JSX element that rendered this node lives. */
  source?: SourceLocation;
  /** Enclosing JSX call sites, innermost first (useful when the fix belongs at the call site). */
  ownerSources?: SourceLocation[];

  children: A11yNode[];
}

export type Platform = 'ios' | 'android' | 'unknown';

export interface ScreenSnapshot {
  /** Route or screen name, e.g. "Checkout". */
  screen: string;
  platform: Platform;
  window?: { width: number; height: number; fontScale: number };
  capturedAt?: string;
  root: A11yNode;
}

export type Severity = 'error' | 'warning';

export interface Issue {
  ruleId: string;
  severity: Severity;
  message: string;
  /** WCAG 2.1 success criteria, e.g. ["4.1.2"]. */
  wcag: string[];
  screen: string;
  nodeId: string;
  component?: string;
  source?: SourceLocation;
  ownerSources?: SourceLocation[];
  /** Short, concrete suggestion for fixing it. */
  fix?: string;
  /** Set when an inline comment or config `ignore` silenced this issue. */
  suppressed?: { by: 'inline' | 'config'; reason?: string };
}

/** What the app sends to the dev server after each capture. */
export interface SnapshotReport {
  snapshot: ScreenSnapshot;
  issues: Issue[];
  suppressed: Issue[];
}
