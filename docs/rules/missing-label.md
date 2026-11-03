<!-- Generated from packages/core/src/rules by `npm run docs`. Edit the rule, not this file. -->

# missing-label

**Interactive elements need an accessible name.**

| Preset | Level |
|---|---|
| `recommended` | error |
| `strict` | error |
| `wcag21-aa` | error |
| `wcag22-aa` | error |

**WCAG:** [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) (Level A)

## Why it matters, and how to fix it

A pressable element with no label and no text inside (typically an icon button) is announced as just "button", or not at all. Screen reader users can't tell what it does.

**Fix:** add `accessibilityLabel` describing the action: `<Pressable accessibilityLabel="Close" …>`.

## Example

Before:

```tsx
<Pressable onPress={close}>
  <Ionicons name="close" size={20} />
</Pressable>
```

After:

```tsx
<Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close">
  <Ionicons name="close" size={20} />
</Pressable>
```

## Configure

```ts
// v6y.config.ts
export default defineConfig({
  rules: { 'missing-label': 'warning' }, // or 'off'
});
```

To silence it for one element, with a reason:

```tsx
{/* v6y-ignore missing-label -- why this one is fine */}
```

[All rules](./README.md)
