import { A11yNode, ScreenSnapshot } from './types';

export interface RuleMeta {
  id: string;
  /** One line, shown in reports and `v6y rules`. */
  title: string;
  /** Why it matters and how to fix it (markdown). */
  docs: string;
  /** WCAG success criteria this rule checks (see wcag.ts). */
  wcag: string[];
  /** True when the rule relies on a heuristic and can have false positives. */
  heuristic?: boolean;
}

export interface RuleContext {
  snapshot: ScreenSnapshot;
  /** Root first, parent last. Hidden subtrees are never visited. */
  ancestors: readonly A11yNode[];
}

export interface Finding {
  message: string;
  fix?: string;
  /**
   * Advisory findings go beyond the WCAG requirement (e.g. Apple's 44pt touch
   * target). They are always reported as warnings, whatever the rule's level.
   */
  advisory?: boolean;
  /** Overrides the rule's WCAG criteria for this finding (e.g. AAA contrast is 1.4.6). */
  wcag?: string[];
}

export interface ScreenFinding extends Finding {
  node: A11yNode;
}

export interface Rule<O extends object = object> {
  meta: RuleMeta;
  defaultOptions: O;
  /** Called for every visible node. */
  check?(node: A11yNode, ctx: RuleContext, options: O): Finding[];
  /** Called once per screen, for rules that compare nodes (duplicates, headings). */
  checkScreen?(snapshot: ScreenSnapshot, visible: readonly A11yNode[], options: O): ScreenFinding[];
}

export function defineRule<O extends object>(rule: Rule<O>): Rule<O> {
  return rule;
}

export const describeNode = (node: A11yNode) => node.component ?? node.type;
