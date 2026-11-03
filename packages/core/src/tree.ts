import { A11yNode } from './types';
import { RGBA, blend, parseColor } from './color';

const TEXT_TYPES = new Set(['RCTText', 'RCTVirtualText', 'AndroidText', 'Text', 'RNUITextView', 'RNUITextViewChild']);
const INPUT_TYPES = /TextInput|TextField|RCTMultilineTextInputView|RCTSinglelineTextInputView/;
const SWITCH_TYPES = /Switch/;
const SLIDER_TYPES = /Slider/;

const IMAGE_TYPES = /Image|FastImage|RNSVGSvgView|ExpoImage/;

export function isText(node: A11yNode): boolean {
  return node.kind ? node.kind === 'text' : TEXT_TYPES.has(node.type);
}

export function isTextInput(node: A11yNode): boolean {
  return node.kind ? node.kind === 'input' : INPUT_TYPES.test(node.type);
}

export function isImage(node: A11yNode): boolean {
  if (node.role === 'image' || node.role === 'img') return true;
  return node.kind ? node.kind === 'image' : IMAGE_TYPES.test(node.type);
}

/** Native controls that carry their own role and name semantics. */
export function hasIntrinsicRole(node: A11yNode): boolean {
  return isTextInput(node) || SWITCH_TYPES.test(node.type) || SLIDER_TYPES.test(node.type);
}

// Icon fonts (Ionicons, MaterialIcons, FontAwesome, …) draw glyphs from the
// Unicode Private Use Areas. Screen readers can't pronounce them.
const PRIVATE_USE = /[\uE000-\uF8FF]|[\uDB80-\uDBFF][\uDC00-\uDFFF]/g;

/** Text a screen reader can actually speak: icon-font glyphs removed. */
export function speakableText(text: string | undefined): string {
  return (text ?? '').replace(PRIVATE_USE, '').trim();
}

/** True when a node or its descendants contain text a screen reader would speak (not just icon glyphs). */
export function hasSpeakableText(node: A11yNode): boolean {
  return !!speakableText(node.text) || node.children.some(hasSpeakableText);
}

/**
 * The name a screen reader announces for a node: its explicit label, otherwise
 * the text and labels of its (non-hidden) descendants, merged in order.
 */
export function accessibleName(node: A11yNode): string {
  if (node.hidden) return '';
  if (node.label && node.label.trim()) return node.label.trim();
  const parts: string[] = [];
  const text = speakableText(node.text);
  if (text) parts.push(text);
  for (const child of node.children) {
    const name = accessibleName(child);
    if (name) parts.push(name);
  }
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Effective background behind `node`: walks self + ancestors (innermost first),
 * compositing translucent layers until an opaque one is reached. Returns
 * undefined when no opaque background is known (we don't guess).
 */
export function effectiveBackground(node: A11yNode, ancestors: readonly A11yNode[]): RGBA | undefined {
  const chain = [node, ...[...ancestors].reverse()];
  const layers: RGBA[] = [];
  for (const n of chain) {
    const c = parseColor(n.style?.backgroundColor);
    if (!c || c.a === 0) continue;
    layers.push(c);
    if (c.a >= 1) break;
  }
  const base = layers[layers.length - 1];
  if (!base || base.a < 1) return undefined;
  let result = base;
  for (let i = layers.length - 2; i >= 0; i--) result = blend(layers[i]!, result);
  return result;
}

/** Text color in effect for a text node (inherits through nested Text). */
export function effectiveTextColor(node: A11yNode, ancestors: readonly A11yNode[]): RGBA | undefined {
  if (node.style?.color !== undefined) return parseColor(node.style.color);
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const a = ancestors[i]!;
    if (!isText(a)) break;
    if (a.style?.color !== undefined) return parseColor(a.style.color);
  }
  return undefined;
}

export function effectiveFontSize(node: A11yNode, ancestors: readonly A11yNode[]): number {
  if (node.style?.fontSize) return node.style.fontSize;
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const a = ancestors[i]!;
    if (!isText(a)) break;
    if (a.style?.fontSize) return a.style.fontSize;
  }
  return 14; // React Native default
}

export function effectiveFontWeight(node: A11yNode, ancestors: readonly A11yNode[]): string | undefined {
  if (node.style?.fontWeight) return String(node.style.fontWeight);
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const a = ancestors[i]!;
    if (!isText(a)) break;
    if (a.style?.fontWeight) return String(a.style.fontWeight);
  }
  return undefined;
}

export function isDisabled(node: A11yNode, ancestors: readonly A11yNode[]): boolean {
  return !!node.state?.disabled || ancestors.some((a) => a.state?.disabled);
}
