<!-- Generated from packages/core/src/rules by `npm run docs`. Edit the rule, not this file. -->

# duplicate-label

**Different controls on one screen should have different names.**

| Preset | Level |
|---|---|
| `recommended` | off |
| `strict` | warning |
| `wcag21-aa` | warning |
| `wcag22-aa` | warning |

**WCAG:** [2.4.6 Headings and Labels](https://www.w3.org/WAI/WCAG22/Understanding/headings-and-labels) (Level AA)

This rule uses a heuristic, so it can occasionally flag something that is fine. It is a warning, not an error, in every preset.

## Why it matters, and how to fix it

Five buttons all announced as "Delete" force screen reader users to guess which item each one affects. This is common in lists.

**Fix:** include the item in the label: `accessibilityLabel={`Delete ${item.name}`}`.

## Example

Before:

```tsx
<Pressable accessibilityRole="button" onPress={editAddress}><Text>Edit</Text></Pressable>
<Pressable accessibilityRole="button" onPress={editPayment}><Text>Edit</Text></Pressable>
```

After:

```tsx
<Pressable accessibilityRole="button" accessibilityLabel="Edit delivery address" onPress={editAddress}>
  <Text>Edit</Text>
</Pressable>
<Pressable accessibilityRole="button" accessibilityLabel="Edit payment method" onPress={editPayment}>
  <Text>Edit</Text>
</Pressable>
```

## Options

| Option | Default | What it does |
|---|---|---|
| `ignoreCase` | `true` | Treat "Delete" and "delete" as the same name. |
| `includeRepeated` | `false` | Also flag repeats from one list (the same row rendered many times). |

## Configure

```ts
// v6y.config.ts
export default defineConfig({
  rules: { 'duplicate-label': ['error', { ignoreCase: true }] }, // or 'off'
});
```

To silence it for one element, with a reason:

```tsx
{/* v6y-ignore duplicate-label -- why this one is fine */}
```

[All rules](./README.md)
