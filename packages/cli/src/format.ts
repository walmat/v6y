import { Issue, SourceLocation, groupIssues } from '@v6y/core';

const useColor = !process.env.NO_COLOR && process.stdout.isTTY;
const c = (code: number) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
export const red = c(31);
export const yellow = c(33);
export const green = c(32);
export const dim = c(2);
export const bold = c(1);
export const cyan = c(36);

const MAX_SITES = 4;

/** "src/a.tsx:17, 18" when sites share a file; otherwise full file:line for each. */
function formatSites(sites: SourceLocation[]): string {
  const shown = sites.slice(0, MAX_SITES);
  const sameFile = shown.every((s) => s.file === shown[0]!.file);
  const text = sameFile
    ? `${shown[0]!.file}:${shown.map((s) => s.line).join(', ')}`
    : shown.map((s) => `${s.file}:${s.line}`).join(', ');
  return sites.length > MAX_SITES ? `${text} ${dim(`+${sites.length - MAX_SITES} more`)}` : text;
}

/**
 * Human-readable report grouped by screen. Identical issues from the same line
 * (a shared component, a list item) collapse into one entry with a count and
 * their call sites. `file:line:col` is clickable in most terminals and editors.
 */
export function formatIssues(issues: Issue[], { screenHeadings = true } = {}): string {
  if (!issues.length) return green('✓ No accessibility issues found.');
  const out: string[] = [];
  const byScreen = new Map<string, Issue[]>();
  for (const i of issues) byScreen.set(i.screen, [...(byScreen.get(i.screen) ?? []), i]);

  let entries = 0;
  for (const [screen, list] of byScreen) {
    if (screenHeadings) out.push('', bold(underline(screen)));
    for (const { issue: i, count, usedAt } of groupIssues(list)) {
      entries++;
      const icon = i.severity === 'error' ? red('✖ error  ') : yellow('⚠ warning');
      const times = count > 1 ? bold(` ×${count}`) : '';
      const where = i.source
        ? cyan(`${i.source.file}:${i.source.line}:${i.source.column}`)
        : dim('(no source: is withV6y() in metro.config.js?)');
      out.push(`  ${icon}${times} ${i.message}`);
      out.push(`    ${dim('at')} ${where} ${dim(`[${i.ruleId}, WCAG ${i.wcag.join(', ')}]`)}`);
      if (usedAt.length) out.push(`    ${dim('used at')} ${formatSites(usedAt)}`);
      if (i.fix) out.push(`    ${green('fix:')} ${i.fix}`);
    }
  }
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.length - errors;
  const summary = `${errors ? red(`${errors} error${errors === 1 ? '' : 's'}`) : green('0 errors')}, ${
    warnings ? yellow(`${warnings} warning${warnings === 1 ? '' : 's'}`) : '0 warnings'
  }`;
  const places = entries < issues.length ? dim(` (${entries} things to fix)`) : '';
  out.push('', summary + places);
  return out.join('\n');
}

function underline(s: string) {
  return useColor ? `\x1b[4m${s}\x1b[24m` : s;
}
