---
name: "🌱 Improve gchat installer to use Claude Code CLI for MCP registration"
type: enhancement
order: "01"
status: pending
labels: ["type:enhancement", "team:tools"]
parent: "none"
dependencies: []
skills: []
---

# 🌱 Improve gchat installer to use Claude Code CLI for MCP registration

## 🔗 Dependencies

None.

## 🔀 Related Issues

- workspace/issues/gchat-zero-config/business-logic-02-gchat-installer.md — original installer implementation

---

## 📋 OpenSpec change

- Unknown

## 🛠️ Skills, tools & MCPs

- None required beyond standard Node.js APIs

---

## ✨ Enhancement

The `gchat install` command currently writes raw JSON to Claude Code settings files (`~/.claude/settings.json` for global, `.mcp.json` for local). Claude Code has its own CLI for MCP server management: `claude mcp add/remove`. The installer must use this CLI for Claude Code installations instead of manipulating JSON files directly.

Cursor has no CLI equivalent — JSON file manipulation remains correct for Cursor.

## 💡 Motivation

Writing directly to `~/.claude/settings.json` does not register the MCP server properly with Claude Code. The server does not appear in `/mcp` and may not load correctly. The `claude mcp add` command is the documented and supported way to register MCP servers.

## 📦 Scope

### In scope
- [ ] Use `claude mcp add` / `claude mcp remove` for Claude Code installations
- [ ] Map `Scope.Global` to `--scope user` and `Scope.Local` to `--scope project`
- [ ] Remove Claude Code settings path constants (no longer needed)
- [ ] Keep Cursor JSON file approach unchanged
- [ ] Update tests

### Out of scope
- Adding a third "project" scope option to the enum
- Changing how Cursor installation works
- Modifying the PromptUtils prompts or CLI interface

## 📍 Current behavior

For Claude Code, `InstallerService.install()`:
1. Resolves the settings file path (`~/.claude/settings.json` or `.mcp.json`)
2. Reads the JSON file
3. Adds `group-chat-mcp` entry to `mcpServers`
4. Writes the JSON file atomically

For Claude Code, `InstallerService.uninstall()`:
1. Reads the settings file
2. Removes the `group-chat-mcp` entry
3. Writes the file atomically

## 🎯 Desired behavior

For Claude Code, `InstallerService.install()`:
1. Resolves the server path via `resolveServerPath()`
2. Maps `Scope.Global` → `user`, `Scope.Local` → `project`
3. Executes: `claude mcp add group-chat-mcp --scope <mapped-scope> -- node <serverPath>`
4. If the command fails (non-zero exit), throws with the stderr output

For Claude Code, `InstallerService.uninstall()`:
1. Maps scope as above
2. Executes: `claude mcp remove group-chat-mcp --scope <mapped-scope>`
3. If the command fails, throws with the stderr output (except: "not found" is not an error — treat as success)

For Cursor: no changes.

## ⚠️ Constraints

- `claude` CLI must be installed and on PATH. If `execSync` throws ENOENT, the error message must tell the user to install Claude Code CLI.
- `execSync` is acceptable here — the installer is an interactive CLI tool, not a hot path.
- The `--scope` flag mapping is: `Scope.Global` → `user`, `Scope.Local` → `project`.

## ✅ Acceptance criteria

- [ ] `gchat install` with Claude Code + Global runs `claude mcp add group-chat-mcp --scope user -- node <serverPath>` and succeeds
- [ ] `gchat install` with Claude Code + Local runs `claude mcp add group-chat-mcp --scope project -- node <serverPath>` and succeeds
- [ ] `gchat uninstall` with Claude Code + Global runs `claude mcp remove group-chat-mcp --scope user` and succeeds
- [ ] `gchat uninstall` with Claude Code + Local runs `claude mcp remove group-chat-mcp --scope project` and succeeds
- [ ] `gchat install` with Cursor + Global still writes to `~/.cursor/mcp.json` (unchanged)
- [ ] `gchat install` with Cursor + Local still writes to `.cursor/mcp.json` (unchanged)
- [ ] `CLAUDE_CODE_GLOBAL` and `CLAUDE_CODE_LOCAL` constants removed from `settings-paths.ts`
- [ ] If `claude` CLI is not found, error message says to install Claude Code CLI
- [ ] Existing Cursor tests pass without changes
- [ ] New tests verify Claude Code CLI invocation (test the command string construction, not actual CLI execution)
- [ ] `npm run build` succeeds
- [ ] `npm test` passes

## 📝 Suggested approach

- [ ] 1. Update `src/constants/settings-paths.ts`: remove `CLAUDE_CODE_GLOBAL` and `CLAUDE_CODE_LOCAL` exports. Only `CURSOR_GLOBAL` and `CURSOR_LOCAL` remain.
- [ ] 2. Add a private method to `InstallerService` that maps `Scope` to Claude Code's `--scope` value:
  ```typescript
  private claudeCodeScope(scope: Scope): string {
    return scope === Scope.Global ? 'user' : 'project';
  }
  ```
- [ ] 3. Add a private method to execute Claude CLI commands:
  ```typescript
  private execClaudeCli(args: string[]): void {
    try {
      execSync(['claude', ...args].join(' '), { stdio: 'pipe' });
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('Claude Code CLI not found. Install it from https://docs.anthropic.com/en/docs/claude-code');
      }
      const stderr = (err as { stderr?: Buffer })?.stderr?.toString() ?? '';
      throw new Error(`Claude CLI failed: ${stderr}`);
    }
  }
  ```
- [ ] 4. Update `install()`: branch on `options.ide`. For `IDE.ClaudeCode`, call `execClaudeCli(['mcp', 'add', 'group-chat-mcp', '--scope', this.claudeCodeScope(options.scope), '--', 'node', serverPath])`. For `IDE.Cursor`, keep existing JSON logic.
- [ ] 5. Update `uninstall()`: branch on `options.ide`. For `IDE.ClaudeCode`, call `execClaudeCli(['mcp', 'remove', 'group-chat-mcp', '--scope', this.claudeCodeScope(options.scope)])`. Catch and ignore "not found" errors. For `IDE.Cursor`, keep existing JSON logic.
- [ ] 6. Update `resolveSettingsPath()`: only handle Cursor cases. For Claude Code, this method is no longer called — but keep it functional by returning an empty string or throwing for Claude Code (since `gchat.ts` calls it for the success message). Alternative: update `gchat.ts` to skip the path display for Claude Code.
  Actually, cleaner approach: update `gchat.ts` to not call `resolveSettingsPath` for Claude Code. The success message for Claude Code should say something like `✓ Installed group-chat-mcp for Claude Code (user)` without a file path.
- [ ] 7. Update `src/gchat.ts`: after install/uninstall, for Claude Code, print the success message without a file path. For Cursor, keep the file path display.
- [ ] 8. Remove the `CLAUDE_CODE_GLOBAL` and `CLAUDE_CODE_LOCAL` imports from `installer-service.ts`.
- [ ] 9. Update `tests/services/installer-service.test.ts`:
  - Remove or update tests that test Claude Code JSON file writing
  - Add tests that verify the correct CLI command is constructed for each scope
  - Since we cannot execute `claude` CLI in tests, test the `claudeCodeScope` mapping and command construction. Make `execClaudeCli` overridable (protected or via dependency injection) in `TestInstallerService` so tests can capture the command without executing it.
- [ ] 10. Verify `npm run build` and `npm test` pass.

## 📚 References
- Claude Code MCP installation docs: `claude mcp add <name> --scope <scope> -- <command> [args...]`
- Scopes: `local` (default, project-specific private), `project` (shared .mcp.json), `user` (cross-project private)
