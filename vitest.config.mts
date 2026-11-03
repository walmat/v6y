import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    // Tests run against TypeScript sources, not built dist/ output.
    alias: {
      '@v6y/core': path.resolve(import.meta.dirname, 'packages/core/src/index.ts'),
      '@v6y/babel-plugin': path.resolve(import.meta.dirname, 'packages/babel-plugin/src/index.ts'),
      '@v6y/react-native': path.resolve(import.meta.dirname, 'packages/react-native/src/index.tsx'),
      '@v6y/cli': path.resolve(import.meta.dirname, 'packages/cli/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'packages/*/test/**/*.test.tsx'],
  },
});
