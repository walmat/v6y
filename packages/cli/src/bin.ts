#!/usr/bin/env node
import { DEFAULT_PORT, check, dev, formatRules, init } from './index';

const HELP = `v6y — accessibility auditing for React Native

Usage:
  v6y init                              Create v6y.config.ts and show the Metro setup line
  v6y rules                             List rules, their WCAG criteria and preset levels
  v6y check <snapshot.json…> [--json]   Audit saved snapshots (.v6y/snapshots); exit 1 per failOn (for CI)
  v6y dev [--port ${DEFAULT_PORT}]        Standalone report server (only needed without withV6y)
  v6y help
`;

async function main(argv: string[]): Promise<number | undefined> {
  const [cmd, ...rest] = argv;
  const option = (name: string) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };

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
      const files = rest.filter((a) => !a.startsWith('--'));
      if (!files.length) {
        console.error('v6y check: pass one or more snapshot files, e.g. .v6y/snapshots/*.json');
        return 2;
      }
      return check(files, { json: rest.includes('--json') });
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
