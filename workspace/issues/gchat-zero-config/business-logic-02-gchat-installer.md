---
name: "⚙️ gchat CLI installer for Claude Code and Cursor"
type: business-logic
order: "02"
status: pending
labels: ["type:business-logic", "team:tools", "effort:average", "value:high"]
parent: "story-00-zero-config-setup.md"
dependencies: ["refactor-01-self-registering-server.md"]
skills: ["mcp-builder"]
---

Load the following skills before starting: `mcp-builder`

# ⚙️ gchat CLI installer for Claude Code and Cursor

## 🔗 Dependencies

- [ ] refactor-01-self-registering-server.md — the MCP server config shape (env vars, args) must be finalized first

## 🔀 Related Issues

- story-00-zero-config-setup.md — parent story (fetch for full context)

---

## 🛠️ Skills, tools & MCPs

- `mcp-builder` — MCP server configuration patterns for different IDEs

---

## 📈 Data Flow Diagrams

```
User runs: gchat install
      │
      ├── Prompt: IDE? (Claude Code / Cursor / Both)
      ├── Prompt: Scope? (Global / Local project)
      │
      ├── Resolve dist/index.js path (from npm global install location)
      │
      ├── Read existing settings file (if any)
      ├── Merge group-chat-mcp entry into mcpServers
      └── Write updated settings file

User runs: gchat uninstall
      │
      ├── Prompt: IDE? (Claude Code / Cursor / Both)
      ├── Prompt: Scope? (Global / Local project)
      │
      ├── Read existing settings file
      ├── Remove group-chat-mcp entry from mcpServers
      └── Write updated settings file
```

---

## ⚙️ Services

### InstallerService

**Purpose:** Read, merge, and write MCP server configuration into IDE settings files.

InstallerService has zero user interaction. All prompts are handled by gchat.ts via PromptUtils, which passes resolved InstallOptions/UninstallOptions to InstallerService.

#### Public Mutators

- [ ] `install(options: InstallOptions)`: void — add group-chat-mcp to the target settings file
    1. Resolve the absolute path to `dist/index.js` from the npm global install location
    2. Create parent directory if missing: `fs.mkdir(path.dirname(settingsPath), { recursive: true })`
    3. Read the target settings file (create if missing)
    4. Validate parsed JSON is a plain object (`typeof === 'object' && !Array.isArray`). If malformed, fail with error: `'Settings file contains invalid JSON — fix manually before retrying'`
    5. Ensure `mcpServers` object exists. Validate `mcpServers` is a plain object if present
    6. Add `group-chat-mcp` entry with `command: "node"`, `args: [resolved path]`
    7. Write atomically: write to `.tmp` sibling, then `fs.rename` to target path

- [ ] `uninstall(options: UninstallOptions)`: void — remove group-chat-mcp from the target settings file
    1. Read the target settings file
    2. Validate parsed JSON is a plain object (`typeof === 'object' && !Array.isArray`). If malformed, fail with error: `'Settings file contains invalid JSON — fix manually before retrying'`
    3. Remove `group-chat-mcp` from `mcpServers`
    4. Write atomically: write to `.tmp` sibling, then `fs.rename` to target path (or skip if entry doesn't exist)

- [ ] `resolveServerPath()`: string — find the absolute path to dist/index.js
    1. Use `import.meta.url` with `fileURLToPath` (from `node:url`) and `path.dirname` to resolve the sibling `dist/index.js`
    2. Verify the file exists, error if not (user needs to rebuild)

- [ ] `resolveSettingsPath(ide: IDE, scope: Scope)`: string — determine the correct settings file path
    - Claude Code global: `path.join(os.homedir(), '.claude', 'settings.json')` (merge into existing, key: `mcpServers`)
    - Claude Code local: `.mcp.json` in cwd (standalone MCP config)
    - Cursor global: `path.join(os.homedir(), '.cursor', 'mcp.json')`
    - Cursor local: `.cursor/mcp.json` in cwd

#### TDD Gherkin Tests

- [ ] `Given no existing settings file When install is called for Claude Code global Then ~/.claude/settings.json is created with group-chat-mcp in mcpServers`
- [ ] `Given existing settings with other MCP servers When install is called Then group-chat-mcp is added without removing existing servers`
- [ ] `Given group-chat-mcp already installed When install is called Then the entry is updated (not duplicated)`
- [ ] `Given group-chat-mcp installed When uninstall is called Then the entry is removed and other servers remain`
- [ ] `Given no settings file When uninstall is called Then no error occurs`
- [ ] `Given a settings.json with existing non-MCP settings (allowedTools, permissions) When install is called Then all non-mcpServers keys are preserved unchanged`
- [ ] `Given dist/index.js does not exist at the resolved path When resolveServerPath is called Then an error is thrown`
- [ ] `Given Claude Code local scope When install is called Then .mcp.json is created in the current directory`
- [ ] `Given Cursor global scope When install is called Then ~/.cursor/mcp.json is created with the correct entry`
- [ ] `Given a settings file with invalid JSON When install is called Then an error is thrown with a message to fix the file manually`
- [ ] `Given the parent directory for the settings file does not exist When install is called Then the directory is created before writing`
- [ ] `Given install is called Then the group-chat-mcp entry has command "node" and args containing the absolute path to dist/index.js`
- [ ] `Given group-chat-mcp already exists with a different path When install is called Then exactly one entry exists with the updated path`

---

## 📦 DTOs

### InstallOptions

```yaml
name: InstallOptions
description: Configuration for the install command
fields:
  ide:
    description: Target IDE
    type: IDE enum
    required: true
  scope:
    description: Global or local project scope
    type: Scope enum
    required: true
```

### UninstallOptions

```yaml
name: UninstallOptions
description: Configuration for the uninstall command
fields:
  ide:
    description: Target IDE
    type: IDE enum
    required: true
  scope:
    description: Global or local project scope
    type: Scope enum
    required: true
```

---

## 🏷️ Enums

- [ ] **IDE**
    - [ ] `claudeCode`
    - [ ] `cursor`

- [ ] **Scope**
    - [ ] `global`
    - [ ] `local`

---

## 📌 Constants

- [ ] **Settings Paths**
    - [ ] `CLAUDE_CODE_GLOBAL` = `path.join(os.homedir(), '.claude', 'settings.json')`
    - [ ] `CLAUDE_CODE_LOCAL` = `.mcp.json`
    - [ ] `CURSOR_GLOBAL` = `path.join(os.homedir(), '.cursor', 'mcp.json')`
    - [ ] `CURSOR_LOCAL` = `.cursor/mcp.json`

- [ ] **MCP Config Shape**
    ```json
    {
      "mcpServers": {
        "group-chat-mcp": {
          "command": "node",
          "args": ["/absolute/path/to/dist/index.js"]
        }
      }
    }
    ```
    For Claude Code global settings, this merges into the existing settings object. For local `.mcp.json` and Cursor configs, this is the standalone shape.

---

## 🛠️ Utils

- [ ] **PromptUtils** — Interactive CLI prompts. Uses Node.js built-in `readline/promises` module (zero additional dependencies)
    - [ ] `selectIDE()`: IDE — ask user to pick Claude Code, Cursor, or Both
    - [ ] `selectScope()`: Scope — ask user to pick Global or Local
    - [ ] `confirm(message: string)`: boolean — yes/no confirmation

---

## Implementation Notes

### File structure

```
src/
├── gchat.ts                    (CLI entry point: gchat install | gchat uninstall)
│                                gchat.ts must include #!/usr/bin/env node as the first line for npm bin compatibility
├── services/
│   └── installer-service.ts    (InstallerService)
├── enums/
│   ├── ide.ts                  (IDE enum)
│   └── scope.ts                (Scope enum)
├── constants/
│   └── settings-paths.ts       (IDE settings file paths)
├── utils/
│   └── prompt-utils.ts         (PromptUtils: selectIDE, selectScope, confirm)
├── types/
│   ├── install-options.ts      (InstallOptions type)
│   └── uninstall-options.ts    (UninstallOptions type)
```

### package.json changes

Add to `bin`:
```json
{
  "bin": {
    "group-chat-mcp": "dist/cli.js",
    "gchat": "dist/gchat.js"
  }
}
```
Note: the old `'group-chat-mcp': 'dist/cli.js'` entry is removed by issue 03 (chore-03-cleanup-and-docs.md)

### CLI Commands

```bash
gchat install     # Interactive: prompts for IDE and scope, writes config
gchat uninstall   # Interactive: prompts for IDE and scope, removes config
```

### Settings file merge strategy

- Claude Code global (`~/.claude/settings.json`): file contains many settings beyond MCP. Read the full JSON, add/update only `mcpServers["group-chat-mcp"]`, write back. Never overwrite other keys.
- Claude Code local (`.mcp.json`): standalone MCP config. Can contain other servers. Read, merge, write.
- Cursor global (`~/.cursor/mcp.json`): standalone MCP config. Read, merge, write.
- Cursor local (`.cursor/mcp.json`): standalone MCP config. Read, merge, write.

### Resolving the server path

When installed globally via `npm install -g`, the package lives in npm's global prefix. The `gchat` binary is a symlink to `dist/gchat.js`. Use `import.meta.url` to resolve the sibling `index.js` in the same `dist/` directory.

---

# Tests

Test file: `tests/services/installer-service.test.ts`

## 🧪 TDD Gherkin Unit Tests

### InstallerService

- [ ] `Given no settings file exists When install is called for Claude Code global Then a new settings.json is created with the correct mcpServers entry`
- [ ] `Given a settings file with existing MCP servers When install is called Then group-chat-mcp is added alongside existing entries`
- [ ] `Given group-chat-mcp already exists in settings When install is called Then the entry is overwritten with the current path`
- [ ] `Given group-chat-mcp exists in settings When uninstall is called Then the entry is removed and all other settings are preserved`
- [ ] `Given no settings file exists When uninstall is called Then no error is thrown`
- [ ] `Given Cursor global scope When resolveSettingsPath is called Then the path is path.join(os.homedir(), '.cursor', 'mcp.json')`
- [ ] `Given Claude Code local scope When resolveSettingsPath is called Then the path is path.join(process.cwd(), '.mcp.json')`
- [ ] `Given a settings.json with existing non-MCP settings (allowedTools, permissions) When install is called Then all non-mcpServers keys are preserved unchanged`
- [ ] `Given dist/index.js does not exist at the resolved path When resolveServerPath is called Then an error is thrown`
- [ ] `Given Claude Code local scope When install is called Then .mcp.json is created in the current directory`
- [ ] `Given Cursor global scope When install is called Then ~/.cursor/mcp.json is created with the correct entry`
- [ ] `Given a settings file with invalid JSON When install is called Then an error is thrown with a message to fix the file manually`
- [ ] `Given the parent directory for the settings file does not exist When install is called Then the directory is created before writing`
- [ ] `Given install is called Then the group-chat-mcp entry has command "node" and args containing the absolute path to dist/index.js`
- [ ] `Given group-chat-mcp already exists with a different path When install is called Then exactly one entry exists with the updated path`

### CLI Entry Point

- [ ] `Given args ["install"] When parseCommand is called Then it returns { command: "install" }`
- [ ] `Given args [] (empty) When parseCommand is called Then it returns { error: "no-command" }`
- [ ] `Given args ["unknown"] When parseCommand is called Then it returns { error: "unknown-command" }`
