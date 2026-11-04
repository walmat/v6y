# v6y field test v2: Bluesky after the fixes (2026-11-03)

**Short version:** instance precision went from 51% to **96%**, distinct-finding precision from 71% to **92%**, and no true positive was lost. Composer and sheet captures now contain only their own issues, and the noise from the `EventStopper` wrapper and the post-action duplicates is gone. Call-site attribution only half works: the chain of calling components stops at the nearest View-type element, and the heading rule misses Bluesky's 16.9pt titles.

**Setup.** Same harness and commit (`b404fd2`) as v1; 56 captures per run, about 2 minutes.
- (a) `strict` → `results-v2/`
- (b) `strict` + `designSystem: ['src/components/**','src/view/com/util/**','src/lib/custom-animations/**','src/alf/**']`, `hostTypes: {modal: ['BottomSheet']}` → `results-v2-ds/`

`BottomSheet` is the Jest-mock host name; the real device host name is unverified.

**One v1 verdict corrected:** #3 (`UserBanner.tsx:223`) is a false positive. The image sits inside a Pressable with role image and label "View profile banner". The v1 numbers below use the corrected verdict.

## 1. Precision per instance
49 normal screens; excludes overlays, the repeated Home capture and Storybook. Counts are TP / FP / unsure.

| Rule | v1 | v2 (strict) | v2 + designSystem |
|---|---|---|---|
| duplicate-label | 0 / 100 / 12 | 0 / 6 / 8 | same |
| image-missing-label | 0 / 3 / 0 | 0 / 0 / 0 | same |
| meaningless-label | 0 / 2 / 0 | 0 / 0 / 0 | same |
| missing-role | 0 / 26 / 0 | 0 / 0 / 0 | same |
| nested-interactive | 28 / 32 / 0 | **34** / 0 / 0 | same |
| missing-heading | 49 / 0 / 0 | 49 / 0 / 0 | same |
| missing-label | 2 / 0 / 0 | 2 / 0 / 0 | same |
| state-not-exposed | 27 / 0 / 0 | 27 / 0 / 0 | same |
| text-contrast | 52 / 1 / 0 | 52 / 1 / 0 | same |
| touch-target-size | 13 / 0 / 0 | 13 / 0 / 0 | same |
| **Total** | **171 / 164 / 12 (51%)** | **177 / 7 / 8 (96%)** | **96%** |

nested-interactive gained 6 true positives: Share and More inside search-result posts, previously credited to the wrapper.

**Distinct findings:**

| | TP | FP | Unsure | Precision |
|---|---|---|---|---|
| v1 (corrected) | 24 | 10 | 3 | 71% |
| v2 | 24 | 2 | 2 | **92%** |

**Total issue volume:**

| | Normal | NUX sheet | Post menu | Share | Composer | Storybook |
|---|---|---|---|---|---|---|
| v1 | 633 | 55 | 63 | 58 | 56 | 749 |
| v2 | 273 | 17 | 25 | 20 | **3** | 372 |
| v2 + ds | 228 | **2** | **10** | **5** | 3 | 372 |

## 2. Checks
- **Overlays contain only their own issues: yes.** The Composer (RN Modal) is isolated by default. Bottom sheets only once `hostTypes.modal` is set.
- **EventStopper noise gone: yes.**
- **PostControls duplicates gone: yes.** All 60, plus the avatar and "More options" pairs.
- **RNUITextView text participates: yes.** Post bodies and bios are contrast- and scaling-checked, and the Storybook link false positive is gone.

## 3. Old false positives
- **Gone:** 8 of 10 rows (#3, #4, #5, #6, #7, #8, #13, #16) plus the Storybook RNUITextView link.
- **Remaining:**
  - #9, same action from different call sites ("Sign in", "New chat", "Go back"). Expected under the new rule; would need a same-destination heuristic.
  - #35, splash "Sign in" over an image background. The image-background fix was not in this change.

## 4. Regressions and new problems
1. **duplicate-label merges different call sites behind one shared component.** The key `source + ownerSources[0]` sees three different segmented controls as one repeated row, because `ownerSources[0]` is `SegmentedControl.tsx:199` for all of them. This lost an unsure item, not a confirmed TP.
   - Fix: key on the first owner outside the design system, or the nearest list-item ancestor.
2. **missing-heading picked a feed footer** (`FollowingEndOfFeed.tsx:42`) in one capture. 40 screens still point at the harness root, because Bluesky's header title is **16.9pt / 600**.
   - Fix: allow ≥16pt at weight ≥600, prefer text near the top, and never pick text inside scrolling lists.
3. **No new FP instances and no lost TPs.**

## 5. Do locations land on call sites?
- **Automatic (≥3 callers):** 14 issues moved, all Menu.Item missing-role, onto 11 call sites. That's the wrong place: the fix is one line in `Menu/index.tsx:161`.
- **designSystem:** 83 of 228 issues got an app-level location. Good hits include `Feeds.tsx:509`, `TabBar.tsx:447`, `SettingsList.tsx:285`, `Post.tsx:189` and `HomeHeaderLayoutMobile.tsx:67`.
- **Still stuck:** 46 contrast issues at `Typography.tsx:66` (the color is set in `PostControlButton.tsx:130`), 28 nested-interactive at `Button.tsx:577`, 41 missing-heading at the root.
- **Root cause:** `collect.ts` starts a fresh composite list at every host element, so owner chains stop at the nearest View-type ancestor (1–4 levels, often all design-system code).
  - Fix: when every owner is design-system code, keep walking up through ancestors' `source`/`ownerSources` until an app file appears. Or fall back to the outermost design-system caller.
- **Some defects really are internal to the component** (Button state clobbering, Menu.Item role, TitleText heading). A PR bot should match the diff against either `location` or `via`, and post once per `via` when the defect is internal.

## 6. Verdict
The noise that blocked a CI bot is gone: 96% instance precision, with sheets and modals isolated. What's left is attribution:
- owner chains that stop at the nearest View-type element;
- the "same call site" key behind shared components;
- heading location for 16.9pt/600 titles.

Touch targets remain effectively device-only in Jest. Before turning the bot on: fix chain depth and gate on errors from structural rules.
