<!-- Generated from packages/core/src/rules by `npm run docs`. Edit the rule, not this file. -->

# touch-target-size

**Touch targets must be large enough to hit reliably.**

| Preset | Level |
|---|---|
| `recommended` | error |
| `strict` | error |
| `wcag21-aa` | off |
| `wcag22-aa` | error |

**WCAG:** [2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) (Level AA)

## Why it matters, and how to fix it

Small targets are hard to hit for people with tremors or limited dexterity. WCAG 2.2 AA requires at least 24×24; Apple recommends 44×44pt and Material 48×48dp (reported as warnings).

**Fix:** increase padding, or add `hitSlop` to enlarge the touchable area without changing the layout. v6y counts `hitSlop`.

## Example

Before:

```tsx
<Pressable style={{ width: 20, height: 20 }} onPress={increment}>
```

After:

```tsx
// Grow the touchable area without changing the layout
<Pressable style={{ width: 32, height: 32 }} hitSlop={8} onPress={increment}>
```

## Options

| Option | Default | What it does |
|---|---|---|
| `minimum` | `24` | Hard minimum in pt/dp, reported at the rule's level (WCAG 2.2 AA is 24). |
| `platformGuidelines` | `true` | Also warn below the platform guideline (Apple 44pt, Material 48dp). |
| `ios` | `44` | Apple guideline in pt. |
| `android` | `48` | Material guideline in dp. |

## Configure

```ts
// v6y.config.ts
export default defineConfig({
  rules: { 'touch-target-size': ['error', { minimum: 24 }] }, // or 'off'
});
```

To silence it for one element, with a reason:

```tsx
{/* v6y-ignore touch-target-size -- why this one is fine */}
```

[All rules](./README.md)
