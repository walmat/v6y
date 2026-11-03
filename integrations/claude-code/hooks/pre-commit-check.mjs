// PreToolUse hook: before Claude runs `git commit`, check the staged files with
// v6y. Blocks (exit 2, reason on stderr for Claude) only when there are errors;
// does nothing in projects without v6y or without snapshots.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

let input = '';
for await (const chunk of process.stdin) input += chunk;
let event;
try {
  event = JSON.parse(input);
} catch {
  process.exit(0);
}

const command = event?.tool_input?.command ?? '';
if (!/(^|[;&|\s(])git\s+(-[^\s]+\s+)*commit(\s|$)/.test(command)) process.exit(0);

const cwd = event.cwd || process.env.CLAUDE_PROJECT_DIR || process.cwd();
const bin = path.join(cwd, 'node_modules', '.bin', 'v6y');
const snapshotDir = path.join(cwd, '.v6y', 'snapshots');
if (!fs.existsSync(bin) || !fs.existsSync(snapshotDir)) process.exit(0);
const snapshots = fs.readdirSync(snapshotDir).filter((f) => f.endsWith('.json')).map((f) => path.join(snapshotDir, f));
if (!snapshots.length) process.exit(0);

const result = spawnSync(bin, ['check', ...snapshots, '--staged'], { cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
if (result.status === 1) {
  process.stderr.write(
    `v6y found accessibility errors in the staged files. Fix them before committing (call the check_accessibility tool or see the docs links below). ` +
      `If a snapshot is stale, re-run the tests with V6Y_SNAPSHOTS=.v6y/snapshots first.\n\n${result.stdout}`,
  );
  process.exit(2);
}
process.exit(0);
