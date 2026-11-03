/**
 * Metro Babel transformer installed by `withV6y`. Wraps the project's original
 * transformer (Expo's or React Native's) and, in development builds only:
 * - adds @v6y/babel-plugin to app code (not node_modules);
 * - imports @v6y/react-native/auto at the top of the entry file.
 */
import fs from 'fs';
import path from 'path';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
const UPSTREAM = process.env.V6Y_UPSTREAM_TRANSFORMER;
const ROOT = process.env.V6Y_PROJECT_ROOT ?? process.cwd();
const ENTRY = process.env.V6Y_ENTRY || undefined;

if (!UPSTREAM) {
  throw new Error('[v6y] V6Y_UPSTREAM_TRANSFORMER is not set. Use withV6y() in metro.config.js instead of pointing at this file directly.');
}

const upstream = require(UPSTREAM);
const v6yPlugin = require('@v6y/babel-plugin');
const { version } = require('../package.json');

export const AUTO_IMPORT = "import '@v6y/react-native/auto';";

function realpath(p: string): string {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
}

export function transform(args: { filename: string; src: string; options: any; plugins?: any[] }) {
  const { filename, options } = args;
  if (!options?.dev) return upstream.transform(args);

  const root = options.projectRoot ?? ROOT;
  const abs = path.resolve(root, filename);
  let { src } = args;
  let plugins = args.plugins ?? [];

  if (!abs.includes(`${path.sep}node_modules${path.sep}`)) {
    plugins = [...plugins, [v6yPlugin, { root, enabled: true }]];
  }
  if (ENTRY && realpath(abs) === ENTRY) {
    // Same line as the original first line, so line numbers don't shift.
    src = `${AUTO_IMPORT} ${src}`;
  }
  return upstream.transform({ ...args, src, plugins });
}

/** Changes whenever the Babel plugin's code changes, so Metro never serves stale stamps. */
function pluginHash(): string {
  try {
    const file = require.resolve('@v6y/babel-plugin');
    return require('crypto').createHash('sha1').update(fs.readFileSync(file)).digest('hex').slice(0, 12);
  } catch {
    return '';
  }
}

export function getCacheKey(...args: unknown[]): string {
  const base = typeof upstream.getCacheKey === 'function' ? upstream.getCacheKey(...args) : '';
  return [base, 'v6y', version, pluginHash(), ENTRY ?? ''].join('|');
}

module.exports = { ...upstream, transform, getCacheKey, AUTO_IMPORT };
