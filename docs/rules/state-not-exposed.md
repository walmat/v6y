<!-- Generated from packages/core/src/rules by `npm run docs`. Edit the rule, not this file. -->

# state-not-exposed

**Toggles, checkboxes and tabs must expose their state.**

| Preset | Level |
|---|---|
| `recommended` | error |
| `strict` | error |
| `wcag21-aa` | error |
| `wcag22-aa` | error |

**WCAG:** [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) (Level A)

## Why it matters, and how to fix it

A custom checkbox, switch, radio button or tab that doesn't report its state sounds the same whether it's on or off.

**Fix:** pass `accessibilityState={{ checked }}` (or `selected` for tabs), or `aria-checked` / `aria-selected`.

## Example

Before:

```tsx
<Pressable accessibilityRole="switch" accessibilityLabel="Leave at door" onPress={toggle}>
```

After:

```tsx
<Pressable
  accessibilityRole="switch"
  accessibilityLabel="Leave at door"
  accessibilityState={{ checked: leaveAtDoor }}
  onPress={toggle}>
```

## Configure

```ts
// v6y.config.ts
export default defineConfig({
  rules: { 'state-not-exposed': 'warning' }, // or 'off'
});
```

To silence it for one element, with a reason:

```tsx
{/* v6y-ignore state-not-exposed -- why this one is fine */}
```

[All rules](./README.md)
