# v6y example: a coffee-ordering app

A small Expo Router app (Expo SDK 58, React Native 0.88) built to show everything v6y does. Every screen comes in two versions:

- **Before** has the accessibility bugs real apps ship, each annotated in the source.
- **After** has them fixed.

A switch at the top of each screen flips between the two and re-audits. The Before screens trigger **all 12 v6y rules**.

```
v6y · menu  ios · 9:41:02 AM
  ✖ error   ×2 Pressable has no accessible name. Screen readers will announce just "button" or skip it.
    at src/components/before/IconButton.tsx:23:5 [missing-label, WCAG 4.1.2]
    used at src/screens/menu/Before.tsx:17, 18
    fix: Add accessibilityLabel="…" describing what it does (e.g. "Close", "Add to cart").
  ✖ error   ×3 Pressable is nested inside another pressable (Pressable). Screen readers merge them, so the inner one can't be reached.
    at src/components/before/ProductCard.tsx:28:9 [nested-interactive, WCAG 4.1.2]
    fix: Make them siblings, or set accessible={false} on the outer element and use accessibilityActions.
  …
8 errors, 8 warnings (7 things to fix)
4 suppressed.
```

## Run it

From the repository root, build the v6y packages once:

```sh
npm install && npm run build
```

Then start the app:

```sh
cd examples/expo-app
npm install
npx expo start          # press i (iOS simulator) or a (Android emulator), or scan with Expo Go
```

Use the app. Each screen is audited about a second after it appears. Reports print in the **Metro terminal**, a summary goes to the app's console, and snapshots are saved to `.v6y/snapshots/`.

### No simulator? Run the showcase test

```sh
npm test               # renders every screen through v6y's real collector and rules
npm run a11y:check     # the CI command, run over the snapshots the test just recorded; exits 1
```

The test is the showcase's contract. It checks that:
- each Before screen shows exactly the issues annotated in its source;
- together, the Before screens cover every rule;
- every After screen is clean.

Jest has no layout engine, so touch-target sizes come from explicit `width`/`height` styles. The tab bar is only audited on a device.

## The tour

| Screen | Before (see the `✖` comments in the source) | After |
|---|---|---|
| **Menu** | Icon buttons with no label, no role and 32×32 targets. The bugs are in one shared component, so each one is reported once with both call sites. Low-contrast note. A favorite button *nested inside* each product card. "Add" and "Favorite" repeated on every card. | Required `label` prop, `hitSlop` up to 44×44, the heart moved out to be a sibling toggle button, item-specific labels |
| **Product** (tap a card) | A focusable image with no description. A title that isn't a heading. `allowFontScaling={false}` on the price. Size radios that never say which is selected. A 20×20 quantity stepper. A "Add to order" button labelled `btn_add_to_order` with no role, white on light blue. | Image description, `header` role, radios with `checked` state inside a `radiogroup`, 44×44 stepper, visible text as the name |
| **Order** | Text fields labelled only by their placeholder. A custom switch with no on/off state. The total capped at 1.3× font scaling. Light-gray terms. A "Place order" button with no role. | Visible labels linked with `accessibilityLabel` + `aria-labelledby`, `checked` state, no cap, `#595959` text, `accessibilityRole="button"` |
| **Account** | A big "Account" title that isn't a heading. Rows and "Sign out" with no role. "Sign out" in pale red. | `header` role, button roles, `#c62828` |
| **Tab bar** | React Navigation's default inactive label color is about 3.3:1. v6y reports it against `src/app/(tabs)/_layout.tsx`, where the tabs are configured. | `tabBarInactiveTintColor` |

Code layout:
- **`src/screens/<screen>/Before.tsx` and `After.tsx`**: diff the two to see each fix.
- **`src/components/before/`**: the buggy shared components.
- **`src/components/`**: the same components, fixed.

### Configuration features on show

All of these are in [`v6y.config.ts`](./v6y.config.ts):

- **`extends: 'strict'`** turns on every rule. Try `'wcag21-aa'` to see the EU Accessibility Act / ADA Title II view.
- **Rule options:** `'meaningless-label': ['warning', { allow: ['OK'] }]`.
- **`ignore: ['src/legacy/**']`:** [`LegacyPromoBanner`](./src/legacy/LegacyPromoBanner.tsx) has four issues. They're counted as *suppressed* rather than failing, so a team can adopt v6y now and fix legacy code later.
- **`screens: { ignore: ['dev-menu'] }`:** long-press "Version 1.0.0" on Account to open an internal screen full of issues. v6y logs `dev-menu: skipped`.
- **Inline suppression with a reason:** the version long-press is a hidden developer shortcut, so it carries `{/* v6y-ignore missing-role -- hidden developer shortcut … */}`. The reason is kept with the suppressed issue.

### How the app is wired

[`metro.config.js`](./metro.config.js) is `withV6y(getDefaultConfig(__dirname))`, plus a clearly marked block that's only there because this example uses the v6y packages straight from the monorepo. Nothing else in the app knows about v6y.

The one exception is the demo switch, which calls `capture()` to re-audit the same screen after flipping. Because of that import, the inert runtime ships in this app's production bundle. With `withV6y` alone, production bundles contain no v6y code.
