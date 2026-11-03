import { defineConfig } from 'v6y';

export default defineConfig({
  // 'strict' turns on every rule, including the heuristic duplicate-label and
  // missing-heading. Use 'wcag21-aa' to check against the standard behind the
  // EU Accessibility Act and the US ADA Title II rule.
  extends: 'strict',

  rules: {
    // Rule options: accept the short "OK" label our dialogs use.
    'meaningless-label': ['warning', { allow: ['OK'] }],
  },

  // Legacy code we haven't migrated yet: its issues are counted as suppressed
  // instead of failing CI. (See src/legacy/LegacyPromoBanner.tsx.)
  ignore: ['src/legacy/**'],

  // Internal screens that never ship to users are not audited.
  screens: { ignore: ['dev-menu'] },

  // `npm run a11y:check` fails on errors, not warnings.
  failOn: 'error',
});
