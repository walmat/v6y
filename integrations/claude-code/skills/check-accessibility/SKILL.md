---
name: check-accessibility
description: Check and fix React Native accessibility issues with v6y (missing labels and roles, unexposed state, low contrast, small touch targets, font scaling). Use after creating or editing React Native screens or components, when the user mentions accessibility, a11y, VoiceOver, TalkBack or WCAG, or before committing UI changes in a project that uses v6y.
---

# Check accessibility with v6y

v6y audits what React Native screens expose to screen readers and reports issues at the line of code to fix. Use it whenever you change UI in a project that has `v6y` installed (check `package.json`).

## Loop

1. **Refresh snapshots** for the screens you touched:
   - Preferred: run the tests that render them with `V6Y_SNAPSHOTS=.v6y/snapshots` set, for example `V6Y_SNAPSHOTS=.v6y/snapshots npx jest path/to/Screen.test.tsx`. Tests that call `await expect(…).toBeAccessible()` record snapshots.
   - If a changed screen has no test, add one: `await expect(<Screen />).toBeAccessible();` (the project's Jest setup needs `setupFilesAfterEnv: ['v6y/jest']`).
2. **Check** with the `check_accessibility` tool (it reports only issues in files you changed). Without the MCP server, run `npx v6y check .v6y/snapshots/*.json --changed`.
3. **Fix**: call `fix_accessibility` (or `npx v6y fix .v6y/snapshots/*.json --changed`) to apply the mechanical fixes, then fix what it lists for you at each `file:line`: labels, image descriptions, colours, structure and state. Use `explain_rule` for background.
4. **Repeat** until the check passes. Then commit.

## How to fix well

- Labels describe the action or content ("Add Flat white to order"), not the element ("button") or the icon ("cart icon").
- Prefer the visible text as the name; only add `accessibilityLabel` when there is no text or it's ambiguous.
- Issues marked "inside this shared component; fix it once" belong in the shared component, not at each call site.
- Never change colors, sizes or layout beyond what the issue requires; suggest larger design changes to the user instead.

## Don't

- Don't silence issues with `{/* v6y-ignore rule -- reason */}` unless the element genuinely isn't user-facing, and always give the reason.
- Don't treat a passing check as proof the screen is fully accessible; automated checks cover part of WCAG. Mention that key flows should still be tried with VoiceOver and TalkBack.
