// Builds the single `v6y` package from the workspace packages' dist/ output:
// copies them under dist/<name>/, rewrites @v6y/* imports to relative paths
// (so one install has no other v6y dependencies), and renames the
// user-facing specifiers to their public `v6y/...` names.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const pkgDir = path.resolve(here, '..');
const packages = path.resolve(pkgDir, '..');
const dist = path.join(pkgDir, 'dist');

const PARTS = { core: 'core', 'babel-plugin': 'babel-plugin', 'react-native': 'react-native', cli: 'cli', metro: 'metro' };
// Specifiers apps must resolve themselves (Metro intercepts project-config).
const PUBLIC = {
  '@v6y/react-native/project-config': 'v6y/project-config',
  '@v6y/react-native/auto': 'v6y/auto',
};
// Names that appear in user-facing text (messages, templates, comments).
const TEXT = {
  '@v6y/react-native': 'v6y/react-native',
  '@v6y/babel-plugin': 'v6y/babel',
  '@v6y/metro': 'v6y/metro',
  '@v6y/cli': 'v6y',
  '@v6y/core': 'v6y',
};

fs.rmSync(dist, { recursive: true, force: true });
for (const [name, dir] of Object.entries(PARTS)) {
  const src = path.join(packages, name, 'dist');
  if (!fs.existsSync(src)) throw new Error(`missing ${src}: run the workspace build first`);
  fs.cpSync(src, path.join(dist, dir), { recursive: true, filter: (f) => !f.endsWith('.tsbuildinfo') });
}

const rel = (fromFile, part, dts) => {
  let r = path.relative(path.dirname(fromFile), path.join(dist, part, dts ? 'index' : 'index.js'));
  if (!r.startsWith('.')) r = './' + r;
  return r;
};

let rewritten = 0;
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(js|d\.ts)$/.test(entry.name)) {
      const dts = entry.name.endsWith('.d.ts');
      let s = fs.readFileSync(file, 'utf8');
      const before = s;
      for (const [from, to] of Object.entries(PUBLIC)) s = s.split(from).join(to);
      // Module specifiers in require(), require.resolve(), import/export ... from, import().
      s = s.replace(/((?:require(?:\.resolve)?\(|from\s|import\()\s*)(['"])@v6y\/([a-z-]+)\2/g, (m, pre, q, part) => {
        if (!PARTS[part]) throw new Error(`${file}: unknown internal package @v6y/${part}`);
        return `${pre}${q}${rel(file, PARTS[part], dts)}${q}`;
      });
      for (const [from, to] of Object.entries(TEXT)) s = s.split(from).join(to);
      if (s !== before) {
        fs.writeFileSync(file, s);
        rewritten++;
      }
    }
  }
};
walk(dist);

// Some modules read their own version from ../package.json.
const { version } = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
fs.writeFileSync(path.join(dist, 'package.json'), JSON.stringify({ version }, null, 2) + '\n');
for (const f of ['bin.js']) fs.chmodSync(path.join(dist, 'cli', f), 0o755);

const leftover = [];
const scan = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) scan(f);
    else if (fs.readFileSync(f, 'utf8').includes('@v6y/')) leftover.push(path.relative(pkgDir, f));
  }
};
scan(dist);
if (leftover.length) throw new Error(`@v6y/ references left in: ${leftover.join(', ')}`);
// npm shows the package README; use the repository's.
fs.copyFileSync(path.join(packages, '..', 'README.md'), path.join(pkgDir, 'README.md'));
console.log(`v6y bundle: ${rewritten} files rewritten into ${path.relative(process.cwd(), dist)}`);
