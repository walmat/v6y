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
    ...(f.scope ? { scope: f.scope } : {}),
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
  assignScopes(all, visible);
  const issues = all.filter((i) => !i.suppressed).sort((a, b) => rank(a.severity) - rank(b.severity));
  const suppressed = all.filter((i) => i.suppressed);
  for (const i of issues) delete i.suppressed;
  return { issues, suppressed };
}

/** Audits one screen and returns unsuppressed issues, errors first. */
export function audit(snapshot: ScreenSnapshot, config?: V6yConfig | ResolvedConfig): Issue[] {
  return auditScreen(snapshot, config).issues;
}

/** Rules whose findings depend on content callers pass in, never on the component itself. */
const CALLER_RULES = new Set(['duplicate-label']);

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

/**
 * Marks issues whose fix belongs inside a shared component: the rule said so
 * (e.g. a wrapper dropping state), or every element that component line renders
 * on the screen has the same issue and it's used from 2+ call sites. Those are
 * reported once at the component, with the call sites listed; everything else
 * is a call-site issue.
 */
function assignScopes(issues: Issue[], visible: readonly A11yNode[]) {
  // A component's call sites are its immediate callers: further-out app files can
  // collapse many callers into one (e.g. everything rendered through a portal).
  const appSite = (i: Issue) => i.ownerSources?.[0];
  const rendered = new Map<string, number>();
  for (const n of visible) if (n.source) rendered.set(loc(n.source), (rendered.get(loc(n.source)) ?? 0) + 1);

  const groups = new Map<string, Issue[]>();
  for (const i of issues) {
    // Duplicate names come from what callers pass, so they're always call-site issues.
    if (!i.source || CALLER_RULES.has(i.ruleId)) {
      if (i.scope !== 'component') i.scope = 'call-site';
      continue;
    }
    const k = `${i.ruleId}|${loc(i.source)}`;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  }
  for (const group of groups.values()) {
    const sites = [...new Map(group.map(appSite).filter(Boolean).map((s) => [loc(s!), s!] as const)).values()];
    const nodes = new Set(group.map((i) => i.nodeId)).size;
    const uniform = nodes === rendered.get(loc(group[0]!.source)) && sites.length >= 2;
    for (const i of group) {
      if (i.scope === 'component' || uniform) {
        i.scope = 'component';
        i.location = i.source;
        delete i.via;
        if (sites.length) i.callSites = sites;
      } else {
        i.scope = 'call-site';
      }
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
    const sites = i.callSites ?? (i.via || !i.ownerSources?.[0] ? [] : [i.ownerSources[0]]);
    for (const site of sites) if (!g.usedAt.some((u) => loc(u) === loc(site))) g.usedAt.push(site);
  }
  return [...groups.values()];
}
