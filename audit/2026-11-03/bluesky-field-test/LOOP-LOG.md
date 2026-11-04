# v6y improvement loop log

## 2026-11-03 · iteration 1 · owner chains cross host boundaries (item 1)
- Change: `collect.ts` carries each host's full source chain to its descendants (`inherited`), so `ownerSources` reach app code through any number of design-system layers (cap 16, deduped). `source` is unchanged (still the host's own segment).
- Bluesky (49 screens): precision unchanged at **96%** (TP 177 / FP 7 / unsure 8). Issue counts identical per screen and rule (no TP lost).
- Attribution with `designSystem`: **58% → 100%** of issues at app files. Spot-checks good: TabBar.tsx:447 (tab state), AppearanceSettings.tsx:221 (segmented control), Post.tsx:259/189 (nested controls), SettingsList.tsx:285 (contrast).
- Weak spots for later items: Menu.Item missing-role now lands on `modules/bottom-sheet/src/BottomSheetPortal.tsx:23` (a portal; the fix is internal to Menu.Item → item 2). Post-action count contrast lands on PostFeedItem.tsx:448 while the color is set in PostControlButton.tsx (in the design-system globs).
- Without `designSystem` (auto mode) attribution is unchanged at 19%: auto mode only uses `ownerSources[0]`.

## 2026-11-03 · iteration 2 · component-internal defects (item 2)
- Change: issues get `scope: 'component' | 'call-site'` and `callSites`. Component scope when (a) a rule knows it's internal: new collector field `droppedState` records state keys a caller passed that never reached the native view, and state-not-exposed then blames the wrapper; or (b) every element a component line renders on the screen has the issue and it has 2+ immediate callers. Component-scope issues are reported once at the component with their call sites; duplicate-label is always call-site. Report output says "inside this shared component; fix it once".
- Bugs found while measuring and fixed in the same iteration: RN's Pressable passes accessibilityState with every key present but `undefined`, which looked like "dropped" state (16 pager tabs wrongly blamed on PressableWithHover); call sites are now counted by immediate caller, because coarse designSystem globs collapsed 11 menu callers into one portal file.
- Bluesky: precision unchanged at **96%** (177/7/8), identical counts. Component scope applies to exactly the two internal bugs from REPORT.md: Button.tsx:577 drops `selected` (10 instances; the SegmentedControl bug, now with a precise "wrapper drops it" message) and Menu.Item missing role (11 instances, 8 + 3 call sites). With designSystem: 95% of issues at app files, the other 5% being those component-scope Button issues, correctly at the component.

## 2026-11-03 · iteration 3 · duplicate-label behind shared components (item 3)
- Change: duplicate-label's "same call site" key is now the element's full caller chain (source + all ownerSources, available since iteration 1) instead of source + immediate caller. Rows from one `.map()`/list share their entire chain; separate uses of a shared component differ further up.
- Bluesky: duplicate-label 14 → 18 instances; the 4 new ones are exactly the AppearanceSettings segmented-control collisions ("System", "Dark") that v2 had lost (REPORT-v2 regression 1, classified UNSURE as in v1). No other changes: FP unchanged (6 duplicate, 7 total), PostControls/thread "Like" duplicates did not return. Precision **96%** (177/7/12).

## 2026-11-03 · iteration 4 · missing-heading location (item 4)
- Change: the title is the *first* title-like text in screen order (≥20pt, or ≥16pt at weight ≥600), not the largest; text beyond the first 6 rows of a ScrollView/list never qualifies.
- Bluesky: screens where missing-heading found no title 38 → **7** (the 7 have no title-like text). Settings now points at "Settings" (was the account name "Alice"); the "You've reached the end of your feed" footer is no longer picked; every settings sub-page, thread, list and inbox names its real header title. With designSystem the issue lands at each screen's title usage (e.g. PostThread/index.tsx:560) via Typography.tsx:66. Precision **96%** (177/7/12), counts unchanged.
- Follow-up (out of scope for the loop): Bluesky's shared TitleText lacks the header role on ~40 screens. That's a cross-screen pattern; `v6y check` could aggregate the same (rule, via) across screens and suggest the one-line component fix.

## Loop summary (iterations 1–4)
| Metric (Bluesky, 49 screens) | v2 | after loop |
|---|---|---|
| Precision (excl. unsure) | 96% | 96% |
| True positives kept | 177 | 177 (none lost) |
| Issues at app files (designSystem) | 58% | 95% (other 5% correctly at the component) |
| Component-internal bugs reported once at the component | 0 | 2 (Button drops `selected`, Menu.Item role) |
| SegmentedControl duplicates (lost in v2) | lost | restored |
| missing-heading with no title found | 38 | 7 |
