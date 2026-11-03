<!-- Generated from packages/core/src/rules by `npm run docs`. Edit the rule, not this file. -->

# missing-role

**Interactive elements should expose a role.**

| Preset | Level |
|---|---|
| `recommended` | warning |
| `strict` | error |
| `wcag21-aa` | error |
| `wcag22-aa` | error |

**WCAG:** [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) (Level A)

## Why it matters, and how to fix it

Without a role, VoiceOver and TalkBack read the label but don't say it's a button, link or tab, so users don't know they can activate it.

**Fix:** add `accessibilityRole="button"` (or `"link"`, `"tab"`, `"checkbox"`, …).

## Example

Before:

```tsx
<TouchableOpacity onPress={placeOrder}>
  <Text>Place order</Text>
</TouchableOpacity>
```

After:

```tsx
<Pressable accessibilityRole="button" onPress={placeOrder}>
  <Text>Place order</Text>
</Pressable>
```

## Configure

```ts
// v6y.config.ts
export default defineConfig({
  rules: { 'missing-role': 'warning' }, // or 'off'
});
```

To silence it for one element, with a reason:

```tsx
{/* v6y-ignore missing-role -- why this one is fine */}
```

[All rules](./README.md)
