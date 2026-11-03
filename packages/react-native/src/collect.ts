/**
 * Walks a React fiber tree and converts host components into the v6y snapshot
 * format. Reads React internals (the same ones React DevTools uses), so keep it
 * defensive: unknown shapes must degrade to "less information", never crash.
 */
import type { A11yNode, A11yState, Frame, InlineIgnore, Insets, NodeStyle, SourceLocation } from '@v6y/core';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Fiber = any;

// React work tags (stable across React 17–19).
const FunctionComponent = 0;
const ClassComponent = 1;
const HostRoot = 3;
const HostComponent = 5;
const HostText = 6;
const ForwardRef = 11;
const MemoComponent = 14;
const SimpleMemoComponent = 15;
const HostHoistable = 26;
const HostSingleton = 27;

const SOURCE_PROP = '__v6y';
const IGNORE_PROP = '__v6yIgnore';
const MAX_OWNER_SOURCES = 5;

const SCROLL_TYPES = /ScrollView|ScrollContentView|RecyclerView/;
// 'Text' is the host name under React Native's Jest preset.
const TEXT_TYPES = new Set(['RCTText', 'RCTVirtualText', 'Text']);

export type MeasureFn = (stateNode: unknown, node: A11yNode) => Promise<Frame | undefined>;

export interface CollectOptions {
  /** How to measure host views. Defaults to measureInWindow (Paper and Fabric). */
  measure?: MeasureFn;
  /** Measure only interactive nodes (the only ones current rules need). Default true. */
  measureInteractiveOnly?: boolean;
}

interface Composite {
  name?: string;
  source?: SourceLocation;
  raw?: string;
}

export function parseSource(value: unknown): SourceLocation | undefined {
  if (typeof value !== 'string') return undefined;
  const m = /^(.*):(\d+):(\d+)$/.exec(value);
  if (!m) return undefined;
  return { file: m[1]!, line: Number(m[2]), column: Number(m[3]) };
}

function componentName(type: any): string | undefined {
  if (!type) return undefined;
  if (typeof type === 'string') return type;
  if (type.displayName) return type.displayName;
  if (type.name) return type.name;
  if (type.render) return type.render.displayName || type.render.name || undefined; // forwardRef
  if (type.type) return componentName(type.type); // memo
  return undefined;
}

export function flattenStyle(style: any): Record<string, any> {
  if (!style) return {};
  if (Array.isArray(style)) return style.reduce((acc, s) => Object.assign(acc, flattenStyle(s)), {});
  if (typeof style === 'object') return style;
  return {};
}

function pickStyle(flat: Record<string, any>): NodeStyle | undefined {
  const s: NodeStyle = {};
  if (typeof flat.color === 'string' || typeof flat.color === 'number') s.color = String(flat.color);
  if (typeof flat.backgroundColor === 'string' || typeof flat.backgroundColor === 'number')
    s.backgroundColor = String(flat.backgroundColor);
  if (typeof flat.fontSize === 'number') s.fontSize = flat.fontSize;
  if (flat.fontWeight !== undefined) s.fontWeight = String(flat.fontWeight);
  if (typeof flat.opacity === 'number') s.opacity = flat.opacity;
  return Object.keys(s).length ? s : undefined;
}

function toInsets(v: any): Insets | undefined {
  if (typeof v === 'number') return { top: v, bottom: v, left: v, right: v };
  if (v && typeof v === 'object')
    return { top: v.top ?? 0, bottom: v.bottom ?? 0, left: v.left ?? 0, right: v.right ?? 0 };
  return undefined;
}

function readState(p: any): A11yState | undefined {
  const s: A11yState = { ...(p.accessibilityState ?? {}) };
  if (p['aria-disabled'] !== undefined) s.disabled = !!p['aria-disabled'];
  if (p['aria-selected'] !== undefined) s.selected = !!p['aria-selected'];
  if (p['aria-checked'] !== undefined) s.checked = p['aria-checked'];
  if (p['aria-expanded'] !== undefined) s.expanded = !!p['aria-expanded'];
  if (p['aria-busy'] !== undefined) s.busy = !!p['aria-busy'];
  return Object.keys(s).length ? s : undefined;
}

function isHidden(type: string, p: any, flat: Record<string, any>): boolean {
  if (p.accessibilityElementsHidden === true) return true;
  if (p['aria-hidden'] === true) return true;
  if (p.importantForAccessibility === 'no-hide-descendants') return true;
  if (flat.display === 'none') return true;
  // react-native-screens keeps inactive stack screens mounted; 0 = inactive.
  if (type === 'RNSScreen' && p.activityState === 0) return true;
  return false;
}

function isInteractive(type: string, p: any): boolean {
  if (SCROLL_TYPES.test(type)) return false;
  return typeof p.onClick === 'function' || typeof p.onResponderRelease === 'function' || typeof p.onPress === 'function';
}

/** Finds the current HostRoot fiber starting from any fiber in the tree. */
export function findCurrentRoot(fiber: Fiber): Fiber | undefined {
  let f = fiber;
  while (f && f.tag !== HostRoot) f = f.return;
  return f?.stateNode?.current ?? f;
}

export interface Collected {
  root: A11yNode;
}

interface WalkContext {
  composites: Composite[];
  /** Inline ignores from enclosing elements; inherited by every host node below. */
  ignores: InlineIgnore[];
  /** Inside an unfocused navigation screen. */
  hidden: boolean;
}

function parseIgnore(raw: unknown, source?: SourceLocation): InlineIgnore | undefined {
  if (typeof raw !== 'string') return undefined;
  try {
    const v = JSON.parse(raw);
    if (v && (v.rules === '*' || Array.isArray(v.rules))) return { rules: v.rules, reason: v.reason, source };
  } catch {
    // malformed: ignore the ignore
  }
  return undefined;
}

/** React Navigation passes `navigation` + `route` to screens; unfocused screens stay mounted. */
function isUnfocusedScreen(props: any): boolean {
  const nav = props?.navigation;
  if (!props?.route || typeof nav?.isFocused !== 'function') return false;
  try {
    return nav.isFocused() === false;
  } catch {
    return false;
  }
}

/** Name of the deepest focused React Navigation / Expo Router route, if any. */
export function focusedRouteName(rootFiber: Fiber): string | undefined {
  let best: { depth: number; name: string } | undefined;
  const stack: Array<[Fiber, number]> = rootFiber?.child ? [[rootFiber.child, 0]] : [];
  while (stack.length) {
    const [f, depth] = stack.pop()!;
    const p = f.memoizedProps;
    if (typeof p?.route?.name === 'string' && typeof p?.navigation?.isFocused === 'function') {
      let focused = false;
      try {
        focused = p.navigation.isFocused();
      } catch {
        // ignore
      }
      if (!focused) {
        if (f.sibling) stack.push([f.sibling, depth]);
        continue; // nothing inside an unfocused screen can be the focused route
      }
      if (!best || depth >= best.depth) best = { depth, name: p.route.name };
    }
    if (f.sibling) stack.push([f.sibling, depth]);
    if (f.child) stack.push([f.child, depth + 1]);
  }
  return best?.name;
}

export async function collect(rootFiber: Fiber, options: CollectOptions = {}): Promise<Collected> {
  const measure = options.measure ?? defaultMeasure;
  const interactiveOnly = options.measureInteractiveOnly ?? true;
  let nextId = 0;

  const root: A11yNode = { id: String(nextId++), type: 'Root', children: [] };
  const toMeasure: Array<[unknown, A11yNode]> = [];

  const walk = (fiber: Fiber, parent: A11yNode, ctx: WalkContext) => {
    for (let f = fiber; f; f = f.sibling) visit(f, parent, ctx);
  };

  const visit = (f: Fiber, parent: A11yNode, ctx: WalkContext) => {
    const { composites } = ctx;
    const tag = f.tag;
    const props = f.memoizedProps;

    if (tag === HostText) {
      if (typeof props === 'string' || typeof props === 'number') {
        parent.text = (parent.text ?? '') + String(props);
      }
      return;
    }

    if (tag === HostComponent || tag === HostHoistable || tag === HostSingleton) {
      const type = typeof f.type === 'string' ? f.type : componentName(f.type) ?? 'Unknown';
      const p = props ?? {};
      const flat = flattenStyle(p.style);

      // The user-facing component is the innermost composite that was written in app code (stamped).
      const stamped = composites.filter((c) => c.source).reverse();
      const node: A11yNode = {
        id: String(nextId++),
        type,
        component: stamped[0]?.name ?? composites[composites.length - 1]?.name,
        children: [],
      };
      const role = p.accessibilityRole ?? p.role;
      if (role && role !== 'none') node.role = String(role);
      const label = p.accessibilityLabel ?? p['aria-label'];
      if (typeof label === 'string') node.label = label;
      if (typeof p.accessibilityHint === 'string') node.hint = p.accessibilityHint;
      const state = readState(p);
      if (state) node.state = state;
      const accessible = p.accessible ?? p.focusable;
      if (typeof accessible === 'boolean') node.accessible = accessible;
      if (ctx.hidden || isHidden(type, p, flat)) node.hidden = true;
      if (isInteractive(type, p)) node.interactive = true;
      const hitSlop = toInsets(p.hitSlop);
      if (hitSlop) node.hitSlop = hitSlop;
      const style = pickStyle(flat);
      if (style) node.style = style;
      if (typeof p.placeholder === 'string') node.placeholder = p.placeholder;
      const labelledBy = p.accessibilityLabelledBy ?? p['aria-labelledby'];
      if (typeof labelledBy === 'string' || (Array.isArray(labelledBy) && labelledBy.length)) node.labelledBy = String(labelledBy);
      if (TEXT_TYPES.has(type)) {
        if (typeof p.allowFontScaling === 'boolean') node.allowFontScaling = p.allowFontScaling;
        if (typeof p.maxFontSizeMultiplier === 'number') node.maxFontSizeMultiplier = p.maxFontSizeMultiplier;
      }
      const ownRaw = p[SOURCE_PROP];
      const own = ownRaw !== undefined && ownRaw !== stamped[0]?.raw ? parseSource(ownRaw) : undefined;
      const sources = (own ? [own] : []).concat(stamped.map((c) => c.source!));
      if (sources.length) {
        node.source = sources[0];
        if (sources.length > 1) node.ownerSources = sources.slice(1, 1 + MAX_OWNER_SOURCES);
      }

      const ownIgnore = parseIgnore(p[IGNORE_PROP], node.source);
      const ignores = ownIgnore ? ctx.ignores.concat(ownIgnore) : ctx.ignores;
      if (ignores.length) node.ignore = ignores;

      parent.children.push(node);
      if (!node.hidden && (!interactiveOnly || node.interactive)) toMeasure.push([f.stateNode, node]);
      // A host element starts a fresh composite context for its children.
      walk(f.child, node, { composites: [], ignores, hidden: ctx.hidden });
      return;
    }

    let next = ctx;
    if (
      tag === FunctionComponent ||
      tag === ClassComponent ||
      tag === ForwardRef ||
      tag === MemoComponent ||
      tag === SimpleMemoComponent
    ) {
      // Components that spread {...props} forward the stamp to their children. Only the
      // first component carrying a given stamp is the one written at that call site.
      const raw = props?.[SOURCE_PROP];
      const lastStamped = [...composites].reverse().find((c) => c.raw);
      const forwarded = raw !== undefined && lastStamped?.raw === raw;
      const source = forwarded ? undefined : parseSource(raw);
      const ignore = forwarded ? undefined : parseIgnore(props?.[IGNORE_PROP], source);
      next = {
        composites: composites.concat({ name: componentName(f.type), source, raw: forwarded ? undefined : raw }),
        ignores: ignore ? ctx.ignores.concat(ignore) : ctx.ignores,
        hidden: ctx.hidden || isUnfocusedScreen(props),
      };
    }
    walk(f.child, parent, next);
  };

  walk(rootFiber.child, root, { composites: [], ignores: [], hidden: false });

  await Promise.all(
    toMeasure.map(async ([stateNode, node]) => {
      try {
        const frame = await measure(stateNode, node);
        if (frame) node.frame = frame;
      } catch {
        // Unmeasurable nodes simply have no frame.
      }
    }),
  );

  return { root };
}

/** measureInWindow across the old (Paper) and new (Fabric) architectures. */
export function defaultMeasure(stateNode: any): Promise<Frame | undefined> {
  return new Promise((resolve) => {
    const done = (x: number, y: number, width: number, height: number) => resolve({ x, y, width, height });
    const timer = setTimeout(() => resolve(undefined), 500);
    const finish = (x: number, y: number, w: number, h: number) => {
      clearTimeout(timer);
      done(x, y, w, h);
    };
    try {
      if (!stateNode) return resolve(undefined);
      if (typeof stateNode.measureInWindow === 'function') return stateNode.measureInWindow(finish);
      const canonical = stateNode.canonical;
      const pub = canonical?.publicInstance;
      if (pub && typeof pub.measureInWindow === 'function') return pub.measureInWindow(finish);
      const fabric = (globalThis as any).nativeFabricUIManager;
      if (stateNode.node && fabric?.measureInWindow) return fabric.measureInWindow(stateNode.node, finish);
      resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}
