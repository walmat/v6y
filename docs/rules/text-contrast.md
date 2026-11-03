<!-- Generated from packages/core/src/rules by `npm run docs`. Edit the rule, not this file. -->

# text-contrast

**Text must have sufficient contrast against its background.**

| Preset | Level |
|---|---|
| `recommended` | error |
| `strict` | error |
| `wcag21-aa` | error |
| `wcag22-aa` | error |

**WCAG:** [1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) (Level AA)

## Why it matters, and how to fix it

Low-contrast text is hard to read for people with low vision, and for everyone in sunlight. WCAG AA needs 4.5:1 for normal text and 3:1 for large text (24pt+, or 18.66pt+ bold).

v6y computes contrast from your styles, compositing translucent backgrounds. When it can't know a color (theme defaults, images, gradients), it skips the text rather than guessing.

**Fix:** use the suggested text or background color.

## Example

Before:

```tsx
<Text style={{ color: '#aaaaaa' }}>Terms apply</Text> // 2.32:1 on white
```

After:

```tsx
<Text style={{ color: '#595959' }}>Terms apply</Text> // 7.0:1 on white
```

## Options

| Option | Default | What it does |
|---|---|---|
| `level` | `"AA"` | `"AA"` (4.5:1, large text 3:1) or `"AAA"` (7:1, large text 4.5:1). |

## Configure

```ts
// v6y.config.ts
export default defineConfig({
  rules: { 'text-contrast': ['error', { level: "AA" }] }, // or 'off'
});
```

To silence it for one element, with a reason:

```tsx
{/* v6y-ignore text-contrast -- why this one is fine */}
```

[All rules](./README.md)
