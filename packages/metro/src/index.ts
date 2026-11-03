/**
 * metro.config.js:
 *
 *   const { getDefaultConfig } = require('expo/metro-config');
 *   const { withV6y } = require('@v6y/metro');
 *   module.exports = withV6y(getDefaultConfig(__dirname));
 *
 * In development bundles this:
 *   1. adds @v6y/babel-plugin (file:line stamps, v6y-ignore comments) to app code;
 *   2. imports @v6y/react-native/auto at the top of the app's entry file, which
 *      wraps the root in <V6yProvider> and captures each screen as you navigate;
 *   3. bundles v6y.config.{ts,js} into the app so in-app audits use your rules;
 *   4. receives reports on the Metro server and prints them in the Metro terminal.
 * Production bundles are untouched.
 */
import fs from 'fs';
import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { findConfigFile, handleReport, loadConfig, readReport } from '@v6y/cli';

/* eslint-disable @typescript-eslint/no-explicit-any */
type MetroConfig = any;

export interface WithV6yOptions {
  /** Default true. Also disabled by the env var V6Y_DISABLE=1. */
  enabled?: boolean;
  /** Override the app entry file (absolute or relative to the project root). */
  entry?: string;
}

export const ENV = {
  upstream: 'V6Y_UPSTREAM_TRANSFORMER',
  root: 'V6Y_PROJECT_ROOT',
  entry: 'V6Y_ENTRY',
} as const;

export const REPORT_PATH = '/v6y/report';
export const PROJECT_CONFIG_MODULE = '@v6y/react-native/project-config';

const EXTS = ['', '.js', '.jsx', '.ts', '.tsx'];

function resolveFile(base: string): string | undefined {
  for (const ext of EXTS) {
    const f = base + ext;
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return fs.realpathSync(f);
  }
  return undefined;
}

/** The app's entry file: package.json "main" (e.g. expo-router/entry), else index.*, else expo/AppEntry. */
export function resolveEntry(projectRoot: string, override?: string): string | undefined {
  const tryModule = (spec: string) => {
    const local = resolveFile(path.resolve(projectRoot, spec));
    if (local) return local;
    try {
      return fs.realpathSync(require.resolve(spec, { paths: [projectRoot] }));
    } catch {
      return undefined;
    }
  };
  if (override) return tryModule(override);
  let main: string | undefined;
  try {
    main = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).main;
  } catch {
    // no package.json
  }
  if (main) return tryModule(main);
  return resolveFile(path.join(projectRoot, 'index')) ?? tryModule('expo/AppEntry');
}

function defaultTransformer(projectRoot: string): string {
  for (const spec of ['@expo/metro-config/babel-transformer', '@react-native/metro-babel-transformer', 'metro-react-native-babel-transformer']) {
    try {
      return require.resolve(spec, { paths: [projectRoot] });
    } catch {
      // try next
    }
  }
  throw new Error('[v6y] Could not find a Metro Babel transformer. Is this a React Native project?');
}

export function withV6y(config: MetroConfig, options: WithV6yOptions = {}): MetroConfig {
  if (options.enabled === false || process.env.V6Y_DISABLE === '1') return config;
  const projectRoot: string = config.projectRoot ?? process.cwd();

  // Transformer workers are separate processes; they inherit these.
  process.env[ENV.upstream] = config.transformer?.babelTransformerPath ?? defaultTransformer(projectRoot);
  process.env[ENV.root] = projectRoot;
  process.env[ENV.entry] = resolveEntry(projectRoot, options.entry) ?? '';
  if (!process.env[ENV.entry]) {
    console.warn("[v6y] Couldn't find your app's entry file; add `import '@v6y/react-native/auto'` to it, or pass withV6y(config, { entry }).");
  }

  const prevResolve = config.resolver?.resolveRequest;
  const prevEnhance = config.server?.enhanceMiddleware;

  return {
    ...config,
    transformer: {
      ...config.transformer,
      babelTransformerPath: require.resolve('./transformer'),
    },
    resolver: {
      ...config.resolver,
      resolveRequest(context: any, moduleName: string, platform: string | null) {
        if (moduleName === PROJECT_CONFIG_MODULE) {
          const file = findConfigFile(projectRoot);
          if (file) return { type: 'sourceFile', filePath: file };
        }
        return (prevResolve ?? context.resolveRequest)(context, moduleName, platform);
      },
    },
    server: {
      ...config.server,
      enhanceMiddleware(middleware: any, server: any) {
        const base = prevEnhance ? prevEnhance(middleware, server) : middleware;
        return (req: IncomingMessage, res: ServerResponse, next: (e?: unknown) => void) => {
          if (req.method === 'POST' && req.url?.split('?')[0] === REPORT_PATH) {
            void receive(req, res, projectRoot);
            return;
          }
          return base(req, res, next);
        };
      },
    },
  };
}

async function receive(req: IncomingMessage, res: ServerResponse, projectRoot: string) {
  try {
    const report = await readReport(req, await loadConfig(projectRoot));
    handleReport(report, { cwd: projectRoot });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ issues: report.issues.length }));
  } catch (e) {
    console.error(`[v6y] ${(e as Error).message}`);
    res.writeHead(400);
    res.end(String(e));
  }
}

module.exports = { withV6y, resolveEntry, ENV, REPORT_PATH, PROJECT_CONFIG_MODULE };
