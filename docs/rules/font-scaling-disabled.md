<!-- Generated from packages/core/src/rules by `npm run docs`. Edit the rule, not this file. -->

# font-scaling-disabled

**Text must scale with the user's font size setting.**

| Preset | Level |
|---|---|
| `recommended` | error |
| `strict` | error |
| `wcag21-aa` | error |
| `wcag22-aa` | error |

**WCAG:** [1.4.4 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text) (Level AA)

## Why it matters, and how to fix it

Many people raise their system text size. `allowFontScaling={false}` ignores that setting, and a low `maxFontSizeMultiplier` caps it. WCAG requires text to stay usable at 200%.

**Fix:** remove `allowFontScaling={false}`. If the layout breaks at large sizes, let it wrap or scroll, or use `maxFontSizeMultiplier={2}` or higher.

## Example

Before:

```tsx
<Text allowFontScaling={false}>$49.00</Text>
<Text maxFontSizeMultiplier={1.3}>Total</Text>
```

After:

```tsx
<Text>$49.00</Text>
<Text maxFontSizeMultiplier={2}>Total</Text> // only if the layout truly can't grow further
```

## Options

| Option | Default | What it does |
|---|---|---|
| `minMultiplier` | `2` | Lowest acceptable `maxFontSizeMultiplier`. WCAG 1.4.4 means 200%, so 2. |

## Configure

```ts
// v6y.config.ts
export default defineConfig({
  rules: { 'font-scaling-disabled': ['error', { minMultiplier: 2 }] }, // or 'off'
});
```

To silence it for one element, with a reason:

```tsx
{/* v6y-ignore font-scaling-disabled -- why this one is fine */}
```

[All rules](./README.md)
