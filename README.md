# v6y

**Accessibility auditing for React Native that points at the line of code to fix.**

*v6y* is a numeronym for **verbally**: a screen reader speaks your UI out loud, and v6y checks what it will say.

```
v6y · menu  ios · 9:41:02 AM
  ✖ error   ×2 Pressable has no accessible name. Screen readers will announce just "button" or skip it.
    at src/components/before/IconButton.tsx:23:5 [missing-label, WCAG 4.1.2]
    used at src/screens/menu/Before.tsx:17, 18
    fix: Add accessibilityLabel="…" describing what it does (e.g. "Close", "Add to cart").
  ✖ error   Text "Free delivery on orders over $20" has contrast 2.81:1 (#9a9a9a on #ffffff); needs 4.5:1 for normal text.
    at src/screens/menu/Before.tsx:25:7 [text-contrast, WCAG 1.4.3]
    fix: Use text color #757575 (4.60:1).
```

**See it in action:** [`examples/expo-app`](./examples/expo-app) is a coffee-ordering app where every screen has a "before" version with real-world bugs and an "after" version with them fixed. Together the before screens trigger all 12 rules.

## Setup: one line

```sh
npm i -D v6y
npx v6y init        # writes v6y.config.ts (optional)
```

```js
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config'); // or '@react-native/metro-config'
const { withV6y } = require('v6y/metro');

module.exports = withV6y(getDefaultConfig(__dirname));
```

Start your app as usual and navigate around. Each screen is audited once it settles, and issues appear in the **Metro terminal** and the app's console. You don't need to change `babel.config.js` or add a provider.

In development builds, `withV6y` does four things:
1. Adds the Babel plugin to app code (not `node_modules`), so issues point at `file:line`.
2. Imports `v6y/auto` at the top of the entry file. That wraps the root via `AppRegistry` and tracks the focused React Navigation / Expo Router screen.
3. Bundles `v6y.config.ts` into the app, so in-app audits use your rules.
4. Receives reports on the Metro dev server and saves them to `.v6y/snapshots/` for CI.

**Production bundles are untouched.**

Without Metro integration, add the Babel plugin (`v6y/babel`) yourself, put `import 'v6y/auto'` at the top of your entry file, and run `npx v6y dev`.

## In your tests

No device needed: assert on any screen in Jest, with the same rules and config.

```js
// jest config
setupFilesAfterEnv: ['v6y/jest'],
```

```tsx
await expect(render(<Checkout />)).toBeAccessible();   // React Native Testing Library
await expect(<Checkout />).toBeAccessible();           // or just an element
await expect(<Checkout />).toBeAccessible({ failOn: 'warning', screen: 'Checkout' });
```

A failure lists every issue with its `file:line` and fix:

```
v6y found 9 accessibility issues:
  ✖ error   ×3 Pressable has role "radio" but doesn't expose whether it's checked.
    in src/screens/product/Before.tsx:32:11 [state-not-exposed, WCAG 4.1.2]
    fix: Add accessibilityState={{ checked: … }} (or aria-checked).
```

- **Locations:** add the Babel plugin to your test config, `env: { test: { plugins: ['v6y/babel'] } }`.
- **Types:** add `"v6y/jest"` to `compilerOptions.types` in `tsconfig.json`.
- **Limits:** tests have no layout engine, so touch-target sizes are only checked where you set an explicit `width`/`height`.

## With coding agents

Coding agents can check the screens they edit: `npx v6y mcp` is an MCP server for Claude Code, Codex, Cursor and others. For Claude Code there's a plugin with the server, a skill and a commit gate:

```
/plugin marketplace add walmat/v6y
/plugin install v6y@v6y
```

Setup for other agents, and an `AGENTS.md` snippet: [docs/agents.md](./docs/agents.md).

## Configuration: `v6y.config.ts`

```ts
import { defineConfig } from 'v6y';

export default defineConfig({
  extends: 'recommended',            // 'recommended' | 'strict' | 'wcag21-aa' | 'wcag22-aa'
  rules: {
    'missing-role': 'off',
    'touch-target-size': ['error', { minimum: 32 }],
    'text-contrast': ['error', { level: 'AAA' }],
    'meaningless-label': ['warning', { allow: ['OK'] }],
  },
  ignore: ['src/legacy/**'],         // suppress issues from these source files
  screens: { ignore: ['Storybook*'] },
  failOn: 'error',                   // what fails `v6y check` in CI: 'error' | 'warning' | 'never'
  capture: { delayMs: 800 },         // wait for screens to settle before auditing
  designSystem: ['src/components/**'], // report issues inside shared components at the call site
  hostTypes: { text: ['MySelectableText'], modal: ['MyBottomSheet'] }, // your own native views
});
```

The config is typed and validated. A typo like `'missing-lable'` or an unknown option fails with a list of valid choices. `.js`, `.mjs`, `.cjs` and `.json` work too; a TypeScript config needs Node 22.18 or newer when loaded by the CLI.

### Presets

| Preset | Use it when |
|---|---|
| `recommended` | Default. Low false-positive rules every app should pass. |
| `strict` | Everything on, with heuristic rules as warnings. |
| `wcag21-aa` | You need WCAG 2.1 AA, the standard behind the **EU Accessibility Act** (via EN 301 549) and **US ADA Title II**. Requirements only, no platform guidelines. |
| `wcag22-aa` | WCAG 2.2 AA (adds the 24×24 touch-target minimum). |

### Shared components and where issues are reported

An issue inside a shared component, like the `Pressable` in your design system's `Button`, is reported **at the call site** in your screen, "via" the component. That's where PR comments need to land. v6y does this automatically once the same issue comes from 3 or more call sites. Name your shared components with `designSystem` to make it explicit.

### What v6y understands

- **Modals:** while a `Modal`, sheet or `accessibilityViewIsModal` view is open, only it is audited, the way screen readers treat it.
- **Icon fonts** (`@expo/vector-icons` and similar) aren't text, so they never count as a button's name.
- **`onClick`-only wrapper Views** aren't controls.

### Silencing one element

```tsx
{/* v6y-ignore missing-role -- announced by the parent row */}
<Pressable onPress={toggle}>…</Pressable>

// v6y-ignore
return <DecorativeSparkles />;
```

The comment applies to the next element and everything it renders. Leave out rule ids to ignore all rules. The reason after `--` is kept with suppressed issues for compliance reports.

## Rules

`npx v6y rules` prints this table from the code. Each rule has a page with why it matters, before/after code and its options: **[rule reference](./docs/rules/README.md)**. Every reported issue links to its page.

| Rule | recommended | strict | wcag21-aa | wcag22-aa | WCAG | Options |
|---|---|---|---|---|---|---|
| `missing-label`: pressable with no accessible name (icon-font glyphs don't count) | error | error | error | error | 4.1.2 | — |
| `meaningless-label`: "button", "icon_23", "close.png" … | warn | warn | warn | warn | 2.4.6 | `allow`, `generic` |
| `image-missing-label`: focusable image with no description | error | error | error | error | 1.1.1 | — |
| `input-missing-label`: text field labelled only by its placeholder | warn | error | error | error | 3.3.2, 4.1.2 | `allowPlaceholder` |
| `duplicate-label`: different controls announced the same (repeats within one list aren't flagged) | — | warn | warn | warn | 2.4.6 | `ignoreCase`, `includeRepeated` |
| `missing-role`: pressable not announced as a button or link | warn | error | error | error | 4.1.2 | — |
| `nested-interactive`: pressable inside a pressable | error | error | error | error | 4.1.2 | — |
| `state-not-exposed`: checkbox/switch/tab without checked/selected | error | error | error | error | 4.1.2 | — |
| `missing-heading`: screen with no `header` role | — | warn | warn | warn | 1.3.1, 2.4.6 | — |
| `touch-target-size`: under 24×24, with an advisory warning under 44pt/48dp; `hitSlop` counts | error | error | — | error | 2.5.8 | `minimum`, `platformGuidelines`, `ios`, `android` |
| `text-contrast`: 4.5:1, or 3:1 for large text; suggests a text color and a background | error | error | error | error | 1.4.3 | `level: 'AA' \| 'AAA'` |
| `font-scaling-disabled`: `allowFontScaling={false}`, or a cap under 2× | error | error | error | error | 1.4.4 | `minMultiplier` |

## CI and pre-commit

Run your tests with `V6Y_SNAPSHOTS` set, so every `toBeAccessible()` also records what it audited. Then check only what the change touched:

```yaml
# .github/workflows/a11y.yml
on: pull_request
jobs:
  v6y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with: { fetch-depth: 0 }
      - uses: actions/setup-node@v5
        with: { node-version: 24 }
      - run: npm ci
      - run: npx jest
        env: { V6Y_SNAPSHOTS: .v6y/snapshots }
      - uses: walmat/v6y@main   # annotates the PR's changed lines
```

Issues appear as annotations on the lines the pull request changed, matched on where each issue is reported, the shared component it came through, or any of its call sites.

The same check runs anywhere:

```sh
npx v6y check .v6y/snapshots/*.json --changed            # uncommitted changes
npx v6y check .v6y/snapshots/*.json --staged             # pre-commit hook (husky, lefthook…)
npx v6y check .v6y/snapshots/*.json --base origin/main   # a branch
npx v6y check .v6y/snapshots/*.json                      # everything; exit code follows failOn
```

With `--changed`, v6y also warns when a snapshot is older than your edits, and skips that snapshot's issues for those files, since its line numbers are out of date. It also lists changed screen files that no snapshot renders.

## What's in the package

One install, `v6y`, with these entry points:

| Import | What it does |
|---|---|
| `v6y` | `defineConfig`, the rules, presets and audit engine. Pure TypeScript, so it runs in the app, Node and CI. |
| `v6y/metro` | `withV6y()` for `metro.config.js` |
| `v6y/react-native` | `<V6yProvider>`, `capture()`, `trackNavigation()`: walks the live React tree, audits, reports |
| `v6y/babel` | The Babel plugin: `file:line` stamps and `v6y-ignore` comments |
| `v6y/jest` | `expect(…).toBeAccessible()` for Jest and Vitest |
| `npx v6y` | The `init`, `rules`, `check` and `dev` commands |

In this repository they're developed as separate workspace packages under `packages/` and bundled into `packages/v6y` by `npm run build`.

## Development

```sh
npm install
npm test        # builds, then runs vitest
```

## Status and known gaps

This is pre-alpha. What has been verified:
- **Unit tests** for every package.
- **Real renders of the example app** through the collector and rules, in Jest.
- **Real Metro builds** of the example with Expo SDK 58: file:line stamps, inline ignores (including with the React Compiler on), auto-setup and bundled config are all present in development bundles, and absent from production bundles.
- **The Expo dev server** (`expo start`) receives reports and prints them.

**Not yet verified:** the runtime on a real simulator or device, in particular `measureInWindow` and screen-change detection under the new architecture.

Known gaps:
- **Contrast** is computed from styles only. Text with unknown colors (theme defaults, images, gradients) is skipped, not guessed.
- **`missing-heading`** can't see native navigation bars (native-stack headers). That's why it's only in `strict`.
- **`AppRegistry` keeps a single wrapper component.** If your app sets its own, render `<V6yProvider>` yourself.
- **Next up:**
  - run on a simulator
  - in-app overlay
  - Maestro/Detox CI runner and PR comments
  - a 200% font-scale truncation check
  - a single `v6y` npm package
