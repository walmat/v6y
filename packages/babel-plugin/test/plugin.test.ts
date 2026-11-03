import { describe, expect, it } from 'vitest';
import { transformSync } from '@babel/core';
import path from 'path';
import plugin from '@v6y/babel-plugin';

const root = '/project';
function run(code: string, opts: Record<string, unknown> = {}, filename = path.join(root, 'src/App.tsx')) {
  return transformSync(code, {
    filename,
    root,
    babelrc: false,
    configFile: false,
    plugins: ['@babel/plugin-syntax-jsx', [plugin, opts]],
    presets: [['@babel/preset-typescript', { isTSX: true, allExtensions: true }]],
  })!.code!;
}

describe('@v6y/babel-plugin', () => {
  it('stamps elements with relative file:line:column', () => {
    const out = run(`const A = () => (\n  <View>\n    <Pressable onPress={go} />\n  </View>\n);`);
    expect(out).toContain('__v6y="src/App.tsx:2:3"');
    expect(out).toContain('__v6y="src/App.tsx:3:5"');
  });

  it('skips fragments', () => {
    const out = run(`const A = () => <React.Fragment><Fragment><Text /></Fragment></React.Fragment>;`);
    expect(out.match(/__v6y/g)).toHaveLength(1);
  });

  it('can be disabled', () => {
    expect(run(`const A = () => <View />;`, { enabled: false })).not.toContain('__v6y');
  });

  it('skips node_modules by default', () => {
    const file = path.join(root, 'node_modules/lib/index.js');
    expect(run(`const A = () => <View />;`, {}, file)).not.toContain('__v6y');
  });

  it('does not double-stamp', () => {
    const out = run(`const A = () => <View __v6y="x:1:1" />;`);
    expect(out.match(/__v6y/g)).toHaveLength(1);
  });
});

describe('v6y-ignore comments', () => {
  const ignoreOf = (out: string) => {
    const m = /__v6yIgnore="((?:[^"\\]|\\.)*)"/.exec(out) ?? /__v6yIgnore:\s*"((?:[^"\\]|\\.)*)"/.exec(out);
    return m ? JSON.parse(JSON.parse(`"${m[1]}"`)) : undefined;
  };

  it('parses rules and reasons', async () => {
    const { parseIgnoreComment } = await import('@v6y/babel-plugin');
    expect(parseIgnoreComment(' v6y-ignore ')).toEqual({ rules: '*' });
    expect(parseIgnoreComment(' v6y-ignore missing-role, touch-target-size -- decorative ')).toEqual({
      rules: ['missing-role', 'touch-target-size'],
      reason: 'decorative',
    });
    expect(parseIgnoreComment(' TODO: fix ')).toBeUndefined();
  });

  it('applies a JSX comment to the next element only', () => {
    const out = run(`const A = () => (
      <View>
        {/* v6y-ignore missing-role -- labelled by parent */}
        <Pressable />
        <Other />
      </View>
    );`);
    expect(ignoreOf(out)).toEqual({ rules: ['missing-role'], reason: 'labelled by parent' });
    expect(out.match(/__v6yIgnore/g)).toHaveLength(1);
    expect(out).toMatch(/<Pressable[^>]*__v6yIgnore/);
  });

  it('applies a line comment above a returned element', () => {
    const out = run(`function A() {
      // v6y-ignore
      return <Icon />;
    }`);
    expect(ignoreOf(out)).toEqual({ rules: '*' });
  });

  it('ignores unrelated comments', () => {
    expect(run(`const A = () => (<View>{/* hello */}<Pressable /></View>);`)).not.toContain('__v6yIgnore');
  });

  it('survives plugins that drop JSX comments up front (e.g. the React Compiler)', () => {
    // Stand-in for a preset plugin that rewrites components at Program enter and drops JSX comments.
    const dropComments = () => ({
      visitor: {
        Program(program: any) {
          program.traverse({
            JSXExpressionContainer(p: any) {
              if (p.node.expression.type === 'JSXEmptyExpression') p.remove();
            },
          });
        },
      },
    });
    const out = transformSync(
      `const A = () => (<View>{/* v6y-ignore missing-role -- reason */}<Pressable /></View>);`,
      {
        filename: path.join(root, 'src/App.tsx'),
        root,
        babelrc: false,
        configFile: false,
        plugins: ['@babel/plugin-syntax-jsx', plugin],
        presets: [() => ({ plugins: [dropComments] })],
      },
    )!.code!;
    expect(out).not.toContain('v6y-ignore missing-role'); // the comment really was dropped…
    expect(ignoreOf(out)).toEqual({ rules: ['missing-role'], reason: 'reason' }); // …but the ignore was recorded first
  });
});
