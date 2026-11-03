/** Rules about size, color and text scaling. */
import { RGBA, blend, contrastRatio, relativeLuminance, toHex } from '../color';
import { defineRule, describeNode, Finding } from '../rule';
import {
  effectiveBackground,
  effectiveFontSize,
  effectiveFontWeight,
  effectiveTextColor,
  isDisabled,
  hasSpeakableText,
  isText,
  speakableText,
} from '../tree';

export interface TouchTargetOptions {
  /** Hard minimum in pt/dp (WCAG 2.5.8 AA = 24). Smaller targets are reported at the rule's level. */
  minimum: number;
  /** Also warn below platform guidelines (Apple 44pt, Material 48dp). Default true. */
  platformGuidelines: boolean;
  ios: number;
  android: number;
}

export const touchTargetSize = defineRule<TouchTargetOptions>({
  meta: {
    id: 'touch-target-size',
    title: 'Touch targets must be large enough to hit reliably',
    wcag: ['2.5.8'],
    docs: `Small targets are hard to hit for people with tremors or limited dexterity. WCAG 2.2 AA requires at least 24×24; Apple recommends 44×44pt and Material 48×48dp (reported as warnings).

**Fix:** increase padding, or add \`hitSlop\` to enlarge the touchable area without changing the layout. v6y counts \`hitSlop\`.`,
  },
  defaultOptions: { minimum: 24, platformGuidelines: true, ios: 44, android: 48 },
  check(node, ctx, o) {
    if (!node.interactive || !node.frame) return [];
    if (node.frame.width <= 0 || node.frame.height <= 0) return []; // not laid out / off-screen
    const s = node.hitSlop ?? { top: 0, bottom: 0, left: 0, right: 0 };
    const w = Math.round(node.frame.width + s.left + s.right);
    const h = Math.round(node.frame.height + s.top + s.bottom);
    const platform = ctx.snapshot.platform;
    const guide = platform === 'android' ? o.android : o.ios;
    const size = `${w}×${h}`;
    if (w < o.minimum || h < o.minimum) {
      return [
        {
          message: `${describeNode(node)} touch target is ${size}, below the minimum of ${o.minimum}×${o.minimum}.`,
          fix: `Increase its size or add hitSlop so the target is at least ${guide}×${guide}.`,
        },
      ];
    }
    if (o.platformGuidelines && (w < guide || h < guide)) {
      return [
        {
          advisory: true,
          message: `${describeNode(node)} touch target is ${size}, below the ${platform === 'android' ? 'Material' : 'Apple HIG'} recommendation of ${guide}×${guide}.`,
          fix: `Add hitSlop (e.g. hitSlop={${Math.ceil((guide - Math.min(w, h)) / 2)}}) or increase padding.`,
        },
      ];
    }
    return [];
  },
});

// ---------------------------------------------------------------------------

const BOLD = new Set(['bold', '600', '700', '800', '900']);

/** Smallest change to `fg` (toward black or white) that reaches `target` contrast against `bg`. */
export function suggestTextColor(fg: RGBA, bg: RGBA, target: number): RGBA | undefined {
  const black = { r: 0, g: 0, b: 0, a: 1 };
  const white = { r: 255, g: 255, b: 255, a: 1 };
  const candidates: RGBA[] = [];
  for (const toward of [black, white]) {
    for (let t = 0.02; t <= 1.0001; t += 0.02) {
      const c = blend({ ...toward, a: t }, fg);
      if (contrastRatio(c, bg) >= target) {
        candidates.push(c);
        break;
      }
    }
  }
  const dist = (c: RGBA) => Math.abs(c.r - fg.r) + Math.abs(c.g - fg.g) + Math.abs(c.b - fg.b);
  return candidates.sort((a, b) => dist(a) - dist(b))[0];
}

export interface TextContrastOptions {
  /** "AA" = 4.5:1 (3:1 large text). "AAA" = 7:1 (4.5:1 large text). */
  level: 'AA' | 'AAA';
}

export const textContrast = defineRule<TextContrastOptions>({
  meta: {
    id: 'text-contrast',
    title: 'Text must have sufficient contrast against its background',
    wcag: ['1.4.3'],
    docs: `Low-contrast text is hard to read for people with low vision, and for everyone in sunlight. WCAG AA needs 4.5:1 for normal text and 3:1 for large text (24pt+, or 18.66pt+ bold).

v6y computes contrast from your styles, compositing translucent backgrounds. When it can't know a color (theme defaults, images, gradients), it skips the text rather than guessing.

**Fix:** use the suggested text or background color.`,
  },
  defaultOptions: { level: 'AA' },
  check(node, ctx, o) {
    if (!isText(node) || !speakableText(node.text)) return []; // icon glyphs aren't text (WCAG 1.4.11 covers icons)
    if (isDisabled(node, ctx.ancestors)) return []; // WCAG exempts inactive components
    const fgRaw = effectiveTextColor(node, ctx.ancestors);
    const bg = effectiveBackground(node, ctx.ancestors);
    if (!fgRaw || !bg) return [];
    const fg = fgRaw.a < 1 ? blend(fgRaw, bg) : fgRaw;
    const size = effectiveFontSize(node, ctx.ancestors);
    const bold = BOLD.has(effectiveFontWeight(node, ctx.ancestors) ?? '');
    const large = size >= 24 || (bold && size >= 18.66);
    const target = o.level === 'AAA' ? (large ? 4.5 : 7) : large ? 3 : 4.5;
    const ratio = contrastRatio(fg, bg);
    if (ratio >= target) return [];
    const shown = (Math.floor(ratio * 100) / 100).toFixed(2); // 4.4988 must not print as "4.50"
    // Offer both directions: a text color that works on this background, and a
    // background that works with this text color (often the right fix for buttons).
    const text = suggestTextColor(fg, bg, target);
    const textOption = text && `text color ${toHex(text)} (${contrastRatio(text, bg).toFixed(2)}:1)`;
    const back = isPlain(bg) ? undefined : suggestTextColor(bg, fg, target);
    const backOption = back && `background ${toHex(back)} (${contrastRatio(fg, back).toFixed(2)}:1)`;
    // White/black text on a colored surface (a button): changing the surface is usually the fix.
    const options = (isPlain(fg) ? [backOption, textOption] : [textOption, backOption]).filter(Boolean) as string[];
    const finding: Finding = {
      message: `Text "${truncate(speakableText(node.text))}" has contrast ${shown}:1 (${toHex(fg)} on ${toHex(bg)}); needs ${target}:1 for ${large ? 'large' : 'normal'} text.`,
      fix: options.length ? `Use ${options.join(', or ')}.` : undefined,
      wcag: o.level === 'AAA' ? ['1.4.6'] : undefined,
    };
    return [finding];
  },
});

/** Near-white or near-black and unsaturated: a page background or default text color. */
function isPlain(c: RGBA): boolean {
  const spread = Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
  const l = relativeLuminance(c);
  return spread < 16 && (l > 0.85 || l < 0.02);
}

function truncate(s: string, n = 40): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

// ---------------------------------------------------------------------------

export interface FontScalingOptions {
  /** Lowest acceptable maxFontSizeMultiplier. WCAG 1.4.4 means 200%, so 2. */
  minMultiplier: number;
}

export const fontScalingDisabled = defineRule<FontScalingOptions>({
  meta: {
    id: 'font-scaling-disabled',
    title: "Text must scale with the user's font size setting",
    wcag: ['1.4.4'],
    docs: `Many people raise their system text size. \`allowFontScaling={false}\` ignores that setting, and a low \`maxFontSizeMultiplier\` caps it. WCAG requires text to stay usable at 200%.

**Fix:** remove \`allowFontScaling={false}\`. If the layout breaks at large sizes, let it wrap or scroll, or use \`maxFontSizeMultiplier={2}\` or higher.`,
  },
  defaultOptions: { minMultiplier: 2 },
  check(node, _ctx, o) {
    // Icon fonts (e.g. @expo/vector-icons) disable scaling on purpose; icons aren't text.
    if (!isText(node) || !hasSpeakableText(node)) return [];
    if (node.allowFontScaling === false) {
      return [
        {
          message: `${describeNode(node)} sets allowFontScaling={false}, so it ignores the user's text size setting.`,
          fix: `Remove allowFontScaling={false}. If layout breaks at large sizes, fix the layout (wrap, scroll) or use maxFontSizeMultiplier={${o.minMultiplier}} or higher.`,
        },
      ];
    }
    const m = node.maxFontSizeMultiplier;
    if (m !== undefined && m > 0 && m < o.minMultiplier) {
      return [
        {
          message: `${describeNode(node)} caps font scaling at ${m}×; text must remain usable at ${o.minMultiplier * 100}%.`,
          fix: `Raise maxFontSizeMultiplier to at least ${o.minMultiplier}, or remove it.`,
        },
      ];
    }
    return [];
  },
});
