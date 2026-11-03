<!-- Generated from packages/core/src/rules by `npm run docs`. Edit the rule, not this file. -->

# nested-interactive

**Don't put pressable elements inside other pressable elements.**

| Preset | Level |
|---|---|
| `recommended` | error |
| `strict` | error |
| `wcag21-aa` | error |
| `wcag22-aa` | error |

**WCAG:** [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) (Level A)

## Why it matters, and how to fix it

A pressable inside another pressable (e.g. a "favorite" button inside a tappable card) is merged into its parent for screen readers. The inner action becomes unreachable with VoiceOver and TalkBack.

**Fix:** make them siblings. Or set `accessible={false}` on the outer element and expose the card's action separately, e.g. via `accessibilityActions`.

## Example

Before:

```tsx
<Pressable onPress={openProduct}>
  <Text>{product.name}</Text>
  <Pressable onPress={toggleFavorite}>…</Pressable>
</Pressable>
```

After:

```tsx
<View style={styles.row}>
  <Pressable accessibilityRole="button" onPress={openProduct}>
    <Text>{product.name}</Text>
  </Pressable>
  <Pressable accessibilityRole="togglebutton" accessibilityLabel={`Favorite ${product.name}`} onPress={toggleFavorite}>…</Pressable>
</View>
```

## Configure

```ts
// v6y.config.ts
export default defineConfig({
  rules: { 'nested-interactive': 'warning' }, // or 'off'
});
```

To silence it for one element, with a reason:

```tsx
{/* v6y-ignore nested-interactive -- why this one is fine */}
```

[All rules](./README.md)
