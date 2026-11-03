/**
 * `v6y mcp`: a Model Context Protocol server (stdio, newline-delimited JSON-RPC)
 * so coding agents (Claude Code, Codex, Cursor, …) can check the screens they
 * edit. No dependencies; stdout carries only protocol messages.
 */
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { allRules, globToRegExp, renderRuleDoc, rulesById, RuleId } from '@v6y/core';
import { analyze, formatRules, renderAnalysis } from './index';

export const DEFAULT_SNAPSHOTS = '.v6y/snapshots/*.json';

const INSTRUCTIONS = `v6y checks React Native screens for accessibility issues: missing labels and roles, unexposed state, low contrast, small touch targets, disabled font scaling and more.

After you change a screen or component:
1. Refresh snapshots: run the project's tests with V6Y_SNAPSHOTS=.v6y/snapshots (tests that call expect(...).toBeAccessible() record them), or, if the app is running with withV6y(), open the screen.
2. Call check_accessibility. By default it reports only issues in files you changed, each with file:line, a suggested fix and a docs link.
3. Fix the issues and check again. Use explain_rule for background on a rule.

Never silence an issue with a v6y-ignore comment unless the element is genuinely not user-facing, and always give the reason after "--".`;

const TOOLS = [
  {
    name: 'check_accessibility',
    description:
      'Check React Native screens for accessibility issues. By default reports only issues in files changed in the working tree, each with file:line, a fix and a docs link. Reads snapshots recorded by tests (V6Y_SNAPSHOTS) or the running app; warns when a snapshot is older than your edits.',
    inputSchema: {
      type: 'object',
      properties: {
        changedOnly: { type: 'boolean', description: 'Only issues in changed files (default true).', default: true },
        base: { type: 'string', description: 'Compare against this git ref instead of uncommitted changes, e.g. "origin/main".' },
        staged: { type: 'boolean', description: 'Only staged changes (like a pre-commit hook).' },
        snapshots: { type: 'string', description: `Glob of snapshot files (default "${DEFAULT_SNAPSHOTS}").` },
        projectDir: { type: 'string', description: 'The React Native project directory, if it is not the current one.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'explain_rule',
    description: 'Explain a v6y rule: why it matters, how to fix it, before/after code, options and how to configure or silence it.',
    inputSchema: {
      type: 'object',
      properties: { rule: { type: 'string', enum: allRules.map((r) => r.meta.id), description: 'Rule id, e.g. "missing-label".' } },
      required: ['rule'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_rules',
    description: 'List every v6y rule with its level in each preset and the WCAG criteria it covers.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
];

/** Expands a snapshot glob relative to cwd (supports *, ? and **). */
export function expandGlob(pattern: string, cwd: string): string[] {
  const abs = path.isAbsolute(pattern) ? pattern : path.join(cwd, pattern);
  const parts = abs.split(path.sep);
  const firstWild = parts.findIndex((p) => /[*?]/.test(p));
  if (firstWild < 0) return fs.existsSync(abs) ? [abs] : [];
  const base = parts.slice(0, firstWild).join(path.sep) || path.sep;
  const re = globToRegExp(parts.slice(firstWild).join('/'));
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = path.relative(base, full).split(path.sep).join('/');
      if (e.isDirectory()) walk(full);
      else if (re.test(rel)) out.push(full);
    }
  };
  walk(base);
  return out.sort();
}

interface ToolResult {
  content: { type: 'text'; text: string }[];
  structuredContent?: unknown;
  isError?: boolean;
}

const text = (t: string, isError = false): ToolResult => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError } : {}) });

export async function callTool(name: string, args: Record<string, unknown> = {}, cwd = process.cwd()): Promise<ToolResult> {
  switch (name) {
    case 'check_accessibility': {
      if (typeof args.projectDir === 'string' && args.projectDir) cwd = path.resolve(cwd, args.projectDir);
      const pattern = typeof args.snapshots === 'string' ? args.snapshots : DEFAULT_SNAPSHOTS;
      const files = expandGlob(pattern, cwd);
      if (!files.length) {
        return text(
          `No v6y snapshots match ${pattern}. Record some first: run the tests with V6Y_SNAPSHOTS=.v6y/snapshots (tests that call expect(...).toBeAccessible()), or open the screens in the app running with withV6y().`,
        );
      }
      const changedOnly = args.changedOnly !== false;
      const changed =
        changedOnly || args.base || args.staged
          ? { base: typeof args.base === 'string' ? args.base : undefined, staged: args.staged === true }
          : undefined;
      const a = await analyze(files, { cwd, changed });
      const summary = a.failed ? 'FAIL: fix the errors below.' : a.issues.length ? 'PASS with warnings.' : 'PASS: no issues.';
      return {
        content: [{ type: 'text', text: `${summary}\n\n${renderAnalysis(a)}` }],
        structuredContent: {
          failed: a.failed,
          issues: a.issues.map((i) => ({
            rule: i.ruleId,
            severity: i.severity,
            message: i.message,
            fix: i.fix,
            location: i.location ?? i.source,
            via: i.via,
            scope: i.scope,
            screen: i.screen,
          })),
          staleSnapshots: a.cover?.stale ?? [],
          uncoveredFiles: a.cover?.uncovered ?? [],
        },
      };
    }
    case 'explain_rule': {
      const rule = rulesById[args.rule as RuleId];
      if (!rule) return text(`Unknown rule "${String(args.rule)}". Known rules: ${allRules.map((r) => r.meta.id).join(', ')}.`, true);
      return text(renderRuleDoc(rule));
    }
    case 'list_rules':
      return text(formatRules());
    default:
      return text(`Unknown tool "${name}".`, true);
  }
}

type Message = { jsonrpc: '2.0'; id?: number | string; method?: string; params?: Record<string, unknown> };

/** Handles one JSON-RPC message; returns the response, or undefined for notifications. */
export async function handleMessage(msg: Message, cwd = process.cwd(), version = '0.0.0'): Promise<object | undefined> {
  const reply = (result: unknown) => ({ jsonrpc: '2.0', id: msg.id, result });
  const error = (code: number, message: string) => ({ jsonrpc: '2.0', id: msg.id, error: { code, message } });
  if (msg.id === undefined) return undefined; // notification (e.g. notifications/initialized)
  switch (msg.method) {
    case 'initialize':
      return reply({
        // Speak whatever version the client asked for; v6y only uses tools.
        protocolVersion: (msg.params?.protocolVersion as string) ?? '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'v6y', version },
        instructions: INSTRUCTIONS,
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS });
    case 'tools/call': {
      const name = msg.params?.name as string;
      try {
        return reply(await callTool(name, (msg.params?.arguments as Record<string, unknown>) ?? {}, cwd));
      } catch (e) {
        return reply(text(`v6y: ${(e as Error).message}`, true));
      }
    }
    default:
      return error(-32601, `Method not found: ${msg.method}`);
  }
}

/** Runs the server on stdin/stdout until stdin closes. */
export function serveMcp({ cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd(), version = '0.0.0' } = {}) {
  // Anything else that logs must not corrupt the protocol stream.
  console.log = console.error;
  const rl = readline.createInterface({ input: process.stdin });
  rl.on('line', async (line) => {
    if (!line.trim()) return;
    let msg: Message;
    try {
      msg = JSON.parse(line);
    } catch {
      process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) + '\n');
      return;
    }
    const res = await handleMessage(msg, cwd, version);
    if (res) process.stdout.write(JSON.stringify(res) + '\n');
  });
}
