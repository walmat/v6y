<!-- Generated from packages/core/src/rules by `npm run docs`. Edit the rule, not this file. -->

# input-missing-label

**Text fields need a label, not just a placeholder.**

| Preset | Level |
|---|---|
| `recommended` | warning |
| `strict` | error |
| `wcag21-aa` | error |
| `wcag22-aa` | error |

**WCAG:** [3.3.2 Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions) (Level A), [4.1.2 Name, Role, Value](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value) (Level A)

## Why it matters, and how to fix it

A placeholder disappears as soon as the user types, and a visible label above a field isn't connected to it for screen readers unless you link them.

**Fix:** add `accessibilityLabel="Email"` to the input, or link it to its visible label with `accessibilityLabelledBy` / `aria-labelledby` (the label's `nativeID`).

## Example

Before:

```tsx
<TextInput placeholder="Email" />
```

After:

```tsx
<Text nativeID="email-label">Email</Text>
<TextInput accessibilityLabel="Email" aria-labelledby="email-label" />
```

## Options

| Option | Default | What it does |
|---|---|---|
| `allowPlaceholder` | `false` | Accept a placeholder as the only label. |

## Configure

```ts
// v6y.config.ts
export default defineConfig({
  rules: { 'input-missing-label': ['error', { allowPlaceholder: false }] }, // or 'off'
});
```

To silence it for one element, with a reason:

```tsx
{/* v6y-ignore input-missing-label -- why this one is fine */}
```

[All rules](./README.md)
