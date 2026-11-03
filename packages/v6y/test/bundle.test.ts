/** Guards the published `v6y` package (built by `npm run build`, which `npm test` runs first). */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const pkg = path.resolve(import.meta.dirname, '..');
const req = createRequire(import.meta.url);

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}

describe('the v6y package', () => {
  it('has no references to internal @v6y/* packages', () => {
    const leftovers = files(path.join(pkg, 'dist')).filter((f) => fs.readFileSync(f, 'utf8').includes('@v6y/'));
    expect(leftovers).toEqual([]);
  });

  it('exposes every entry point', () => {
    expect(typeof req(pkg).defineConfig).toBe('function');
    expect(req(pkg).allRules.length).toBeGreaterThan(10);
    expect(typeof req(path.join(pkg, 'metro.js')).withV6y).toBe('function');
    expect(typeof req(path.join(pkg, 'babel.js'))).toBe('function');
    expect(req(path.join(pkg, 'project-config.js'))).toEqual({});
  });

  it('uses public names wherever apps or users see them', () => {
    const metro = req(path.join(pkg, 'metro.js'));
    expect(metro.PROJECT_CONFIG_MODULE).toBe('v6y/project-config');
    const transformer = fs.readFileSync(path.join(pkg, 'dist/metro/transformer.js'), 'utf8');
    expect(transformer).toContain(`"import 'v6y/auto';"`);
    const cli = fs.readFileSync(path.join(pkg, 'dist/cli/index.js'), 'utf8');
    expect(cli).toContain("const CONFIG_PACKAGE = 'v6y';");
    expect(cli).toContain("const METRO_PACKAGE = 'v6y/metro';");
  });

  it('ships an executable CLI', () => {
    const bin = path.join(pkg, 'dist/cli/bin.js');
    expect(fs.readFileSync(bin, 'utf8').startsWith('#!/usr/bin/env node')).toBe(true);
    expect(fs.statSync(bin).mode & 0o111).not.toBe(0);
  });
});
