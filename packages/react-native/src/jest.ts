/**
 * Jest (and Vitest) integration:
 *
 *   // a Jest setup file (setupFilesAfterEnv)
 *   import 'v6y/jest';
 *
 *   await expect(render(<Checkout />)).toBeAccessible();   // React Native Testing Library
 *   await expect(<Checkout />).toBeAccessible();           // or an element
 *
 * Uses your v6y.config (found from the working directory), the same rules as
 * the app and CI, and frames from explicit sizes (tests have no layout engine).
 * For file:line in failures, add the Babel plugin to your test config:
 * `env: { test: { plugins: ['v6y/babel'] } }`.
 */
import * as React from 'react';
import fs from 'fs';
import path from 'path';
import { AuditResult, ScreenSnapshot, V6yConfig, auditScreen, resolveConfig, shouldFail } from '@v6y/core';
import { CONFIG_FILES, formatIssues } from '@v6y/cli';
import { collect, findCurrentRoot, measureFromStyle } from './collect';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */

export interface AccessibleOptions {
  /** Name used in the report. Default "Test screen". */
  screen?: string;
  /** Default: react-native's Platform.OS under your Jest preset. */
  platform?: 'ios' | 'android';
  /** Overrides or replaces v6y.config for this assertion. */
  config?: V6yConfig;
  /** Which severity fails the assertion. Default: config `failOn` ("error"). */
  failOn?: 'error' | 'warning';
}

export interface TestAudit extends AuditResult {
  snapshot: ScreenSnapshot;
}

let projectConfig: V6yConfig | undefined;

/** v6y.config from the working directory, loaded through Jest's own transform (so .ts works). */
function loadProjectConfig(): V6yConfig {
  if (projectConfig) return projectConfig;
  const file = CONFIG_FILES.map((f) => path.join(process.cwd(), f)).find((f) => fs.existsSync(f));
  if (!file) return (projectConfig = {});
  const mod = file.endsWith('.json') ? JSON.parse(fs.readFileSync(file, 'utf8')) : require(file);
  return (projectConfig = mod?.default ?? mod ?? {});
}

/** Finds a fiber in whatever the test rendered. */
function fiberOf(received: any): any {
  const candidates = [received?.UNSAFE_root, received?.root, received];
  for (const c of candidates) if (c?._fiber) return c._fiber;
  return undefined;
}

async function renderElement(element: React.ReactElement): Promise<{ fiber: any; unmount: () => void }> {
  const { act, create } = require('react-test-renderer');
  let renderer: any;
  await act(async () => {
    renderer = create(element);
  });
  return { fiber: renderer.root._fiber, unmount: () => act(() => renderer.unmount()) };
}

function platformOS(): 'ios' | 'android' | 'unknown' {
  try {
    const os = require('react-native').Platform?.OS;
    return os === 'ios' || os === 'android' ? os : 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Audits a render result (RNTL, react-test-renderer) or a React element. */
export async function auditRendered(received: unknown, options: AccessibleOptions = {}): Promise<TestAudit> {
  const config = options.config ?? loadProjectConfig();
  const resolved = resolveConfig(config);
  let fiber = fiberOf(received);
  let cleanup: (() => void) | undefined;
  if (!fiber && React.isValidElement(received)) {
    const r = await renderElement(received);
    fiber = r.fiber;
    cleanup = r.unmount;
  }
  if (!fiber) {
    throw new Error(
      'v6y: toBeAccessible() expects a React element, a React Native Testing Library render() result, or a react-test-renderer instance.',
    );
  }
  try {
    const { root } = await collect(findCurrentRoot(fiber), {
      measure: measureFromStyle,
      hostTypes: resolved.hostTypes,
      measureInteractiveOnly: true,
    });
    const snapshot: ScreenSnapshot = {
      screen: options.screen ?? 'Test screen',
      platform: options.platform ?? platformOS(),
      root,
    };
    return { ...auditScreen(snapshot, resolved), snapshot };
  } finally {
    cleanup?.();
  }
}

/**
 * With V6Y_SNAPSHOTS=<dir> set (e.g. in CI), every assertion also saves its
 * snapshot there, so `v6y check --changed` can report on the files a PR touched.
 */
function record(snapshot: ScreenSnapshot) {
  const dir = process.env.V6Y_SNAPSHOTS;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  const name = snapshot.screen.replace(/[^\w.-]+/g, '_').slice(0, 120);
  fs.writeFileSync(path.join(dir, `${name}.${snapshot.platform}.json`), JSON.stringify(snapshot, null, 2));
}

/** The matcher implementation (exported so other test runners can register it). */
export async function toBeAccessible(this: any, received: unknown, options: AccessibleOptions = {}) {
  const screen = options.screen ?? this?.currentTestName ?? undefined;
  const result = await auditRendered(received, { ...options, screen });
  result.snapshot.capturedAt = new Date().toISOString();
  record(result.snapshot);
  const failOn = options.failOn ?? resolveConfig(options.config ?? loadProjectConfig()).failOn;
  const pass = !shouldFail(result.issues, { failOn });
  const counted = result.issues.filter((i) => failOn === 'warning' || i.severity === 'error');
  return {
    pass,
    message: () =>
      pass
        ? `Expected accessibility issues, but v6y found none${result.issues.length ? ` at "${failOn}" level` : ''}.`
        : `v6y found ${counted.length} accessibility issue${counted.length === 1 ? '' : 's'}:\n${formatIssues(result.issues, {
            screenHeadings: false,
            locationWord: 'in',
          })}`,
  };
}

export const matchers = { toBeAccessible };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      /** Audits the rendered tree with v6y. Async: `await expect(x).toBeAccessible()`. */
      toBeAccessible(options?: AccessibleOptions): Promise<R>;
    }
  }
}

// Register automatically when imported from a Jest/Vitest setup file.
const globalExpect = (globalThis as any).expect;
if (globalExpect?.extend) globalExpect.extend(matchers);
