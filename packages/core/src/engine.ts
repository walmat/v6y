import { A11yNode, Issue, ScreenSnapshot, Severity, SourceLocation } from './types';
import { Finding } from './rule';
import { ResolvedConfig, V6yConfig, resolveConfig } from './config';
import { rulesById, RuleId } from './rules';

export interface AuditResult {
  issues: Issue[];
  /** Issues silenced by inline comments or config `ignore`, kept for reports. */
  suppressed: Issue[];
  /** True when the screen matched `screens.ignore`. */
  skipped?: boolean;
}

/** Audits one screen. Accepts a raw config (resolved on each call) or a pre-resolved one. */
export function auditScreen(snapshot: ScreenSnapshot, config?: V6yConfig | ResolvedConfig): AuditResult {
  const cfg = resolveConfig(config);
  if (cfg.screenIgnore.some((re) => re.test(snapshot.screen))) return { issues: [], suppressed: [], skipped: true };

  const active = [...cfg.rules].map(([id, r]) => ({ rule: rulesById[id as RuleId], ...r }));
  const all: Issue[] = [];
  const visible: A11yNode[] = [];

  const toIssue = (id: string, level: Severity, wcag: string[], node: A11yNode, f: Finding): Issue => ({
    ruleId: id,
    severity: f.advisory ? 'warning' : level,
    message: f.message,
    wcag: f.wcag ?? wcag,
    screen: snapshot.screen,
    nodeId: node.id,
    component: node.component,
    source: node.source,
    ownerSources: node.ownerSources,
    fix: f.fix,
    suppressed: suppression(id, node, cfg),
  });

  const visit = (node: A11yNode, ancestors: A11yNode[]) => {
    if (node.hidden) return;
    visible.push(node);
    for (const { rule, level, options } of active) {
      if (!rule.check) continue;
      for (const f of rule.check(node, { snapshot, ancestors }, options)) {
        all.push(toIssue(rule.meta.id, level, rule.meta.wcag, node, f));
      }
    }
    ancestors.push(node);
    for (const child of node.children) visit(child, ancestors);
    ancestors.pop();
  };
  visit(snapshot.root, []);

  for (const { rule, level, options } of active) {
    if (!rule.checkScreen) continue;
    for (const f of rule.checkScreen(snapshot, visible, options)) {
      all.push(toIssue(rule.meta.id, level, rule.meta.wcag, f.node, f));
    }
  }

  assignLocations(all, cfg);
  const issues = all.filter((i) => !i.suppressed).sort((a, b) => rank(a.severity) - rank(b.severity));
  const suppressed = all.filter((i) => i.suppressed);
  for (const i of issues) delete i.suppressed;
  return { issues, suppressed };
}

/** Audits one screen and returns unsuppressed issues, errors first. */
export function audit(snapshot: ScreenSnapshot, config?: V6yConfig | ResolvedConfig): Issue[] {
  return auditScreen(snapshot, config).issues;
}

/** Distinct call sites at which a shared component's issues move to the call site. */
const AUTO_CALL_SITES = 3;

/**
 * Decides where each issue is reported. Issues inside a shared component go to
 * the call site, "via" the component, when the component matches `designSystem`,
 * or (without that config) when the same issue comes from 3+ different call
 * sites, which is the signature of a design-system component.
 */
function assignLocations(issues: Issue[], cfg: ResolvedConfig) {
  const inDesignSystem = (s?: SourceLocation) => !!s && cfg.designSystem.some((re) => re.test(s.file));
  const key = (i: Issue) => `${i.ruleId}|${loc(i.source)}`;
  const sitesByKey = new Map<string, Set<string>>();
  for (const i of issues) {
    const site = i.ownerSources?.[0];
    if (!site) continue;
    const set = sitesByKey.get(key(i)) ?? new Set<string>();
    set.add(loc(site));
    sitesByKey.set(key(i), set);
  }
  for (const i of issues) {
    if (!i.source) continue;
    let callSite: SourceLocation | undefined;
    if (cfg.designSystem.length) {
      if (inDesignSystem(i.source)) callSite = i.ownerSources?.find((s) => !inDesignSystem(s));
    } else if ((sitesByKey.get(key(i))?.size ?? 0) >= AUTO_CALL_SITES) {
      callSite = i.ownerSources?.[0];
    }
    if (callSite) {
      i.location = callSite;
      i.via = i.source;
    } else {
      i.location = i.source;
    }
  }
}

/** Whether a set of issues should fail CI under `failOn`. */
export function shouldFail(issues: Issue[], config?: V6yConfig | ResolvedConfig): boolean {
  const { failOn } = resolveConfig(config);
  if (failOn === 'never') return false;
  return issues.some((i) => (failOn === 'warning' ? true : i.severity === 'error'));
}

function suppression(ruleId: string, node: A11yNode, cfg: ResolvedConfig): Issue['suppressed'] {
  for (const ig of node.ignore ?? []) {
    if (ig.rules === '*' || ig.rules.includes(ruleId)) return { by: 'inline', reason: ig.reason };
  }
  if (node.source && cfg.ignore.some((re) => re.test(node.source!.file))) return { by: 'config' };
  return undefined;
}

const rank = (s: Severity) => (s === 'error' ? 0 : 1);

export interface IssueGroup {
  /** First issue of the group; all share its rule, message and source. */
  issue: Issue;
  count: number;
  /** Distinct call sites (each issue's nearest ownerSource), in order. */
  usedAt: SourceLocation[];
}

const loc = (s?: SourceLocation) => (s ? `${s.file}:${s.line}:${s.column}` : '');

/**
 * Collapses issues with the same rule, message and source location: one bug
 * in a shared component or list item is one thing to fix, however often it renders.
 */
export function groupIssues(issues: Issue[]): IssueGroup[] {
  const groups = new Map<string, IssueGroup>();
  for (const i of issues) {
    const at = i.location ?? i.source;
    const key = `${i.screen}|${i.ruleId}|${loc(at)}|${loc(i.via)}|${i.message}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { issue: i, count: 0, usedAt: [] }));
    g.count++;
    // Issues already moved to their call site don't need a "used at" list.
    const site = i.via ? undefined : i.ownerSources?.[0];
    if (site && !g.usedAt.some((u) => loc(u) === loc(site))) g.usedAt.push(site);
  }
  return [...groups.values()];
}
