import * as React from 'react';
import { Issue, ResolvedConfig, ScreenSnapshot, SnapshotReport, V6yConfig, auditScreen, groupIssues, resolveConfig } from '@v6y/core';
import { collect, CollectOptions, findCurrentRoot, focusedRouteName } from './collect';

export { collect, defaultMeasure, flattenStyle, focusedRouteName, parseSource } from './collect';
export type { CollectOptions, MeasureFn } from './collect';
export { defineConfig } from '@v6y/core';
export type { V6yConfig } from '@v6y/core';

/* eslint-disable @typescript-eslint/no-explicit-any */
declare const __DEV__: boolean | undefined;

/** Runtime-only settings (not part of v6y.config.ts). */
export interface RuntimeOptions {
  /** Default true in development, always false in production builds. */
  enabled?: boolean;
  /** Where to POST reports. Default: the Metro dev server (`withV6y`) at /v6y/report. */
  endpoint?: string;
  /** Log a summary to the console after each capture. Default true. */
  log?: boolean;
  /** Capture automatically when the focused screen changes. Default true. */
  autoCapture?: boolean;
  /** Send reports to the dev server. Default true; turn off in tests. */
  report?: boolean;
  collect?: CollectOptions;
}

export interface CaptureResult extends SnapshotReport {}

let projectConfig: V6yConfig = {};
let resolved: ResolvedConfig = resolveConfig();
let runtime: RuntimeOptions = {};
let rootOwner: { _reactInternals?: any; _reactInternalFiber?: any } | undefined;
let lastScreen: string | undefined;

const isDev = () => (typeof __DEV__ === 'undefined' ? process.env.NODE_ENV !== 'production' : __DEV__);
const enabled = () => isDev() && runtime.enabled !== false;

/** Sets the project config (normally done for you by `withV6y` from v6y.config.ts). */
export function configure(config: V6yConfig = {}, options: RuntimeOptions = {}) {
  projectConfig = config;
  runtime = { ...runtime, ...options };
  try {
    resolved = resolveConfig(config);
  } catch (e) {
    console.error(`[v6y] Invalid v6y.config: ${(e as Error).message}`);
    resolved = resolveConfig();
  }
}

export function getConfig(): V6yConfig {
  return projectConfig;
}

function rn(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native');
  } catch {
    return undefined;
  }
}

/** The Metro dev server's origin, taken from the bundle URL, so it works on simulators, emulators and LAN devices. */
export function devServerEndpoint(): string {
  if (runtime.endpoint) return runtime.endpoint;
  // Bridgeless (new architecture) only exposes it via getConstants(); the old bridge as a property.
  const sourceCode = rn()?.NativeModules?.SourceCode;
  const scriptURL: string | undefined = sourceCode?.getConstants?.()?.scriptURL ?? sourceCode?.scriptURL;
  const origin = scriptURL ? /^(https?:\/\/[^/]+)/.exec(scriptURL)?.[1] : undefined;
  return `${origin ?? 'http://localhost:8081'}/v6y/report`;
}

function currentRoot(): any {
  const fiber = rootOwner?._reactInternals ?? rootOwner?._reactInternalFiber;
  return fiber ? findCurrentRoot(fiber) : undefined;
}

/**
 * Wraps the app. With `withV6y` in metro.config.js this is installed
 * automatically; otherwise render it once near the root:
 *
 *   <V6yProvider config={config}><App /></V6yProvider>
 *
 * In production it renders children and does nothing else.
 */
export class V6yProvider extends React.Component<React.PropsWithChildren<RuntimeOptions & { config?: V6yConfig }>> {
  private timer?: ReturnType<typeof setInterval>;
  private pending?: ReturnType<typeof setTimeout>;

  componentDidMount() {
    if (!isDev()) return;
    const { children: _c, config, ...options } = this.props;
    if (config || Object.keys(options).length) configure(config ?? projectConfig, options);
    rootOwner = this as any;
    if (enabled() && runtime.autoCapture !== false) this.startWatching();
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    clearTimeout(this.pending);
    if (rootOwner === (this as any)) rootOwner = undefined;
  }

  /** Polls for the focused route; captures once it changes and settles. */
  private startWatching() {
    let pollsWithoutRoute = 0;
    const check = () => {
      const root = currentRoot();
      if (!root) return;
      const route = focusedRouteName(root);
      // Navigation mounts after the first render; give it a few polls before assuming there is none.
      if (!route && ++pollsWithoutRoute < 3) return;
      const name = route ?? 'App';
      if (name === lastScreen) return;
      lastScreen = name;
      clearTimeout(this.pending);
      this.pending = setTimeout(() => void capture(name), resolved.capture.delayMs);
    };
    check();
    this.timer = setInterval(check, resolved.capture.pollMs);
  }

  render() {
    return this.props.children ?? null;
  }
}

/** Snapshots the current screen, audits it, logs a summary and reports it to the dev server. */
export async function capture(screen?: string): Promise<CaptureResult | undefined> {
  if (!enabled()) return undefined;
  const root = currentRoot();
  if (!root) {
    console.warn('[v6y] capture() called before <V6yProvider> mounted. Add withV6y() to metro.config.js or render <V6yProvider>.');
    return undefined;
  }
  const name = screen ?? focusedRouteName(root) ?? 'App';
  const { root: tree } = await collect(root, { ...runtime.collect, hostTypes: resolved.hostTypes });

  const RN = rn();
  const win = RN?.Dimensions?.get?.('window');
  const os = RN?.Platform?.OS;
  const snapshot: ScreenSnapshot = {
    screen: name,
    platform: os === 'ios' || os === 'android' ? os : 'unknown',
    window: win ? { width: win.width, height: win.height, fontScale: win.fontScale ?? 1 } : undefined,
    capturedAt: new Date().toISOString(),
    root: tree,
  };
  const result = auditScreen(snapshot, resolved);
  if (result.skipped) {
    if (runtime.log !== false) console.log(`[v6y] ${name}: skipped (screens.ignore)`);
    return undefined;
  }
  const report: SnapshotReport = { snapshot, issues: result.issues, suppressed: result.suppressed };
  if (runtime.log !== false) logSummary(name, result.issues, result.suppressed.length);
  if (runtime.report !== false) void send(report);
  return report;
}

async function send(report: SnapshotReport) {
  try {
    await fetch(devServerEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
  } catch {
    // No dev server listening; the console summary is enough.
  }
}

function logSummary(screen: string, issues: Issue[], suppressed: number) {
  const note = suppressed ? ` (${suppressed} suppressed)` : '';
  if (!issues.length) {
    console.log(`[v6y] ${screen}: no issues ✓${note}`);
    return;
  }
  const errors = issues.filter((i) => i.severity === 'error').length;
  const groups = groupIssues(issues);
  const lines = groups.slice(0, 10).map(({ issue: i, count }) => {
    const loc = i.location ?? i.source;
    const at = loc ? ` (${loc.file}:${loc.line}${i.via ? ` via ${i.via.file}:${i.via.line}` : ''})` : '';
    return `  ${i.severity === 'error' ? '✖' : '⚠'}${count > 1 ? ` ×${count}` : ''} ${i.ruleId}: ${i.message}${at}`;
  });
  const more = groups.length > 10 ? `\n  …and ${groups.length - 10} more (see the Metro terminal)` : '';
  console.warn(`[v6y] ${screen}: ${errors} errors, ${issues.length - errors} warnings${note}\n${lines.join('\n')}${more}`);
}

/**
 * Optional: capture immediately on navigation instead of polling.
 *
 *   const ref = useNavigationContainerRef();
 *   useEffect(() => trackNavigation(ref), [ref]);
 */
export function trackNavigation(navigationRef: any): () => void {
  if (!enabled() || !navigationRef?.addListener) return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const onState = () => {
    const name: string | undefined = navigationRef.getCurrentRoute?.()?.name;
    if (!name || name === lastScreen) return;
    lastScreen = name;
    clearTimeout(timer);
    timer = setTimeout(() => void capture(name), resolved.capture.delayMs);
  };
  const unsubscribe = navigationRef.addListener('state', onState);
  if (navigationRef.isReady?.()) onState();
  return () => {
    clearTimeout(timer);
    unsubscribe?.();
  };
}
