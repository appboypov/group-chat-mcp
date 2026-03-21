---
name: "⚙️ CLI entry point for hooks"
type: business-logic
order: "03B"
status: pending
labels: ["type:business-logic", "team:tools", "effort:low", "value:high"]
parent: "feature-00-group-chat-mcp.md"
dependencies: ["business-logic-02-state-service.md"]
skills: ["mcp-builder"]
---

Load the following skills before starting: `mcp-builder`

# ⚙️ CLI entry point for hooks

## 🔗 Dependencies

- [ ] business-logic-02-state-service.md — StateService and data models must exist

## 🔀 Related Issues

- feature-00-group-chat-mcp.md — parent feature spec (fetch for hook requirements)
- development-03A-mcp-server.md — parallel sibling; the MCP server reads state written by this CLI

---

## 🛠️ Skills, tools & MCPs

- `mcp-builder` — MCP project patterns

---

## 📈 Data Flow Diagrams

```
Claude Code Hook (SessionStart/SessionEnd)
      │
      ▼
  src/cli.ts (parsed command)
      │
      ├── "join" → StateService.registerAgent() + joinConversation()
      │             writes to agents.json, conversations.json, inboxes/
      │
      └── "leave" → StateService.unregisterAgent()
                     writes to agents.json, conversations.json, inboxes/
```

---

## ⚙️ Services

### CLI Command Handler

**Purpose:** Parse CLI arguments and execute join/leave operations via StateService. Called by Claude Code hooks.

#### Public Mutators

- [ ] `handleJoin(projectPath: string)`: void
    1. Call `stateService.registerAgent(projectPath)` → get agent with UUID
    2. Call `stateService.getOrCreateProjectConversation(projectPath)` → get conversation
    3. Call `stateService.joinConversation(agent.id, conversation.id)`
    4. Write system message: "{agent.id} joined the conversation"
    5. Write join notification to all participant inboxes
    6. Print agent ID to stdout (so the hook can capture it and set GC_AGENT_ID env var)

- [ ] `handleLeave(agentId: string)`: void
    1. Get agent's conversations from StateService
    2. For each conversation: call `stateService.leaveConversation(agentId, conversationId)`
    3. Write system message: "{agentId} left the conversation" to each
    4. Write leave notification to remaining participant inboxes
    5. Call `stateService.unregisterAgent(agentId)`

#### TDD Gherkin Tests

- [ ] `Given an empty project When handleJoin is called Then an agent is registered, a project conversation is created, and the agent is a participant`
- [ ] `Given agent X in conversation C When handleLeave(X) is called Then X is removed from C, a leave system message is written, and X is unregistered`

---

## 📌 Constants

- [ ] **CLI Commands**
    - [ ] `join` — register agent and join project conversation
    - [ ] `leave` — leave all conversations and unregister

---

## CLI Usage

```bash
# Called by SessionStart hook:
node dist/cli.js join --project /path/to/project
# Outputs: agent-uuid-here

# Called by SessionEnd hook:
node dist/cli.js leave --agent-id <uuid>
```

## Hook Configuration

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node /Users/codaveto/Repos/group-chat-mcp/dist/cli.js join --project $PWD",
            "timeout": 10
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node /Users/codaveto/Repos/group-chat-mcp/dist/cli.js leave --agent-id $GC_AGENT_ID",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

The SessionStart hook captures the stdout output (agent UUID) and the MCP server configuration uses `GC_AGENT_ID` environment variable.

MCP server entry in settings.json or .mcp.json:

```json
{
  "mcpServers": {
    "group-chat-mcp": {
      "command": "node",
      "args": ["/Users/codaveto/Repos/group-chat-mcp/dist/index.js"],
      "env": {
        "GC_AGENT_ID": "$GC_AGENT_ID"
      }
    }
  }
}
```

---

# Tests

## 🧪 TDD Gherkin Unit Tests

### CLI Join

- [ ] `Given project path "/project/a" When CLI join is called Then an agent UUID is printed to stdout`
- [ ] `Given project path "/project/a" When CLI join is called Then a project conversation exists with the agent as participant`

### CLI Leave

- [ ] `Given agent X in 2 conversations When CLI leave is called with X's ID Then X is removed from both conversations and unregistered`
- [ ] `Given agent X as sole participant in conversation C When CLI leave is called Then conversation C is archived`

---

## 📋 Execution Steps

1. Read StateService implementation to understand the API
2. Create `src/cli.ts` with:
   a. Argument parsing for `join --project <path>` and `leave --agent-id <uuid>`
   b. handleJoin implementation
   c. handleLeave implementation
   d. Error handling with stderr output
3. Add `"cli": "node dist/cli.js"` script to package.json
4. Build and verify: `node dist/cli.js join --project /tmp/test-project` outputs a UUID
5. Verify: `node dist/cli.js leave --agent-id <uuid-from-step-4>` completes without error
