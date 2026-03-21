---
name: "🌱 Installer writes hooks.json for Cursor"
type: enhancement
order: "04"
status: pending
labels: ["type:enhancement", "team:tools", "effort:low", "value:high"]
parent: "feature-00-cursor-hooks-support.md"
dependencies: ["development-03-cursor-hook-script.md"]
skills: ["mcp-builder"]
---

Load the following skills before starting: `mcp-builder`

# 🌱 Installer writes hooks.json for Cursor

## 🔗 Dependencies

- [ ] development-03-cursor-hook-script.md — hook script must exist at `dist/hooks/cursor-hook.js`

## 🔀 Related Issues

- feature-00-cursor-hooks-support.md — parent feature (fetch for full context)
- business-logic-01B-check-inbox-tool.md — the `GC_CLIENT_TYPE` env var set by the installer enables client-aware polling

---

## 🛠️ Skills, tools & MCPs

- `mcp-builder` — MCP project patterns

---

## ✨ Enhancement

The `gchat install` command writes `.cursor/mcp.json` for Cursor but does not write `.cursor/hooks.json`. Without hooks, Cursor agents have no per-session lifecycle (join/leave) and must manually approve every tool call. The installer must write both files.

## 💡 Motivation

Cursor hooks are mandatory for group-chat-mcp to function in Cursor. Without them, the MCP server registers one agent at process startup and never updates it across chat sessions.

## 📦 Scope

### In scope
- [ ] Write `.cursor/hooks.json` (global or local, matching mcp.json scope) during `gchat install`
- [ ] Remove hook entries from `.cursor/hooks.json` during `gchat uninstall`
- [ ] Merge with existing hooks.json (preserve other hooks)
- [ ] Add `GC_CLIENT_TYPE=cursor` and `GC_POLL_INTERVAL_MS=5000` to Cursor's mcp.json env block
- [ ] Add hooks.json path constants to settings-paths.ts

### Out of scope
- Claude Code hooks (Claude Code uses process-per-conversation, no hooks needed)
- Testing the hooks themselves (covered by test-05)

## 📍 Current behavior

The installer writes only `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "group-chat-mcp": {
      "command": "node",
      "args": ["/path/to/dist/index.js"]
    }
  }
}
```

No hooks.json is written. No `GC_CLIENT_TYPE` or `GC_POLL_INTERVAL_MS` env vars are set.

## 🎯 Desired behavior

The installer writes `.cursor/mcp.json` with env vars:
```json
{
  "mcpServers": {
    "group-chat-mcp": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "GC_CLIENT_TYPE": "cursor",
        "GC_POLL_INTERVAL_MS": "5000"
      }
    }
  }
}
```

AND writes `.cursor/hooks.json`:
```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [
      {
        "command": "node /path/to/dist/hooks/cursor-hook.js",
        "timeout": 10
      }
    ],
    "sessionEnd": [
      {
        "command": "node /path/to/dist/hooks/cursor-hook.js",
        "timeout": 5
      }
    ],
    "beforeMCPExecution": [
      {
        "command": "node /path/to/dist/hooks/cursor-hook.js",
        "timeout": 5,
        "matcher": "MCP:group-chat-mcp"
      }
    ]
  }
}
```

The uninstaller removes group-chat-mcp hook entries from hooks.json without disturbing other hooks.

## ⚠️ Constraints

- Merge with existing hooks.json — do not overwrite other hooks
- Use atomic write (temp file + rename) for hooks.json
- The hook script path must be absolute (resolved from the installed package location)
- `beforeMCPExecution` uses `matcher: "MCP:group-chat-mcp"` to only trigger for this server's tools

## ✅ Acceptance criteria

- [ ] `gchat install` with Cursor selected writes both mcp.json and hooks.json
- [ ] mcp.json includes `GC_CLIENT_TYPE: "cursor"` and `GC_POLL_INTERVAL_MS: "5000"` in env
- [ ] hooks.json contains sessionStart, sessionEnd, and beforeMCPExecution entries pointing to the hook script
- [ ] `gchat uninstall` with Cursor selected removes group-chat-mcp entries from both files
- [ ] Existing hooks in hooks.json are preserved during install and uninstall
- [ ] Hook script path is absolute and correct

## 📝 Suggested approach

1. Read `src/constants/settings-paths.ts` — add `CURSOR_HOOKS_GLOBAL` and `CURSOR_HOOKS_LOCAL()` constants
2. Read `src/services/installer-service.ts` — understand Cursor install/uninstall flow
3. Update `install()` for Cursor:
    a. Add `env` block to mcp.json server entry with `GC_CLIENT_TYPE` and `GC_POLL_INTERVAL_MS`
    b. Resolve hook script path: `path.join(distDir, 'hooks', 'cursor-hook.js')`
    c. Read or create hooks.json
    d. Merge group-chat-mcp hook entries into the hooks object
    e. Write hooks.json atomically
4. Update `uninstall()` for Cursor:
    a. Read hooks.json
    b. Remove group-chat-mcp entries from each hook event array (match by command containing "cursor-hook.js")
    c. Write hooks.json atomically
5. Add `resolveHooksPath(ide, scope)` method to InstallerService
6. Build and verify: `gchat install` → check both files exist with correct content
7. Verify: `gchat uninstall` → check entries are removed, other hooks preserved

## Affected Files

- `src/constants/settings-paths.ts` — add hooks.json path constants
- `src/services/installer-service.ts` — write/remove hooks.json entries, add env to mcp.json
