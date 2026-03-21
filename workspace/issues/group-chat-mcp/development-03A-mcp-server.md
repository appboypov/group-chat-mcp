---
name: "🔧 MCP server, tools, and channel push"
type: development
order: "03A"
status: pending
labels: ["type:development", "team:tools", "effort:high", "value:maximum"]
parent: "feature-00-group-chat-mcp.md"
dependencies: ["business-logic-02-state-service.md"]
skills: ["mcp-builder"]
---

Load the following skills before starting: `mcp-builder`

# 🔧 MCP server, tools, and channel push

## 🔗 Dependencies

- [ ] business-logic-02-state-service.md — StateService and all data models must exist

## 🔀 Related Issues

- feature-00-group-chat-mcp.md — parent feature spec (fetch for full requirements and functional requirements table)
- business-logic-03B-cli-hooks.md — parallel sibling implementing CLI; shares StateService

---

## 🛠️ Skills, tools & MCPs

- `mcp-builder` — MCP server implementation patterns, channel capability setup, tool registration

---

# 🚀 End Goal

A working MCP server at `src/index.ts` that:
- Declares `experimental.claude/channel` capability
- Exposes 8 tools via MCP tool protocol
- Polls an inbox file for pending notifications
- Pushes notifications into the Claude Code session via channel notifications

### 📍 Currently

- Project scaffolded with stub index.ts
- StateService exists with all CRUD operations

### 🎯 Should

- `src/index.ts` is a complete MCP server that can be spawned by Claude Code
- All 8 tools are functional and use StateService
- Inbox polling runs on a configurable interval (default 2 seconds)
- Channel push delivers notifications as XML-tagged content

## 🔧 Non-Functional Considerations

- Polling interval configurable via environment variable `GC_POLL_INTERVAL_MS` (default 2000)
- Never use `console.log` — stdio transport uses stdout for JSON-RPC; use `console.error` for debug logging
- All tool handlers return structured text content

## ✅ Acceptance Criteria

- [ ] Server starts via `node dist/index.js` without errors
- [ ] Server declares `experimental.claude/channel` capability
- [ ] All 8 tools are listed when client requests tool list
- [ ] `list_conversations` returns conversations filtered by scope parameter
- [ ] `list_participants` returns active agents with profiles
- [ ] `send_message` to conversation ID adds message and writes to participant inboxes
- [ ] `send_message` to agent ID auto-creates DM conversation if none exists
- [ ] `get_conversation` returns full message history
- [ ] `update_profile` updates agent profile and notifies shared conversation participants
- [ ] `create_conversation` creates group conversation with name and topic
- [ ] `join_conversation` adds agent to conversation participants
- [ ] `leave_conversation` removes agent and archives if empty
- [ ] Inbox polling detects new notifications and pushes via `mcp.notification()`
- [ ] Channel notifications include conversation context in meta attributes

## ⚠️ Constraints

- [ ] Must use stdio transport (Claude Code spawns the server as subprocess)
- [ ] The server's own agent ID must be passed via environment variable `GC_AGENT_ID`
- [ ] No console.log — only console.error for debugging

---

## 🏗️ Components

- [ ] Create MCP Server instance with channel capability and tool capability
    - Server name: "group-chat-mcp"
    - Capabilities: `experimental: { 'claude/channel': {} }`, `tools: {}`
    - Instructions: system prompt explaining the channel format and available tools
- [ ] Register 8 tools with Zod input schemas
    - list_conversations (scope: 'project' | 'global' | 'all', optional)
    - list_participants (conversationId: optional)
    - send_message (conversationId: optional, agentId: optional, content: required) — one of conversationId or agentId required
    - get_conversation (conversationId: required)
    - update_profile (name: optional, role: optional, expertise: optional, status: optional)
    - create_conversation (name: required, topic: optional, type: 'group')
    - join_conversation (conversationId: required)
    - leave_conversation (conversationId: required)
- [ ] Implement inbox polling loop
    - setInterval at GC_POLL_INTERVAL_MS
    - Read inboxes/{agentId}.json
    - For each notification, call mcp.notification() with method 'notifications/claude/channel'
    - Clear inbox after processing
- [ ] Connect stdio transport

## ➡️ Requirements Flows

- Server startup: read GC_AGENT_ID from env → instantiate StateService → create Server → register tools → start inbox poll → connect transport
- Tool call: validate input via Zod → call StateService method → return formatted text result
- Inbox poll tick: read inbox file → if notifications exist → push each via channel notification → clear inbox
- Channel notification format: `{ method: 'notifications/claude/channel', params: { content: formatted message, meta: { conversationId, senderId, type } } }`

## ⚡️ Interactions

- MCP Client (Claude Code)
    - Interaction from Claude Code
        - When tool call received
        - Data Flow: JSON-RPC request → tool handler → StateService → JSON-RPC response
        - Triggers State Change: file-based state updated, inbox notifications written for other agents

- Inbox Poller
    - Interaction from setInterval timer
        - When poll tick fires
        - Data Flow: read inbox file → parse notifications → push via mcp.notification() → clear inbox
        - Triggers State Change: inbox cleared, Claude sees channel XML tags

## 🚦 States

- Server
    - Runtime
        - Starting (connecting transport)
        - Running (tools registered, polling active)
        - Error (transport disconnected)

## 🛠️ Behaviours

- Server
    - When GC_AGENT_ID is not set
        - Should exit with error message to stderr
    - When inbox file does not exist
        - Should skip poll tick silently
    - When inbox file contains notifications
        - Should push each notification, then clear the file
    - When tool input validation fails
        - Should return McpError with descriptive message

---

## 📦 Packages

- [ ] `@modelcontextprotocol/sdk` — Server, StdioServerTransport, request schemas
- [ ] `zod` — tool input validation

## ⚙️ Services

### ⚙️ InboxPollerService

#### State
- [ ] `intervalId`: NodeJS.Timeout — polling interval handle
- [ ] `agentId`: string — this agent's ID
- [ ] `pollIntervalMs`: number — poll frequency

#### Public Mutators
- [ ] `start(agentId: string, stateService: StateService, mcpServer: Server)`: void — begin polling
- [ ] `stop()`: void — clear interval

#### TDD Gherkin Tests
- [ ] `Given inbox has 2 notifications When poll tick fires Then mcp.notification is called twice and inbox is cleared`
- [ ] `Given inbox file does not exist When poll tick fires Then no notifications are pushed`

---

## 📌 Constants

- [ ] **Environment Variables**
    - [ ] `GC_AGENT_ID` — agent UUID passed by CLI/hook
    - [ ] `GC_POLL_INTERVAL_MS` — polling interval (default: 2000)

---

## 🔑 Key Decisions

1. Inbox-based push model
    - Context: Each MCP instance runs as a separate process with its own stdio connection
    - Rationale: File-based inboxes allow cross-process notification without IPC sockets
    - Impact: Each tool that generates notifications must write to all participant inboxes

2. Environment variable for agent ID
    - Context: The MCP server needs to know which agent it represents
    - Rationale: The CLI hook generates the UUID and passes it via env var when spawning or configuring the MCP
    - Impact: Hook must set GC_AGENT_ID before the MCP server starts

---

## 📋 Execution Steps

1. Read StateService implementation to understand the API surface
2. Create `src/constants/env.ts` for environment variable reading (GC_AGENT_ID, GC_POLL_INTERVAL_MS)
3. Create `src/services/inbox-poller.ts` implementing InboxPollerService
4. Create `src/index.ts` with:
   a. MCP Server instantiation with channel + tools capabilities
   b. Tool registration with Zod schemas for all 8 tools
   c. Tool handler implementations calling StateService
   d. InboxPollerService setup
   e. StdioServerTransport connection
5. Verify the server starts without errors: `node dist/index.js`
6. Verify tool list includes all 8 tools
