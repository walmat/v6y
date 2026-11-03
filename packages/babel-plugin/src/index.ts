import type { ConfigAPI, NodePath, PluginObj, PluginPass, types as BabelTypes } from '@babel/core';
import path from 'path';

/** Prop the runtime reads. Value: "relative/file.tsx:line:column". */
export const SOURCE_PROP = '__v6y';
/** Prop carrying an inline ignore. Value: JSON {"rules": [...] | "*", "reason"?: string}. */
export const IGNORE_PROP = '__v6yIgnore';

const IGNORE_RE = /^\s*\*?\s*v6y-ignore(?:\s+([a-z0-9-]+(?:\s*,\s*[a-z0-9-]+)*))?\s*(?:--\s*([\s\S]*?))?\s*$/i;

/** Parses `v6y-ignore [rule, rule] [-- reason]`. */
export function parseIgnoreComment(text: string): { rules: string[] | '*'; reason?: string } | undefined {
  const m = IGNORE_RE.exec(text);
  if (!m) return undefined;
  const rules = m[1] ? m[1].split(',').map((r) => r.trim()) : '*';
  const reason = m[2]?.trim() || undefined;
  return reason ? { rules, reason } : { rules };
}

type Comments = readonly { value: string }[] | null | undefined;

function firstIgnore(...lists: Comments[]) {
  for (const list of lists) {
    for (const c of list ?? []) {
      const parsed = parseIgnoreComment(c.value);
      if (parsed) return parsed;
    }
  }
  return undefined;
}

/**
 * Finds a `v6y-ignore` comment that applies to a JSX element:
 *   {/* v6y-ignore missing-role -- decorative *\/}   (previous JSX child)
 *   // v6y-ignore                                    (line above the element or its return)
 */
function findIgnore(t: typeof BabelTypes, element: NodePath<BabelTypes.JSXElement>) {
  // 1. A JSX comment child right before this element.
  const parent = element.parentPath;
  if (parent && (parent.isJSXElement() || parent.isJSXFragment())) {
    const siblings = parent.node.children;
    let i = siblings.indexOf(element.node) - 1;
    while (i >= 0 && t.isJSXText(siblings[i]) && !(siblings[i] as BabelTypes.JSXText).value.trim()) i--;
    const prev = siblings[i];
    if (prev && t.isJSXExpressionContainer(prev) && t.isJSXEmptyExpression(prev.expression)) {
      const found = firstIgnore(prev.expression.innerComments, prev.expression.trailingComments);
      if (found) return found;
    }
  }
  // 2. A comment attached to the element, or to the statement that returns/assigns it.
  const own = firstIgnore(element.node.leadingComments);
  if (own) return own;
  let up: NodePath | null = element.parentPath;
  while (up && (up.isParenthesizedExpression() || up.isConditionalExpression() || up.isLogicalExpression())) up = up.parentPath;
  if (up && (up.isReturnStatement() || up.isVariableDeclarator() || up.isArrowFunctionExpression() || up.isExpressionStatement())) {
    const stmt = up.isVariableDeclarator() ? up.parentPath : up;
    return firstIgnore(stmt?.node.leadingComments);
  }
  return undefined;
}

export interface V6yBabelOptions {
  /** Force on/off. Default: on unless the Babel env is "production". */
  enabled?: boolean;
  /** Project root used to make paths relative. Default: Babel's root / cwd. */
  root?: string;
  /** Also stamp files under node_modules. Default false. */
  includeNodeModules?: boolean;
}

// Fragments reject unknown props with a warning, so never stamp them.
const SKIP = new Set(['Fragment', 'React.Fragment']);

function elementName(t: typeof BabelTypes, name: BabelTypes.JSXOpeningElement['name']): string {
  if (t.isJSXIdentifier(name)) return name.name;
  if (t.isJSXMemberExpression(name)) return `${elementName(t, name.object)}.${name.property.name}`;
  return `${name.namespace.name}:${name.name.name}`;
}

export default function v6yBabelPlugin(api: ConfigAPI & { types: typeof BabelTypes }, options: V6yBabelOptions = {}): PluginObj<PluginPass> {
  const t = api.types;
  const enabled = options.enabled ?? !api.env('production');

  const stamp = (p: NodePath<BabelTypes.JSXOpeningElement>, state: PluginPass) => {
    const filename = state.file.opts.filename!;
    const node = p.node;
    const name = elementName(t, node.name);
    if (SKIP.has(name)) return;
    // Namespaced names (e.g. svg:rect) aren't React Native components.
    if (t.isJSXNamespacedName(node.name)) return;
    const already = node.attributes.some((a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name, { name: SOURCE_PROP }));
    if (already || !node.loc) return;

    const root = options.root ?? state.file.opts.root ?? state.cwd ?? process.cwd();
    const rel = path.relative(root, filename).split(path.sep).join('/');
    const value = `${rel}:${node.loc.start.line}:${node.loc.start.column + 1}`;
    node.attributes.push(t.jsxAttribute(t.jsxIdentifier(SOURCE_PROP), t.stringLiteral(value)));

    const element = p.parentPath;
    if (element.isJSXElement()) {
      const ignore = findIgnore(t, element);
      if (ignore) node.attributes.push(t.jsxAttribute(t.jsxIdentifier(IGNORE_PROP), t.stringLiteral(JSON.stringify(ignore))));
    }
  };

  return {
    name: 'v6y',
    visitor: {
      // Do the whole pass up front, at Program enter. Plugins that rewrite whole
      // components there (notably the React Compiler, on in Expo's templates) drop
      // JSX comments, so a normal JSXOpeningElement visitor would miss `v6y-ignore`.
      // Our Program.enter runs before theirs because `plugins` run before presets.
      Program(program: NodePath<BabelTypes.Program>, state: PluginPass) {
        if (!enabled) return;
        const filename = state.file.opts.filename;
        if (!filename) return;
        if (!options.includeNodeModules && filename.includes(`${path.sep}node_modules${path.sep}`)) return;
        program.traverse({ JSXOpeningElement: (p) => stamp(p, state) });
      },
    },
  };
}

// Allow `plugins: ['@v6y/babel-plugin']` from CommonJS Babel configs.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Object.assign(v6yBabelPlugin, { default: v6yBabelPlugin, SOURCE_PROP, IGNORE_PROP, parseIgnoreComment });
}
