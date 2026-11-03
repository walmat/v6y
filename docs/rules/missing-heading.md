<!-- Generated from packages/core/src/rules by `npm run docs`. Edit the rule, not this file. -->

# missing-heading

**Screens should have at least one heading.**

| Preset | Level |
|---|---|
| `recommended` | off |
| `strict` | warning |
| `wcag21-aa` | warning |
| `wcag22-aa` | warning |

**WCAG:** [1.3.1 Info and Relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships) (Level A), [2.4.6 Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels) (Level AA)

This rule uses a heuristic, so it can occasionally flag something that is fine. It is a warning, not an error, in every preset.

## Why it matters, and how to fix it

Screen reader users jump between headings to skim a screen. A screen title styled as big bold text isn't a heading unless it has the role.

**Fix:** add `accessibilityRole="header"` to the screen title. Note: native navigation bars (e.g. native-stack headers) aren't visible to v6y; if yours provides the heading, disable this rule for those screens.

## Example

Before:

```tsx
<Text style={{ fontSize: 34, fontWeight: '700' }}>Account</Text>
```

After:

```tsx
<Text accessibilityRole="header" style={{ fontSize: 34, fontWeight: '700' }}>Account</Text>
```

## Configure

```ts
// v6y.config.ts
export default defineConfig({
  rules: { 'missing-heading': 'warning' }, // or 'off'
});
```

To silence it for one element, with a reason:

```tsx
{/* v6y-ignore missing-heading -- why this one is fine */}
```

[All rules](./README.md)
