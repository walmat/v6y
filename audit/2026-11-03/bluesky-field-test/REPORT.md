# v6y field test: bluesky-social/social-app in Jest

Target: `bluesky-social/social-app` @ `b404fd2` (shallow clone), Expo 58, RN 0.88, React 19.3, iOS Jest preset (`jest-expo/ios`).
v6y: the built `dist/` of `~/code/v6y/packages/{core,react-native,babel-plugin}` (built 2026-11-02 18:04–18:06). Preset: `strict`. Nothing under `~/code/v6y` was modified.
Report written by the field-test agent on 2026-11-03.

**Bottom line:** v6y in Jest found real bugs that the app's own lint (`eslint-plugin-react-native-a11y`) misses. Examples: Button drops `accessibilityState`, so segmented controls never expose a selection. Search-result posts swallow their own action buttons. Single images with no alt text are announced as just "button". The banner image is focusable but has no label. But about half of the raw issue volume is false positives. Most of those come from two collector problems: `onClick` counted as "pressable", and repeated list rows treated as duplicate labels. Reports also land on `Button.tsx:577` instead of the call site. With the top 5 fixes below, a CI bot on this app looks viable.

## 1. Getting their Jest running
- Package manager: pnpm 11.28.5 (`devEngines`). Their `devEngines.runtime` asks for Node `^24.22.1`. pnpm downloads it, but `npx jest` refuses to start (`EBADDEVENGINES`), so use `pnpm exec jest`.
- **Their suite: 172/173 suites pass, 2284 tests.** The one failure (`__tests__/lib/string.test.ts`) needs the compiled Lingui catalog. `pnpm intl:compile` fixes it. Their postinstall skips that step when `CI` is set.
- None of their existing tests render a real screen. Component tests mock `#/alf`, `Button`, `Typography`, `Dialog` and lingui away, so their setup could not be reused as-is.

## 2. How v6y was wired in (local only, nothing committed)
| File | What |
|---|---|
| `social-app/babel.config.js` | +3 lines: `@v6y/babel-plugin` when `NODE_ENV=test && V6Y=1`, before their other plugins. It works alongside the React Compiler and worklets plugins. |
| `social-app/jest.v6y.config.js` | Extends their jest config. `moduleNameMapper` sends `@v6y/*` to `~/code/v6y/packages/*` and `react`, `react-native`, `@babel/runtime` to their copies. Uses Reanimated's Jest resolver. Adds `@bsky.app/*` and `sonner-native` to the transform allowlist. Maps the formatjs polyfills to an empty module. |
| `social-app/__v6y__/setup.ts` | About 15 mocks and fixes (section 7). |
| `social-app/__v6y__/fakeBackend.ts` | A fake PDS/AppView behind `fetch` (about 45 XRPC methods). It also seeds a persisted session with a non-expiring fake JWT. |
| `social-app/__v6y__/lib.tsx`, `loggedOut.test.tsx`, `loggedIn.test.tsx` | Harness. It renders the **real `<App/>`** inside `<V6yProvider>`, fakes `onLayout` and image load to get past the Splash screen, and navigates with the app's own `navigate()` / `resetToTab()`. It presses real buttons, emulates the native sheet "closed" event, and saves each `capture()` to `results/*.json`. |

Run: `cd social-app && V6Y=1 NODE_ENV=test pnpm exec jest -c jest.v6y.config.js --forceExit` (about 130 s for 56 captures).

## 3. What rendered
**56 captures, all from the real app tree:**
- **Logged-out (4):** landing / splash, sign-in, forgot password, signup step 1.
- **Logged-in (47 routes):** Home (plus the same Home again after a tab round-trip), Search/Explore, Notifications, Messages inbox, own and other profile, followers, follows, liked-by, post threads (plain / image / link card), Feeds, CustomFeed, SavedFeeds, Lists, Bookmarks, Hashtag, Settings with 22 sub-pages, Support, ToS, Community Guidelines, NotFound.
- **Overlays (4):** the NUX sheet, post options menu, share menu, Composer.
- **Storybook (`Debug`):** about 95% rendered. Reported separately, because demo content inflates the numbers: 749 issues.

**Not covered / partial:**
- Chat conversation.
- Notification items: the fixture fails validation, so only the error state rendered.
- List and starter-pack detail, video feed, lightbox, onboarding, signup steps 2–3, edit-profile dialogs.
- **Only the light theme. Screen reader is reported as off.**

## 4. Distinct issues
Grouped by rule + source + app call site. Verdicts assume iOS/VoiceOver.

| # | Rule | Source → call site | Verdict | Reason |
|---|---|---|---|---|
| 1 | missing-label | `PressableScale.tsx:41` ← `HomeHeaderLayoutMobile.tsx:67` | **TP** | Home logo button: SVG, no label. |
| 2 | missing-label | `AutoSizedImage.tsx:229` ← `ImageEmbed.tsx:132` | **TP** | Single-image posts with empty alt are announced as just "button". Gallery has a fallback; single images don't. |
| 3 | image-missing-label | `UserBanner.tsx:223` ← `Profile/Header/Shell.tsx:223` | **TP** | Banner is `accessible` with no label. |
| 4 | image-missing-label | `AutoSizedImage.tsx:137` | **FP** | Image inside the accessible Pressable of #2. Duplicate. |
| 5 | meaningless-label | `TextField.tsx:252` ← `SearchInput.tsx:49` | **FP** | "Search" on a search field is conventional. |
| 6 | duplicate-label | PostControls ×N posts | **FP** | List-row repetition. 100+ instances. |
| 7 | duplicate-label | `EventStopper.tsx:22` | **FP** | `onClick` wrapper counted as a control (#13). |
| 8 | duplicate-label | `UserAvatar.tsx:619` ("Alice's avatar" ×2) | **FP** | Same destination, same name is correct. |
| 9 | duplicate-label | "Sign in" ×2, "New chat" ×2, "Go back" ×2 | **FP** | Same action, same name is correct (WCAG 3.2.4). |
| 10 | duplicate-label | "System"/"Dark" across segmented controls | UNSURE | |
| 11 | duplicate-label | Messages settings radio groups | UNSURE | |
| 12 | duplicate-label | "Notifications" row vs tab | UNSURE | |
| 13 | missing-role | `EventStopper.tsx:22` (26 instances) | **FP** | A plain View with `onClick` to stop propagation; not a control. |
| 14 | missing-role | `Menu/index.tsx:161` (Menu.Item) | **TP** | Menu items have no button role. One fix. |
| 15 | missing-role | `Dialog/index.tsx:609` sheet handle | TP\* | Only focusable with a screen reader on; correct by coincidence. |
| 16 | nested-interactive | `EventStopper.tsx:22` as outer | **FP** | Same root cause as #13. 32 instances. |
| 17 | nested-interactive | `ComposerPrompt.tsx:210`, `:232` | **TP** | Camera and image buttons unreachable inside "Compose new post". |
| 18 | nested-interactive | `Post.tsx:157` (search results) | **TP** | Missing `accessible={false}`, so the whole post is one link and Reply/Like are unreachable. |
| 19 | nested-interactive | `FeedCard.tsx:364` | **TP** | Pin/save unreachable. |
| 20 | nested-interactive | `ProfileCard.tsx:582` (Follow) | **TP** | Follow button unreachable in follower lists. |
| 21 | state-not-exposed | `TabBar.tsx:447` | **TP** | Pager tabs with no `selected`. |
| 22 | state-not-exposed | `Button.tsx:577` ← `SegmentedControl.tsx:199` | **TP (real bug)** | `Button.tsx:586` overwrites `accessibilityState`, so selection is lost. |
| 23 | state-not-exposed | `PostInteractionSettingsDialog.tsx:532` | TP (low) | |
| 24 | missing-heading | 44 screens, located at the harness root | **TP**, bad location | `Layout.Header.TitleText` has no header role; 17pt is below v6y's 20pt threshold. |
| 25 | missing-heading | Login, Signup, NotFound, Feeds, Support titles | **TP** | |
| 26 | missing-heading | `Settings.tsx:384` pointed at the account name | TP rule, wrong element | |
| 27 | touch-target-size | `Button.tsx` small round 33×33 (11 call sites) | **TP** (advisory) | |
| 28 | touch-target-size | `ProfileHeaderStandard.tsx:359` 37×45 | TP (intentional) | hitSlop counted correctly. |
| 29 | text-contrast | `SettingsList.tsx:285` #8798b0 on #fff, 2.94 | **TP** | |
| 30 | text-contrast | `SegmentedControl.tsx:231` 2.62 | **TP** | |
| 31 | text-contrast | `PostControlButton.tsx:130` 4.32 | TP (marginal) | |
| 32 | text-contrast | #e91646 on #fff, 4.4988 | TP (marginal) | Prints "4.50:1; needs 4.5:1", which reads like a bug. |
| 33 | text-contrast | #006aff on #f9fafb, 4.46 | TP (marginal) | |
| 34 | text-contrast | `ErrorMessage.tsx:40` 3.53 | **TP** | |
| 35 | text-contrast | `NativeSplashScreen.tsx:193` | **FP** | Real backdrop is an absolutely positioned image. |
| 36 | font-scaling-disabled | `CharProgress.tsx:43` (1×) | **TP** | |
| 37 | font-scaling-disabled | `PostLanguageSelect.tsx:236` (1.5×) | **TP** | |
| – | missing-label (Storybook) | `RNUITextViewChild` link | **FP** | Text lives in an iOS-native host's `text` prop. |

No `input-missing-label` findings; all text fields are labelled.

## 5. Totals and precision
| Rule | TP | FP | Unsure |
|---|---|---|---|
| missing-label | 2 | 0 (+1 Storybook) | |
| image-missing-label | 1 | 1 | |
| meaningless-label | 0 | 1 | |
| duplicate-label | 0 | 4 rows | 3 |
| missing-role | 2 | 1 | |
| nested-interactive | 4 | 1 | |
| state-not-exposed | 3 | 0 | |
| missing-heading | 3 | 0 (locations poor) | |
| touch-target-size | 2 (advisory) | 0 | |
| text-contrast | 6 | 1 | |
| font-scaling-disabled | 2 | 0 | |
| **Total** | **25** | **9–11** | **3** |

- Distinct precision is about **69–74%**.
- By instance (49 screens): TP 173, FP 162, unsure 12, about **52%**. FP volume: duplicate-label 100, nested-interactive 32, missing-role 26. 90% of FP instances come from fixes 1 and 4 below; with them, roughly **90%+**.
- The overlay captures are worse: the Composer capture has 56 issues and only 2 belong to it (fix 2).

## 6. Collector and rule problems, by impact
1. **`onClick`-only Views count as pressables** (about 50% of FP instances). RN Pressability always sets `onResponderRelease` too; require `onResponderRelease`/`onPress`, and count `onClick` only on web. A node whose name comes entirely from one interactive descendant is a wrapper, not a control.
2. **No modal awareness.** When a visible `Modal` / `RCTModalHostView`, `accessibilityViewIsModal`, `aria-modal` or a configured sheet host exists, hide everything outside the topmost one.
3. **Unknown iOS text host `RNUITextView` / `RNUITextViewChild`.** Text lives in a `text` prop. Add to the text types and read `p.text`. Better: a config `hostTypes: {text, image, input}`.
4. **duplicate-label flags list rows.** Drop collisions that come from the same call site rendered N times; report only when at least 2 different call sites collide. Optionally skip links with the same `href`.
5. **Attribution for shared components.** When one source yields issues from at least N distinct call sites, attribute to the call site ("via Button.tsx:577"), or support `designSystem: ['src/components/**']` in config. A PR bot needs to match changed lines.
6. **missing-heading location.** Pick the topmost large-or-bold text (e.g. ≥17pt and weight ≥600), or text inside a composite named like `Header`/`Title`. Fall back to the first app-sourced node, never the root.
7. **image-missing-label double-reports** images inside an accessible pressable. Skip when an ancestor is interactive and accessible.
8. **state-not-exposed: radio should accept `selected`.** Also hint that a wrapper may be overwriting `accessibilityState`.
9. **text-contrast trusts an ancestor background under an image.** Skip when an absolutely positioned image, blur or gradient sits between. Floor the printed ratio (4.4988 must not print as 4.50).
10. **meaningless-label "repeats the role" on search inputs.** Skip the role-repeat check for text inputs.
11. **`accessible={false}` controls** should be reported as "unreachable", not "no role".
12. **Touch targets in Jest are mostly blind:** 9% of interactive nodes had explicit sizes. Add a yoga-layout measurer, or keep touch-target-size out of the Jest gate.

## 7. Jest artefacts vs. device
**Jest-only, handled:**
- Overrode their mocks: `requireNativeViewManager → () => null`, a `NativeEventEmitter` without `remove()`, an incomplete safe-area mock, and `multiformats` stubbing `CID`.
- Added mocks: reanimated/worklets, keyboard-controller, expo-updates, expo-notifications, expo-asset, expo-camera, `requestIdleCallback`, `getBoundingClientRect`.
- Sheets don't close by themselves. Screen reader is off (14 files behave differently with it on). Only the light theme. Frames only from explicit sizes.
- v6y correctly hid the closed drawer and inactive stack/tab screens. No leakage between captures.

**Equally wrong on device:** fixes 1, 2, 3, 4, 5, 6 and 9 above.

## 8. Is "v6y in Jest in CI" credible as a PR bot?
**Yes, conditionally.**
- **Works well:** the prop-based rules (names, roles, state, nesting, font scaling), plus contrast (100% of 750 visible texts had both colors thanks to theme tokens). The true positives were real, non-obvious bugs.
- **Blocks it today:**
  - (a) about 52% instance precision (fixes 1 and 4);
  - (b) attribution to `Button.tsx` instead of the changed line (fix 5);
  - (c) harness cost: about 700 lines of mocks, a fake backend and splash nudging per app. v6y should ship a "render the real app in Jest" kit.
- Gate on structural `error`s only; keep touch-target-size and duplicate-label as non-blocking comments. The run is deterministic, about 2 minutes for 56 screens.

**A device adds:** real frames for the 91% of controls sized by padding, the screen-reader-on code paths, themes and font scale, real native host names, real modal presentation, and confirmation of the iOS merge behaviour.

**Neither catches yet:** focus order, focus moving into sheets/dialogs, and announcements of dynamic changes.

Files: `results/*.json`, `results/_manifest.loggedIn.json`, analysis scripts (`aggregate.py`, `classify.py`, …), harness in `social-app/__v6y__/` and `jest.v6y.config.js` (uncommitted).
