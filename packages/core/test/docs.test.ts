import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { allRules, renderRuleDocs, RULE_EXAMPLES, OPTION_DOCS } from '@v6y/core';

const dir = path.resolve(import.meta.dirname, '../../../docs/rules');

describe('rule docs', () => {
  it('every rule has a before/after example and documented options', () => {
    for (const r of allRules) {
      expect(RULE_EXAMPLES[r.meta.id], r.meta.id).toBeDefined();
      for (const opt of Object.keys(r.defaultOptions)) expect(OPTION_DOCS[r.meta.id]?.[opt], `${r.meta.id}.${opt}`).toBeTruthy();
    }
  });

  it('docs/rules is up to date with the rules (run `npm run docs`)', () => {
    const expected = renderRuleDocs();
    const actual = Object.fromEntries(fs.readdirSync(dir).map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
    for (const [f, content] of Object.entries(expected)) expect(actual[f], f).toBe(content);
  });
});
