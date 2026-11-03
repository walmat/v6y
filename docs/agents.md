# v6y for coding agents

Agents write a lot of React Native UI, and they make the same accessibility mistakes people do: icon buttons with no label, custom toggles that never say whether they're on. v6y gives an agent a way to check its own work: edit, re-run the tests, ask v6y what's wrong in the files it changed, fix, repeat.

It works through an MCP server, `npx v6y mcp`, that any MCP-capable agent can use. It needs `v6y` installed in the project (`npm i -D v6y`).

| Tool | What it does |
|---|---|
| `check_accessibility` | Issues in the files changed in the working tree (or since `base`, or staged), each with `file:line`, a fix and a docs link. Warns when a snapshot is older than the edits. |
| `explain_rule` | A rule's page: why it matters, how to fix it, before/after code, options. |
| `list_rules` | Every rule, its level in each preset and its WCAG criteria. |

Snapshots come from tests run with `V6Y_SNAPSHOTS=.v6y/snapshots` (any `expect(…).toBeAccessible()` records one) or from the app running with `withV6y()`.

## Claude Code

Install the plugin:

```
/plugin marketplace add walmat/v6y
/plugin install v6y@v6y
```

You get:
- **The MCP server**, started in your project.
- **A skill** that tells Claude when and how to check and fix accessibility.
- **A commit gate.** Before Claude runs `git commit`, the staged files are checked. If there are errors, the commit is blocked and Claude gets the issues to fix.

The gate only acts in projects with v6y and recorded snapshots. It doesn't affect commits you make yourself.

## Codex

```toml
# ~/.codex/config.toml
[mcp_servers.v6y]
command = "npx"
args = ["--no-install", "v6y", "mcp"]
```

## Cursor

```json
// .cursor/mcp.json
{
  "mcpServers": {
    "v6y": { "command": "npx", "args": ["--no-install", "v6y", "mcp"] }
  }
}
```

## Any agent: add this to AGENTS.md

```markdown
## Accessibility

This app uses v6y to check accessibility. After changing a screen or component:

1. Run its tests with `V6Y_SNAPSHOTS=.v6y/snapshots` (tests use `await expect(<Screen />).toBeAccessible()`; add one if a changed screen has none).
2. Run `npx v6y check .v6y/snapshots/*.json --changed` (or call the `check_accessibility` MCP tool).
3. Fix every error at the reported file:line, following its `fix:` line, and check again.

Never silence an issue with `{/* v6y-ignore rule -- reason */}` unless the element isn't user-facing, and always give the reason.
```

If your agent works in a different directory from the app (a monorepo), pass `projectDir` to `check_accessibility`. Claude Code's plugin uses `CLAUDE_PROJECT_DIR`.
