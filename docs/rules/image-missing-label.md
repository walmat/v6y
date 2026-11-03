<!-- Generated from packages/core/src/rules by `npm run docs`. Edit the rule, not this file. -->

# image-missing-label

**Images exposed to screen readers need a description.**

| Preset | Level |
|---|---|
| `recommended` | error |
| `strict` | error |
| `wcag21-aa` | error |
| `wcag22-aa` | error |

**WCAG:** [1.1.1 Non-text Content](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content) (Level A)

## Why it matters, and how to fix it

React Native images are skipped by screen readers by default, which is right for decorative images. If you make an image focusable (`accessible`) or give it `accessibilityRole="image"`, it must also have a label. Otherwise it is announced as "image" with no description.

**Fix:** add `accessibilityLabel` describing the content ("Profile photo of Sam"). If it's decorative, remove `accessible` and the role instead.

## Example

Before:

```tsx
<Image source={product.image} accessible />
```

After:

```tsx
// Meaningful: describe it
<Image source={product.image} accessible accessibilityLabel="A flat white in a white cup" />

// Decorative: leave it out of the accessibility tree (the default)
<Image source={background} />
```

## Configure

```ts
// v6y.config.ts
export default defineConfig({
  rules: { 'image-missing-label': 'warning' }, // or 'off'
});
```

To silence it for one element, with a reason:

```tsx
{/* v6y-ignore image-missing-label -- why this one is fine */}
```

[All rules](./README.md)
