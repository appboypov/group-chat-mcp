---
name: "⚙️ Session state management and dynamic agent resolution"
type: business-logic
order: "01A"
status: pending
labels: ["type:business-logic", "team:tools", "effort:average", "value:maximum"]
parent: "feature-00-cursor-hooks-support.md"
dependencies: []
skills: ["mcp-builder"]
---

Load the following skills before starting: `mcp-builder`

# ⚙️ Session state management and dynamic agent resolution

## 🛠️ Skills, tools & MCPs

- `mcp-builder` — MCP project patterns

## 🔗 Dependencies

- None (foundational issue)

## 🔀 Related Issues

- feature-00-cursor-hooks-support.md — parent feature (fetch for full context)
- business-logic-01B-check-inbox-tool.md — parallel sibling; independent work
- business-logic-02-cli-session-commands.md — depends on this issue for session state writing

---

## 📈 Data Flow Diagrams

```
Cursor sessionStart hook
      │
      ▼
CLI cursor-join command
      │
      ├── StateService.registerAgent() → agent UUID
      ├── StateService.joinConversation()
      └── SessionStateService.writeSessionAgent(pid, agentId)
              │
              ▼
      ~/.group-chat-mcp/sessions/{pid}.json
              │
              ▼
MCP Server (index.ts) tool handler
      │
      ├── SessionStateService.readSessionAgent(pid) → agentId
      └── handleToolCall(stateService, name, agentId, rawArgs)
```

---

## ⚙️ Services

### SessionStateService

**Purpose:** Manage per-process session state files that map an MCP server PID to the current active agent ID. Enables Cursor's long-lived MCP server process to serve multiple sequential chat sessions, each with its own agent.

#### Public Mutators

- [ ] `writeSessionAgent(pid: number, agentId: string, projectPath: string)`: void
    1. Write `{ pid, agentId, projectPath, updatedAt: Date.now() }` to `~/.group-chat-mcp/sessions/{pid}.json`
    2. Use atomic write (temp file + rename)

- [ ] `readSessionAgent(pid: number)`: `{ agentId: string; projectPath: string } | null`
    1. Read `~/.group-chat-mcp/sessions/{pid}.json`
    2. Return parsed data or null if file missing

- [ ] `clearSessionAgent(pid: number)`: void
    1. Delete `~/.group-chat-mcp/sessions/{pid}.json`
    2. Ignore ENOENT errors

- [ ] `reapStaleSessions()`: string[]
    1. Read all files in `~/.group-chat-mcp/sessions/`
    2. For each, check if PID is alive via `isProcessAlive()`
    3. Delete files for dead PIDs
    4. Return list of reaped PIDs

#### TDD Gherkin Tests

- [ ] `Given no session file exists When writeSessionAgent(1234, "abc", "/project") is called Then ~/.group-chat-mcp/sessions/1234.json contains { pid: 1234, agentId: "abc", projectPath: "/project" }`
- [ ] `Given session file exists for PID 1234 When readSessionAgent(1234) is called Then it returns the agentId and projectPath`
- [ ] `Given no session file for PID 5678 When readSessionAgent(5678) is called Then it returns null`
- [ ] `Given session file exists for PID 1234 When clearSessionAgent(1234) is called Then the file is deleted`
- [ ] `Given session files for PIDs [100, 200] where PID 100 is dead When reapStaleSessions() is called Then PID 100's file is deleted and ["100"] is returned`

---

## 📌 Constants

- [ ] **Storage Paths**
    - [ ] `SESSIONS_DIR` = `sessions` (added to `src/constants/storage.ts`)

---

## Modifications to index.ts

The MCP server's `CallToolRequestSchema` handler currently captures `agentId` in a closure at startup (line 50-51, 72). This must change to dynamic resolution:

1. At startup, register agent and write session state as before (for the initial session)
2. Replace the closure-captured `agentId` with a function call: `SessionStateService.readSessionAgent(process.pid)`
3. If session state returns null, fall back to the startup-registered agent ID
4. The cleanup function must also clear the session state file

Affected files:
- `src/index.ts` — dynamic agent resolution in tool handler
- `src/constants/storage.ts` — add `SESSIONS_DIR`
- New: `src/services/session-state-service.ts`

---

# Tests

## 🧪 TDD Gherkin Unit Tests

### SessionStateService

- [ ] `Given empty sessions directory When writeSessionAgent is called Then a JSON file named {pid}.json is created with correct content`
- [ ] `Given existing session file When readSessionAgent is called with matching PID Then it returns the stored agentId and projectPath`
- [ ] `Given no session file When readSessionAgent is called Then it returns null`
- [ ] `Given existing session file When clearSessionAgent is called Then the file is removed`
- [ ] `Given stale session file for dead PID When reapStaleSessions is called Then the file is deleted and PID is returned`

### Dynamic Agent Resolution in index.ts

- [ ] `Given a session state file exists for the current PID When a tool call arrives Then the agent ID from the session state file is used`
- [ ] `Given no session state file exists When a tool call arrives Then the startup-registered agent ID is used as fallback`
