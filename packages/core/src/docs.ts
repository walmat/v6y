/**
 * Renders the rule reference (docs/rules/*.md) from the rules themselves, so
 * the docs can't drift from the code. `npm run docs` writes them; a test fails
 * when the committed files are out of date.
 */
import { Rule } from './rule';
import { allRules, OPTION_DOCS, RULE_EXAMPLES } from './rules';
import { PresetName, presets } from './config';
import { WCAG, wcagUrl } from './wcag';

const PRESETS = Object.keys(presets) as PresetName[];

function levelIn(preset: PresetName, id: string): string {
  const entry = presets[preset][id as keyof (typeof presets)[PresetName]];
  const level = Array.isArray(entry) ? entry[0] : entry;
  return level === 'off' || level === undefined ? 'off' : String(level);
}

const GENERATED = '<!-- Generated from packages/core/src/rules by `npm run docs`. Edit the rule, not this file. -->';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function renderRuleDoc(rule: Rule<any>): string {
  const { id, title, docs, wcag, heuristic } = rule.meta;
  const example = RULE_EXAMPLES[id];
  const options = Object.entries(rule.defaultOptions as Record<string, unknown>);
  const out: string[] = [GENERATED, '', `# ${id}`, '', `**${title}.**`, ''];

  out.push(
    '| Preset | Level |',
    '|---|---|',
    ...PRESETS.map((p) => `| \`${p}\` | ${levelIn(p, id)} |`),
    '',
    `**WCAG:** ${wcag.map((c) => `[${c} ${WCAG[c]?.title ?? ''}](${wcagUrl(c)}) (Level ${WCAG[c]?.level ?? '?'})`).join(', ')}`,
    '',
  );
  if (heuristic) out.push('This rule uses a heuristic, so it can occasionally flag something that is fine. It is a warning, not an error, in every preset.', '');

  out.push('## Why it matters, and how to fix it', '', docs.trim(), '');

  if (example) {
    out.push('## Example', '', 'Before:', '', '```tsx', example.bad, '```', '', 'After:', '', '```tsx', example.good, '```', '');
  }

  if (options.length) {
    out.push(
      '## Options',
      '',
      '| Option | Default | What it does |',
      '|---|---|---|',
      ...options.map(([k, v]) => `| \`${k}\` | \`${JSON.stringify(v)}\` | ${OPTION_DOCS[id]?.[k] ?? ''} |`),
      '',
    );
  }

  const sample = options.length ? `['error', { ${options[0]![0]}: ${JSON.stringify(options[0]![1])} }]` : `'warning'`;
  out.push(
    '## Configure',
    '',
    '```ts',
    '// v6y.config.ts',
    'export default defineConfig({',
    `  rules: { '${id}': ${sample} }, // or 'off'`,
    '});',
    '```',
    '',
    'To silence it for one element, with a reason:',
    '',
    '```tsx',
    `{/* v6y-ignore ${id} -- why this one is fine */}`,
    '```',
    '',
    '[All rules](./README.md)',
    '',
  );
  return out.join('\n');
}

export function renderRulesIndex(): string {
  const rows = allRules.map(
    (r) =>
      `| [\`${r.meta.id}\`](./${r.meta.id}.md) | ${r.meta.title} | ${PRESETS.map((p) => levelIn(p, r.meta.id)).join(' | ')} | ${r.meta.wcag.join(', ')} |`,
  );
  return [
    GENERATED,
    '',
    '# Rules',
    '',
    'Every rule v6y checks, its level in each preset, and the WCAG success criteria it covers. Run `npx v6y rules` for the same table in your terminal.',
    '',
    `| Rule | What it checks | ${PRESETS.map((p) => `\`${p}\``).join(' | ')} | WCAG |`,
    `|---|---|${PRESETS.map(() => '---').join('|')}|---|`,
    ...rows,
    '',
    'Automated checks catch a large share of accessibility problems, not all of them. Also test key flows with VoiceOver and TalkBack.',
    '',
  ].join('\n');
}

/** Every file of the rule reference: path (relative to docs/rules) → contents. */
export function renderRuleDocs(): Record<string, string> {
  const files: Record<string, string> = { 'README.md': renderRulesIndex() };
  for (const r of allRules) files[`${r.meta.id}.md`] = renderRuleDoc(r);
  return files;
}
