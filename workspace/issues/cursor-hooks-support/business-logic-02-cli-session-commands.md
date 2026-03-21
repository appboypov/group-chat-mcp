---
name: "⚙️ CLI session commands for Cursor hooks"
type: business-logic
order: "02"
status: pending
labels: ["type:business-logic", "team:tools", "effort:average", "value:maximum"]
parent: "feature-00-cursor-hooks-support.md"
dependencies: ["business-logic-01A-session-state-management.md"]
skills: ["mcp-builder"]
---

Load the following skills before starting: `mcp-builder`

# ⚙️ CLI session commands for Cursor hooks

## 🛠️ Skills, tools & MCPs

- `mcp-builder` — MCP project patterns

## 🔗 Dependencies

- [ ] business-logic-01A-session-state-management.md — SessionStateService must exist for writing/reading session agent IDs

## 🔀 Related Issues

- feature-00-cursor-hooks-support.md — parent feature (fetch for full context)
- development-03-cursor-hook-script.md — depends on this issue; the hook script calls these CLI commands

---

## 📈 Data Flow Diagrams

```
Cursor sessionStart hook
      │
      ▼
gchat cursor-join --project /path --server-pid 12345
      │
      ├── StateService.init()
      ├── StateService.reapStaleAgents()
      ├── StateService.registerAgent(projectPath) → agent
      ├── StateService.getOrCreateProjectConversation(projectPath) → conversation
      ├── StateService.joinConversation(agent.id, conversation.id)
      ├── StateService.addMessage(conversationId, agentId, "joined", "system")
      ├── writeNotificationToParticipants(Join)
      ├── SessionStateService.writeSessionAgent(serverPid, agent.id, projectPath)
      └── stdout: JSON { agentId: "uuid", conversationId: "uuid" }

Cursor sessionEnd hook
      │
      ▼
gchat cursor-leave --server-pid 12345
      │
      ├── StateService.init()
      ├── SessionStateService.readSessionAgent(serverPid) → { agentId, projectPath }
      ├── For each conversation:
      │   ├── StateService.addMessage(convId, agentId, "left", "system")
      │   └── writeNotificationToParticipants(Leave)
      ├── StateService.unregisterAgent(agentId)
      └── SessionStateService.clearSessionAgent(serverPid)
```

---

## ⚙️ Services

### CLI Command Handler (in gchat.ts)

**Purpose:** Handle `cursor-join` and `cursor-leave` commands called by Cursor hooks. These commands manage per-session agent lifecycle for Cursor's long-lived MCP server process.

#### Public Mutators

- [ ] `handleCursorJoin(projectPath: string, serverPid: number)`: void
    1. Initialize StateService
    2. Reap stale agents
    3. Call `stateService.registerAgent(projectPath)` → get agent
    4. Call `stateService.getOrCreateProjectConversation(projectPath)` → get conversation
    5. Call `stateService.joinConversation(agent.id, conversation.id)`
    6. Write system message: "{agent.id} joined the conversation."
    7. Write join notification to all participant inboxes
    8. Call `sessionStateService.writeSessionAgent(serverPid, agent.id, projectPath)`
    9. Print JSON to stdout: `{ "agentId": agent.id, "conversationId": conversation.id }`

- [ ] `handleCursorLeave(serverPid: number)`: void
    1. Initialize StateService
    2. Call `sessionStateService.readSessionAgent(serverPid)` → get agentId
    3. If null, exit silently (no session to clean up)
    4. Get agent from StateService
    5. For each conversation the agent is in:
        a. Write system message: "{name} left the conversation."
        b. Write leave notification to remaining participants
    6. Call `stateService.unregisterAgent(agentId)`
    7. Call `sessionStateService.clearSessionAgent(serverPid)`

#### CLI Argument Parsing

Extend the existing `parseCommand` in `gchat.ts`:

```
gchat cursor-join --project <path> --server-pid <pid>
gchat cursor-leave --server-pid <pid>
```

- `--project` is required for `cursor-join` (absolute path to project directory)
- `--server-pid` is required for both (the PID of the running MCP server process)

#### TDD Gherkin Tests

- [ ] `Given an empty project path When handleCursorJoin is called Then an agent is registered, a project conversation exists, the agent is a participant, and session state is written`
- [ ] `Given agent X in conversation C When handleCursorLeave is called with X's server PID Then X is removed from C, a leave system message is written, X is unregistered, and session state is cleared`
- [ ] `Given no session state for PID 9999 When handleCursorLeave is called with PID 9999 Then it exits without error`

---

## 📌 Constants

- [ ] **CLI Commands** (extend existing in `gchat.ts`)
    - [ ] `cursor-join` — register agent, join project conversation, write session state
    - [ ] `cursor-leave` — leave conversations, unregister agent, clear session state

---

## Affected Files

- `src/gchat.ts` — add `cursor-join` and `cursor-leave` commands, extend `parseCommand`
- `src/types/parse-result.ts` — extend ParseResult to include new commands

---

# Tests

## 🧪 TDD Gherkin Unit Tests

### CLI cursor-join

- [ ] `Given project path "/project/a" and server PID 1234 When cursor-join is called Then an agent UUID is printed to stdout as JSON`
- [ ] `Given project path "/project/a" and server PID 1234 When cursor-join is called Then a project conversation exists with the agent as participant`
- [ ] `Given project path "/project/a" and server PID 1234 When cursor-join is called Then session state file for PID 1234 contains the agent ID`
- [ ] `Given project path "/project/a" with existing conversation and 1 participant When cursor-join is called Then a join notification is written to the existing participant's inbox`

### CLI cursor-leave

- [ ] `Given agent X in 2 conversations with server PID 1234 When cursor-leave is called with PID 1234 Then X is removed from both conversations and unregistered`
- [ ] `Given agent X as sole participant in conversation C When cursor-leave is called Then conversation C is archived`
- [ ] `Given no session state for PID 5678 When cursor-leave is called with PID 5678 Then it exits without error`
- [ ] `Given agent X in conversation C with agent Y When cursor-leave is called for X Then Y receives a leave notification`
