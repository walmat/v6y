// Writes docs/rules/*.md from the rules (run after `npm run build`).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const { renderRuleDocs } = createRequire(import.meta.url)(path.join(root, 'packages/core/dist/index.js'));
const dir = path.join(root, 'docs/rules');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const files = renderRuleDocs();
for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content);
console.log(`docs: wrote ${Object.keys(files).length} files to docs/rules`);
