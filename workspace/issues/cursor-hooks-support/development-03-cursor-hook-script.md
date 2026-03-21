---
name: "🔧 Cursor hook script"
type: development
order: "03"
status: pending
labels: ["type:development", "team:tools", "effort:average", "value:maximum"]
parent: "feature-00-cursor-hooks-support.md"
dependencies: ["business-logic-02-cli-session-commands.md"]
skills: ["mcp-builder"]
---

Load the following skills before starting: `mcp-builder`

# 🔧 Cursor hook script

## 🔗 Dependencies

- [ ] business-logic-02-cli-session-commands.md — CLI `cursor-join` and `cursor-leave` commands must exist

## 🔀 Related Issues

- feature-00-cursor-hooks-support.md — parent feature (fetch for full context)
- enhancement-04-installer-hooks-json.md — depends on this issue; installer needs the hook script path

---

# 🚀 End Goal

A single Node.js script at `dist/hooks/cursor-hook.js` that Cursor executes for `sessionStart`, `sessionEnd`, and `beforeMCPExecution` hook events. The script reads JSON from stdin, determines the event type, performs the appropriate action, and writes JSON to stdout.

### 📍 Currently

No hook script exists. Cursor has no way to trigger per-session agent lifecycle.

### 🎯 Should

A compiled hook script handles all three Cursor hook events:
- `sessionStart` → calls `cursor-join` logic, returns agent info in `agent_message`
- `sessionEnd` → calls `cursor-leave` logic
- `beforeMCPExecution` → returns `{ "permission": "allow" }` for `group-chat-mcp` server

## ✅ Acceptance Criteria

- [ ] `dist/hooks/cursor-hook.js` exists after `npm run build`
- [ ] Given a sessionStart event on stdin with workspace_roots, the script registers an agent and returns `{ "permission": "allow", "agent_message": "Agent {id} joined project conversation {id}." }`
- [ ] Given a sessionEnd event on stdin, the script unregisters the agent and returns `{ "permission": "allow" }`
- [ ] Given a beforeMCPExecution event with server "group-chat-mcp", the script returns `{ "permission": "allow" }`
- [ ] Given a beforeMCPExecution event with a different server name, the script returns `{ "permission": "ask" }` (pass through to default Cursor behavior)
- [ ] The script handles errors gracefully: logs to stderr, returns `{ "permission": "allow" }` to avoid blocking the user

## ⚠️ Constraints

- [ ] Must read full JSON from stdin before processing (Cursor pipes it in one shot)
- [ ] Must write valid JSON to stdout (Cursor parses the response)
- [ ] Must not use interactive I/O (no prompts, no readline)
- [ ] Must exit with code 0 on success

---

## 🏗️ Components

- [ ] Parse stdin JSON and route by `hook_event_name`
    - `src/hooks/cursor-hook.ts` — entry point
    - Read all stdin into buffer
    - Parse as JSON
    - Switch on `hook_event_name`

- [ ] Handle `sessionStart`
    - Extract `workspace_roots[0]` as project path
    - Determine server PID from environment or parent process
    - Call `handleCursorJoin(projectPath, serverPid)` from gchat.ts (import directly, not subprocess)
    - Return `{ permission: "allow", agent_message: "Agent {agentId} joined..." }`

- [ ] Handle `sessionEnd`
    - Determine server PID
    - Call `handleCursorLeave(serverPid)` from gchat.ts
    - Return `{ permission: "allow" }`

- [ ] Handle `beforeMCPExecution`
    - Check `server` field in stdin JSON
    - If `server === "group-chat-mcp"`, return `{ permission: "allow" }`
    - Otherwise return `{ permission: "ask" }`

---

## ➡️ Requirements Flows

- Cursor fires hook event → stdin JSON piped to script
- Script reads stdin → parses JSON → routes by event name
- sessionStart: registers agent, writes session state, returns success JSON
- sessionEnd: unregisters agent, clears session state, returns success JSON
- beforeMCPExecution: checks server name, returns permission JSON
- Script exits with code 0

---

## 📦 Packages

- [ ] No new packages needed — uses existing Node.js built-ins and project imports

---

## 📌 Constants

- [ ] Hook event names: `sessionStart`, `sessionEnd`, `beforeMCPExecution`
- [ ] Server name for auto-approval: `group-chat-mcp`

---

## 📂 Relevant Artifacts

- @src/gchat.ts — CLI entry point with handleCursorJoin/handleCursorLeave
- @src/services/state-service.ts — agent registration and conversation management
- @src/services/session-state-service.ts — session state file management

---

## 📋 Execution Steps

1. Read `src/gchat.ts` to understand the existing CLI structure and the `handleCursorJoin`/`handleCursorLeave` functions
2. Create `src/hooks/cursor-hook.ts` with:
    a. Stdin reader that collects all input into a string
    b. JSON parser for the hook event
    c. Switch on `hook_event_name`
    d. sessionStart handler: extracts workspace_roots[0], calls join logic, outputs JSON
    e. sessionEnd handler: calls leave logic, outputs JSON
    f. beforeMCPExecution handler: checks server name, outputs permission JSON
    g. Error handler: catches all errors, logs to stderr, outputs safe JSON
3. Add `cursor-hook.ts` to the TypeScript build so it compiles to `dist/hooks/cursor-hook.js`
4. Update `tsconfig.json` if needed to include the hooks directory
5. Build and verify: `node dist/hooks/cursor-hook.js` with piped JSON inputs
6. Test each event type with manual stdin piping

---

# Tests

## 🧪 TDD Gherkin Unit Tests

### Hook Event Routing

- [ ] `Given stdin JSON with hook_event_name "sessionStart" When the hook script runs Then handleCursorJoin is called with the correct project path`
- [ ] `Given stdin JSON with hook_event_name "sessionEnd" When the hook script runs Then handleCursorLeave is called with the correct server PID`
- [ ] `Given stdin JSON with hook_event_name "beforeMCPExecution" and server "group-chat-mcp" When the hook script runs Then stdout contains { "permission": "allow" }`
- [ ] `Given stdin JSON with hook_event_name "beforeMCPExecution" and server "some-other-mcp" When the hook script runs Then stdout contains { "permission": "ask" }`

### Error Handling

- [ ] `Given invalid JSON on stdin When the hook script runs Then it logs to stderr and outputs { "permission": "allow" }`
- [ ] `Given sessionStart event but handleCursorJoin throws When the hook script runs Then it logs the error to stderr and outputs { "permission": "allow" }`
