<!-- Generated from packages/core/src/rules by `npm run docs`. Edit the rule, not this file. -->

# meaningless-label

**Labels should describe purpose, not implementation.**

| Preset | Level |
|---|---|
| `recommended` | warning |
| `strict` | warning |
| `wcag21-aa` | warning |
| `wcag22-aa` | warning |

**WCAG:** [2.4.6 Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels) (Level AA)

This rule uses a heuristic, so it can occasionally flag something that is fine. It is a warning, not an error, in every preset.

## Why it matters, and how to fix it

Labels like "button", "icon_23", "closeIcon" or "close.png" are often left over from code. Screen readers read them aloud as-is.

**Fix:** describe the action or destination: "Close dialog", "Open settings". Use `allow` for intentional short labels like "OK".

## Example

Before:

```tsx
<TouchableOpacity accessibilityLabel="btn_add_to_order" onPress={add}>
```

After:

```tsx
<TouchableOpacity accessibilityLabel="Add to order" onPress={add}>
```

## Options

| Option | Default | What it does |
|---|---|---|
| `allow` | `[]` | Labels to always accept, e.g. `["OK"]`. Case-insensitive. |
| `generic` | `[]` | Extra words to treat as generic, e.g. your design system's component names. |

## Configure

```ts
// v6y.config.ts
export default defineConfig({
  rules: { 'meaningless-label': ['error', { allow: [] }] }, // or 'off'
});
```

To silence it for one element, with a reason:

```tsx
{/* v6y-ignore meaningless-label -- why this one is fine */}
```

[All rules](./README.md)
