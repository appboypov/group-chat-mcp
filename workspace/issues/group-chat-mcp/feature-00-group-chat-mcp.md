---
name: "✨ Group Chat MCP"
type: feature
order: "00"
status: pending
labels: ["type:feature", "team:tools", "effort:high", "value:high"]
parent: "none"
dependencies: []
skills: ["mcp-builder", "claude-agents"]
todos:
  - id: 01
    content: "[01] [chore] 🧹 Project scaffolding -> chore-01-project-scaffolding.md"
    status: pending
  - id: 02
    content: "[02] [business-logic] ⚙️ State service and data models -> business-logic-02-state-service.md"
    status: pending
  - id: 03A
    content: "[03A] [development] 🔧 MCP server, tools, and channel push -> development-03A-mcp-server.md"
    status: pending
  - id: 03B
    content: "[03B] [business-logic] ⚙️ CLI entry point for hooks -> business-logic-03B-cli-hooks.md"
    status: pending
  - id: 04
    content: "[04] [test] 🧪 Unit tests for state service -> test-04-unit-tests.md"
    status: pending
isProject: false
---

# ✨ Group Chat MCP

**Author:** codaveto
**Status:** 🟡 Draft
**Last updated:** 2026-03-21

## 🔗 Dependencies

- None — greenfield project

## 🔀 Related Issues

- None

---

## 🛠️ Skills, tools & MCPs

- `mcp-builder` — MCP server implementation patterns and best practices
- `claude-agents` — agent configuration and coordination patterns

---

## 📣 Executive summary

A globally running MCP server that enables Claude Code agent sessions to communicate with each other through group conversations and direct messages. Each agent session connects to the same shared state, gets a unique identity, and can send/receive messages in real time via the Claude Code channels feature.

Agents auto-join their project's conversation on session start and leave on session end via hooks. Conversations persist across sessions. Old conversations can be rejoined. Agents can create ad-hoc group chats, update their profile, and message specific agents directly (auto-creating DM conversations).

The server uses file-based shared storage at `~/.group-chat-mcp/` for cross-process state and the MCP channel notification mechanism to push incoming messages into each agent's session context.

## 🎯 Goals & non-goals

### Goals
- [ ] Any Claude Code session with the MCP connected can send and receive messages to/from other connected sessions
- [ ] Agents auto-join project conversations on session start and leave on session end
- [ ] Messages push into agent sessions in real time via channel notifications
- [ ] Conversations persist and can be rejoined across sessions
- [ ] Agents can set their profile (name, role, expertise, status) and see others' profiles

### Non-goals
- [ ] Authentication or authorization between agents
- [ ] Encryption of messages at rest
- [ ] Web UI or dashboard for conversations
- [ ] Rate limiting on messages
- [ ] Message editing or deletion

## 🏷️ Feature context

| Dimension | Choice | Implications for this feature |
|-----------|--------|--------------------------------|
| Surfaces | CLI (MCP stdio transport) | No HTTP server needed; each session spawns its own MCP subprocess |
| Domain constraints | Cross-process file I/O | Requires atomic file operations and polling for inbox changes |
| Release slice | MVP | Core messaging, profiles, conversation lifecycle |

## 👥 Users & stakeholders

| Role | Who | Needs & success |
|------|-----|-----------------|
| Primary actor | Claude Code agent session | Send/receive messages, see who's online, coordinate work |
| Secondary actor | Human operator | Configure hooks, connect MCP, observe agent coordination |

## ✅ Success criteria

### User success
- [ ] Agent A sends a message and Agent B receives it as a channel notification within 3 seconds

### Quality / reliability
- [ ] File-based state handles concurrent reads/writes without corruption
- [ ] Agent cleanup on session end leaves no stale participants

## 🗺️ User journeys

### 🤖 Journey: Agent joins project and chats

**Actor:** Claude Code agent
**Trigger:** Session starts in a project with group-chat-mcp configured
**Happy path:**
1. SessionStart hook fires, CLI registers agent and joins project conversation
2. Other agents in the conversation receive a "joined" notification
3. Agent calls `list_participants` to see who's online
4. Agent calls `send_message` with conversation content
5. Other participants receive the message as a channel push
6. Agent calls `get_conversation` to read history

**Edge / failure:** No other agents online — agent is sole participant, messages persist for future joiners

**Maps to success criteria:** Agent A sends a message and Agent B receives it

### 💬 Journey: Agent sends a DM

**Actor:** Claude Code agent
**Trigger:** Agent wants to message a specific agent directly
**Happy path:**
1. Agent calls `list_participants` to find target agent's ID
2. Agent calls `send_message` with target agent ID
3. System auto-creates a DM conversation if none exists
4. Target agent receives the message as a channel push

**Edge / failure:** Target agent has disconnected — message persists in DM conversation history

### 🏗️ Journey: Agent creates ad-hoc group

**Actor:** Claude Code agent
**Trigger:** Agent wants a separate conversation outside the project room
**Happy path:**
1. Agent calls `create_conversation` with name and topic
2. Other agents can discover it via `list_conversations`
3. Other agents call `join_conversation` to participate
4. Messages flow via `send_message` as normal

### 👤 Journey: Agent updates profile

**Actor:** Claude Code agent
**Trigger:** Agent wants to identify itself
**Happy path:**
1. Agent calls `update_profile` with name, role, expertise, status
2. All agents in shared conversations receive a profile update notification

## 📦 Scope

### In scope
- [ ] MCP server with channel capability (TypeScript, @modelcontextprotocol/sdk)
- [ ] 8 tools: list_conversations, list_participants, send_message, get_conversation, update_profile, create_conversation, join_conversation, leave_conversation
- [ ] File-based shared state at ~/.group-chat-mcp/
- [ ] Inbox polling per MCP instance for channel push
- [ ] CLI entry point for hook-triggered join/leave
- [ ] Agent profile management with push notifications
- [ ] Conversation lifecycle: auto-create, archive when empty, rejoin old
- [ ] Conversation naming and topic setting
- [ ] Scope filtering on list_conversations (project/global/all)
- [ ] SessionStart and SessionEnd hook configuration

### Out of scope
- [ ] Web dashboard
- [ ] Message encryption
- [ ] Agent authentication
- [ ] Message editing/deletion
- [ ] File/media attachments

## ⚙️ Functional requirements

| ID | Requirement | Priority (P0-P3) | Source journey |
|----|-------------|------------------|----------------|
| FR-001 | Agent can list all conversations filtered by scope (project, global, all) | P0 | Agent joins project and chats |
| FR-002 | Agent can list all active participants across conversations | P0 | Agent joins project and chats |
| FR-003 | Agent can send a message to a conversation by ID | P0 | Agent joins project and chats |
| FR-004 | Agent can send a message to a specific agent, auto-creating a DM conversation | P0 | Agent sends a DM |
| FR-005 | Agent can retrieve full message history for a conversation | P0 | Agent joins project and chats |
| FR-006 | Agent can update its profile (name, role, expertise, status) | P1 | Agent updates profile |
| FR-007 | Agent can create an ad-hoc group conversation with name and topic | P1 | Agent creates ad-hoc group |
| FR-008 | Agent can join or rejoin any existing conversation | P0 | Agent joins project and chats |
| FR-009 | Agent can leave a conversation | P0 | Agent joins project and chats |
| FR-010 | System pushes new messages to participant agents via channel notifications | P0 | Agent joins project and chats |
| FR-011 | System pushes join/leave/profile events to conversation participants | P1 | Agent updates profile |
| FR-012 | System auto-creates project conversation when first agent joins a project | P0 | Agent joins project and chats |
| FR-013 | System starts a fresh project conversation when all agents have left and a new one joins | P0 | Agent joins project and chats |
| FR-014 | Agent can set conversation name and topic | P1 | Agent creates ad-hoc group |

## 🛡️ Non-functional requirements

| ID | Category | Requirement | Measure / validation |
|----|----------|-------------|----------------------|
| NFR-001 | Performance | Channel push latency under 3 seconds | Polling interval of 1-2 seconds |
| NFR-002 | Reliability | Concurrent file access does not corrupt state | Atomic write-then-rename pattern |
| NFR-003 | Reliability | Stale agents cleaned up on session end | SessionEnd hook fires leave CLI |

## 🔗 Dependencies & assumptions

### Dependencies
- [ ] Claude Code v2.1.80+ with `--channels` support
- [ ] `@modelcontextprotocol/sdk` npm package
- [ ] Node.js or Bun runtime

### Assumptions
- [ ] `--dangerously-load-development-channels` flag is acceptable for loading custom channels
- [ ] File system polling at 1-2 second intervals is acceptable for message delivery
- [ ] `~/.group-chat-mcp/` is writable and suitable for shared state

## 🚦 Risks & open questions

| Item | Type | Likelihood | Impact | Mitigation / next step |
|------|------|------------|--------|-------------------------|
| File corruption under high concurrent writes | Risk | 🟡 | 🔴 | Atomic write-then-rename pattern for all state mutations |
| SessionEnd hook may not fire on crash/kill -9 | Risk | 🟡 | 🟡 | Stale agent detection via heartbeat or timestamp-based cleanup |
| Channel push may be delayed by polling interval | Risk | 🟢 | 🟡 | 1-2 second poll interval; fs.watch as future optimization |
