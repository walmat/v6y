import { Severity } from './types';
import { RuleId, RuleOptionsMap, rulesById } from './rules';

export type RuleLevel = Severity | 'off';
export type RuleEntry<O> = RuleLevel | [RuleLevel] | [RuleLevel, Partial<O>];
export type RulesConfig = { [K in RuleId]?: RuleEntry<RuleOptionsMap[K]> };

export type PresetName = 'recommended' | 'strict' | 'wcag21-aa' | 'wcag22-aa';

export interface V6yConfig {
  /** Start from a preset (default "recommended"). Later entries and `rules` override earlier ones. */
  extends?: PresetName | PresetName[];
  /** Per-rule level and options, ESLint-style: "off" | "warning" | "error" | [level, options]. */
  rules?: RulesConfig;
  /** Source-file globs whose issues are suppressed, e.g. ["src/legacy/**"]. */
  ignore?: string[];
  screens?: {
    /** Screen-name globs that are never audited, e.g. ["DevMenu", "Storybook*"]. */
    ignore?: string[];
  };
  /** Which severity fails `v6y check` (CI). Default "error". */
  failOn?: Severity | 'never';
  /** In-app capture behaviour. */
  capture?: {
    /** Wait after a screen change before snapshotting, so data and transitions settle. Default 800. */
    delayMs?: number;
    /** How often to check for screen changes when navigation isn't tracked explicitly. Default 1000. */
    pollMs?: number;
  };
}

/** Identity helper that gives you autocomplete and type-checking in `v6y.config.ts`. */
export function defineConfig(config: V6yConfig): V6yConfig {
  return config;
}

// ---------------------------------------------------------------------------
// Presets

/** Low false-positive rules that every app should pass. */
const recommended: RulesConfig = {
  'missing-label': 'error',
  'meaningless-label': 'warning',
  'image-missing-label': 'error',
  'input-missing-label': 'warning',
  'duplicate-label': 'off',
  'missing-role': 'warning',
  'nested-interactive': 'error',
  'state-not-exposed': 'error',
  'missing-heading': 'off',
  'touch-target-size': 'error',
  'text-contrast': 'error',
  'font-scaling-disabled': 'error',
};

/** Everything on; heuristics as warnings. */
const strict: RulesConfig = {
  ...recommended,
  'input-missing-label': 'error',
  'missing-role': 'error',
  'duplicate-label': 'warning',
  'missing-heading': 'warning',
};

/**
 * WCAG 2.1 Level AA: the standard referenced by the EU Accessibility Act (via
 * EN 301 549) and the US ADA Title II rule. Only requirements, no platform
 * guidelines. Heuristic rules stay warnings.
 */
const wcag21aa: RulesConfig = {
  ...strict,
  'missing-role': 'error',
  // 2.5.8 Target Size (Minimum) is WCAG 2.2, not 2.1.
  'touch-target-size': 'off',
};

/** WCAG 2.2 Level AA. */
const wcag22aa: RulesConfig = {
  ...wcag21aa,
  'touch-target-size': ['error', { platformGuidelines: false }],
};

export const presets: Record<PresetName, RulesConfig> = {
  recommended,
  strict,
  'wcag21-aa': wcag21aa,
  'wcag22-aa': wcag22aa,
};

// ---------------------------------------------------------------------------
// Resolution

export interface ResolvedRule {
  level: Severity;
  options: object;
}

export interface ResolvedConfig {
  rules: Map<string, ResolvedRule>;
  ignore: RegExp[];
  screenIgnore: RegExp[];
  failOn: Severity | 'never';
  capture: { delayMs: number; pollMs: number };
  /** Marker so engine functions can accept either form. */
  resolved: true;
}

export class ConfigError extends Error {
  override name = 'V6yConfigError';
}

const LEVELS: RuleLevel[] = ['off', 'warning', 'error'];

export function resolveConfig(config: V6yConfig | ResolvedConfig = {}): ResolvedConfig {
  if ((config as ResolvedConfig).resolved) return config as ResolvedConfig;
  const c = config as V6yConfig;

  const presetNames = c.extends === undefined ? ['recommended'] : Array.isArray(c.extends) ? c.extends : [c.extends];
  const layers: RulesConfig[] = [];
  for (const name of presetNames) {
    const preset = presets[name as PresetName];
    if (!preset) throw new ConfigError(`Unknown preset "${name}". Use one of: ${Object.keys(presets).join(', ')}.`);
    layers.push(preset);
  }
  if (c.rules) layers.push(c.rules);

  const rules = new Map<string, ResolvedRule>();
  const optionLayers = new Map<string, object>();
  for (const layer of layers) {
    for (const [id, entry] of Object.entries(layer)) {
      const rule = rulesById[id as RuleId];
      if (!rule) {
        throw new ConfigError(`Unknown rule "${id}". Known rules: ${Object.keys(rulesById).join(', ')}.`);
      }
      const [level, options] = Array.isArray(entry) ? entry : [entry, undefined];
      if (!LEVELS.includes(level as RuleLevel)) {
        throw new ConfigError(`Rule "${id}": level must be "off", "warning" or "error" (got ${JSON.stringify(level)}).`);
      }
      if (options) {
        for (const key of Object.keys(options)) {
          if (!(key in rule.defaultOptions)) {
            const known = Object.keys(rule.defaultOptions);
            throw new ConfigError(
              `Rule "${id}" has no option "${key}".${known.length ? ` Options: ${known.join(', ')}.` : ' It takes no options.'}`,
            );
          }
        }
        optionLayers.set(id, { ...(optionLayers.get(id) ?? {}), ...options });
      }
      if (level === 'off') rules.delete(id);
      else rules.set(id, { level: level as Severity, options: {} });
    }
  }
  for (const [id, r] of rules) {
    r.options = { ...rulesById[id as RuleId].defaultOptions, ...(optionLayers.get(id) ?? {}) };
  }

  return {
    rules,
    ignore: (c.ignore ?? []).map(globToRegExp),
    screenIgnore: (c.screens?.ignore ?? []).map(globToRegExp),
    failOn: c.failOn ?? 'error',
    capture: { delayMs: c.capture?.delayMs ?? 800, pollMs: c.capture?.pollMs ?? 1000 },
    resolved: true,
  };
}

/** Minimal glob: `**` any path, `*` any segment chars, `?` one char. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]!;
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        const slash = glob[i + 2] === '/';
        re += slash ? '(?:.*/)?' : '.*';
        i += slash ? 2 : 1;
      } else re += '[^/]*';
    } else if (ch === '?') re += '[^/]';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}
