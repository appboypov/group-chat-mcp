---
name: "🧪 Tests for Cursor hooks functionality"
type: test
order: "05"
status: pending
labels: ["type:test", "team:tools", "effort:average", "value:high"]
parent: "feature-00-cursor-hooks-support.md"
dependencies: ["business-logic-01A-session-state-management.md", "business-logic-01B-check-inbox-tool.md", "business-logic-02-cli-session-commands.md", "development-03-cursor-hook-script.md", "enhancement-04-installer-hooks-json.md"]
skills: ["mcp-builder"]
---

Load the following skills before starting: `mcp-builder`

# 🧪 Tests for Cursor hooks functionality

## 🔗 Dependencies

- [ ] business-logic-01A-session-state-management.md — SessionStateService must be implemented
- [ ] business-logic-01B-check-inbox-tool.md — check_inbox tool must be implemented
- [ ] business-logic-02-cli-session-commands.md — CLI cursor-join/cursor-leave must be implemented
- [ ] development-03-cursor-hook-script.md — Hook script must be implemented
- [ ] enhancement-04-installer-hooks-json.md — Installer hooks.json writing must be implemented

## 🔀 Related Issues

- feature-00-cursor-hooks-support.md — parent feature (fetch for full context)

---

## 🛠️ Skills, tools & MCPs

- `mcp-builder` — MCP project patterns

---

## 🎯 End Goal

Unit tests covering all new business logic from the Cursor hooks feature. Tests follow BDD Gherkin structure, verify states and outcomes, avoid mocks, and test isolated logic.

## 📎 Context

The existing test suite uses vitest (`npm run test` → `vitest run`). Tests are in `src/__tests__/`. The project already has tests for StateService and InstallerService. New tests follow the same patterns.

## 🧭 Test layers

- [x] Unit
- [ ] ~~Evals~~
- [ ] ~~Integration~~
- [ ] ~~End-to-end~~
- [ ] ~~UI flow verification~~

## ✅ Acceptance & completion

- [ ] All tests pass with `npm run test`
- [ ] Each test file covers one service/module
- [ ] Tests use real file system operations against temp directories (no mocks)
- [ ] Tests follow BDD Gherkin Given/When/Then structure in descriptions

## ⚠️ Constraints

- No mocks — isolate logic into services, use temp directories for file operations
- No testing of hardcoded string values
- No testing trivial getters/setters
- BDD Gherkin structure for test descriptions
- Business logic only — no UI tests

## Philosophy

Tests validate that each service produces correct states and outcomes. SessionStateService is tested against a temp directory. CLI commands are tested by calling the handler functions directly and verifying state changes. The hook script is tested by simulating stdin/stdout. The installer is tested by verifying file contents after install/uninstall.

---

## 🧪 Unit tests

### SessionStateService (`src/__tests__/session-state-service.test.ts`)

**Scope:** Session state file CRUD and stale session reaping

**Targets:** `src/services/session-state-service.ts`

- [ ] `Given empty sessions directory When writeSessionAgent(1234, "abc", "/project") is called Then sessions/1234.json contains the correct data`
- [ ] `Given session file for PID 1234 When readSessionAgent(1234) is called Then it returns { agentId, projectPath }`
- [ ] `Given no session file for PID 9999 When readSessionAgent(9999) is called Then it returns null`
- [ ] `Given session file for PID 1234 When clearSessionAgent(1234) is called Then the file no longer exists`
- [ ] `Given session files for dead and alive PIDs When reapStaleSessions() is called Then dead PID files are deleted and alive PID files remain`

### check_inbox Tool (`src/__tests__/check-inbox.test.ts`)

**Scope:** check_inbox tool handler logic

**Targets:** `src/services/tool-handlers.ts` (check_inbox case)

- [ ] `Given 3 notifications in agent's inbox When check_inbox tool is called Then all 3 are returned formatted`
- [ ] `Given 3 notifications in agent's inbox When check_inbox tool is called Then inbox is empty after the call`
- [ ] `Given empty inbox When check_inbox tool is called Then result contains "No new notifications."`

### CLI Session Commands (`src/__tests__/cli-session-commands.test.ts`)

**Scope:** handleCursorJoin and handleCursorLeave logic

**Targets:** `src/gchat.ts` (handleCursorJoin, handleCursorLeave)

- [ ] `Given empty state When handleCursorJoin("/project/a", 1234) is called Then an agent is registered and session state is written for PID 1234`
- [ ] `Given empty state When handleCursorJoin is called Then the agent is a participant in the project conversation`
- [ ] `Given agent X registered with PID 1234 When handleCursorLeave(1234) is called Then X is unregistered and session state is cleared`
- [ ] `Given no session state for PID 9999 When handleCursorLeave(9999) is called Then no error is thrown`
- [ ] `Given agent X in conversation with agent Y When handleCursorLeave is called for X Then Y has a leave notification in its inbox`

### Installer hooks.json (`src/__tests__/installer-hooks.test.ts`)

**Scope:** Installer writing and removing hooks.json entries

**Targets:** `src/services/installer-service.ts`

- [ ] `Given no existing hooks.json When install(Cursor, Global) is called Then hooks.json is created with sessionStart, sessionEnd, and beforeMCPExecution entries`
- [ ] `Given existing hooks.json with other hooks When install(Cursor, Global) is called Then group-chat-mcp entries are added and existing hooks are preserved`
- [ ] `Given hooks.json with group-chat-mcp entries When uninstall(Cursor, Global) is called Then group-chat-mcp entries are removed and other hooks are preserved`
- [ ] `Given Cursor install When mcp.json is written Then it includes GC_CLIENT_TYPE and GC_POLL_INTERVAL_MS in the env block`

---

## 📍 Current state

Existing test files in `src/__tests__/`:
- `state-service.test.ts` — tests for StateService
- `installer-service.test.ts` — tests for InstallerService
- Other existing tests

New test files to create follow the same patterns.

## 📂 Code, tests & artifacts

- @src/__tests__/ — existing test directory
- @src/services/session-state-service.ts — SessionStateService implementation
- @src/services/tool-handlers.ts — check_inbox handler
- @src/gchat.ts — CLI session commands
- @src/services/installer-service.ts — installer hooks.json logic
- @src/hooks/cursor-hook.ts — hook script
