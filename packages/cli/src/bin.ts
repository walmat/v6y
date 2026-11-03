#!/usr/bin/env node
import { DEFAULT_PORT, check, dev, formatRules, init } from './index';

const HELP = `v6y — accessibility auditing for React Native

Usage:
  v6y init                              Create v6y.config.ts and show the Metro setup line
  v6y rules                             List rules, their WCAG criteria and preset levels
  v6y check <snapshot.json…>            Audit saved snapshots (.v6y/snapshots); exit 1 per failOn (for CI)
      --changed                         Only issues in files changed since HEAD (uncommitted)
      --staged                          Only issues in staged files (pre-commit hook)
      --base <ref>                      Only issues in files changed since <ref> (e.g. origin/main)
      --format text|json|github         github: annotate the PR's lines in GitHub Actions
  v6y dev [--port ${DEFAULT_PORT}]        Standalone report server (only needed without withV6y)
  v6y help
`;

async function main(argv: string[]): Promise<number | undefined> {
  const [cmd, ...rest] = argv;
  const option = (name: string) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  // Positional arguments, skipping flags and the values of flags that take one.
  const WITH_VALUE = new Set(['--base', '--format', '--port']);
  const positional = rest.filter((a, i) => !a.startsWith('--') && !WITH_VALUE.has(rest[i - 1] ?? ''));

  switch (cmd) {
    case 'init':
      return init();
    case 'rules':
      console.log(formatRules());
      return 0;
    case 'dev':
      dev({ port: Number(option('--port') ?? DEFAULT_PORT) });
      return undefined; // keep running
    case 'check': {
      if (!positional.length) {
        console.error('v6y check: pass one or more snapshot files, e.g. .v6y/snapshots/*.json');
        return 2;
      }
      const base = option('--base');
      const staged = rest.includes('--staged');
      const format = (option('--format') ?? (rest.includes('--json') ? 'json' : 'text')) as 'text' | 'json' | 'github';
      if (!['text', 'json', 'github'].includes(format)) {
        console.error(`v6y check: --format must be text, json or github (got ${format})`);
        return 2;
      }
      const changed = rest.includes('--changed') || staged || base ? { base, staged } : undefined;
      return check(positional, { format, changed });
    }
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP);
      return 0;
    default:
      console.error(`Unknown command: ${cmd}\n\n${HELP}`);
      return 2;
  }
}

main(process.argv.slice(2)).then(
  (code) => {
    if (code !== undefined) process.exitCode = code;
  },
  (e) => {
    console.error(`v6y: ${(e as Error).message}`);
    process.exitCode = 2;
  },
);
