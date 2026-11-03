<!-- Generated from packages/core/src/rules by `npm run docs`. Edit the rule, not this file. -->

# Rules

Every rule v6y checks, its level in each preset, and the WCAG success criteria it covers. Run `npx v6y rules` for the same table in your terminal.

| Rule | What it checks | `recommended` | `strict` | `wcag21-aa` | `wcag22-aa` | WCAG |
|---|---|---|---|---|---|---|
| [`missing-label`](./missing-label.md) | Interactive elements need an accessible name | error | error | error | error | 4.1.2 |
| [`meaningless-label`](./meaningless-label.md) | Labels should describe purpose, not implementation | warning | warning | warning | warning | 2.4.6 |
| [`image-missing-label`](./image-missing-label.md) | Images exposed to screen readers need a description | error | error | error | error | 1.1.1 |
| [`input-missing-label`](./input-missing-label.md) | Text fields need a label, not just a placeholder | warning | error | error | error | 3.3.2, 4.1.2 |
| [`duplicate-label`](./duplicate-label.md) | Different controls on one screen should have different names | off | warning | warning | warning | 2.4.6 |
| [`missing-role`](./missing-role.md) | Interactive elements should expose a role | warning | error | error | error | 4.1.2 |
| [`nested-interactive`](./nested-interactive.md) | Don't put pressable elements inside other pressable elements | error | error | error | error | 4.1.2 |
| [`state-not-exposed`](./state-not-exposed.md) | Toggles, checkboxes and tabs must expose their state | error | error | error | error | 4.1.2 |
| [`missing-heading`](./missing-heading.md) | Screens should have at least one heading | off | warning | warning | warning | 1.3.1, 2.4.6 |
| [`touch-target-size`](./touch-target-size.md) | Touch targets must be large enough to hit reliably | error | error | off | error | 2.5.8 |
| [`text-contrast`](./text-contrast.md) | Text must have sufficient contrast against its background | error | error | error | error | 1.4.3 |
| [`font-scaling-disabled`](./font-scaling-disabled.md) | Text must scale with the user's font size setting | error | error | error | error | 1.4.4 |

Automated checks catch a large share of accessibility problems, not all of them. Also test key flows with VoiceOver and TalkBack.
