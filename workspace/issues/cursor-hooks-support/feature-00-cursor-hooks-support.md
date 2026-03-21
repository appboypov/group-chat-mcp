---
name: "✨ Cursor session lifecycle and hooks support"
type: feature
order: "00"
status: pending
labels: ["type:feature", "team:tools", "effort:high", "value:high"]
parent: none
dependencies: []
skills: ["mcp-builder"]
todos:
  - id: 01A
    content: "[01A] [business-logic] ⚙️ Session state management and dynamic agent resolution -> business-logic-01A-session-state-management.md"
    status: pending
  - id: 01B
    content: "[01B] [business-logic] ⚙️ check_inbox tool and client-aware polling fallback -> business-logic-01B-check-inbox-tool.md"
    status: pending
  - id: 02
    content: "[02] [business-logic] ⚙️ CLI session commands for Cursor hooks -> business-logic-02-cli-session-commands.md"
    status: pending
  - id: 03
    content: "[03] [development] 🔧 Cursor hook script -> development-03-cursor-hook-script.md"
    status: pending
  - id: 04
    content: "[04] [enhancement] 🌱 Installer writes hooks.json for Cursor -> enhancement-04-installer-hooks-json.md"
    status: pending
  - id: 05
    content: "[05] [test] 🧪 Tests for Cursor hooks functionality -> test-05-cursor-hooks-tests.md"
    status: pending
isProject: false
---

Load the following skills before starting: `mcp-builder`

# ✨ Cursor session lifecycle and hooks support

**Author:** codaveto
**Status:** 🟡 Draft
**Last updated:** 2026-03-21

## 📣 Executive summary

Cursor keeps MCP server processes alive across chat sessions. The current self-registering architecture in `index.ts` registers one agent at process startup and binds that agent ID into a closure for all tool calls. This works for Claude Code (which spawns a new process per conversation) but fails for Cursor where multiple sessions share one long-lived process.

Cursor agents need per-session lifecycle management via Cursor's hooks system (`.cursor/hooks.json`). On `sessionStart`, a hook registers a new agent and joins the project conversation. On `sessionEnd`, a hook leaves conversations and unregisters. A `beforeMCPExecution` hook auto-approves group-chat-mcp tools.

Additionally, `notifications/claude/channel` is Claude Code-specific. Cursor agents receive zero push notifications. A `check_inbox` tool and client-aware polling fallback are needed.

## 🎯 Goals & non-goals

### Goals
- [ ] Cursor agents get per-session agent registration and conversation join/leave via hooks
- [ ] Cursor agents can read incoming messages via a `check_inbox` tool
- [ ] The `gchat install` command writes both `mcp.json` and `hooks.json` for Cursor
- [ ] group-chat-mcp tools are auto-approved in Cursor via `beforeMCPExecution` hook

### Non-goals
- [ ] Implementing Cursor-native push notifications (no equivalent to `claude/channel` exists)
- [ ] Changing the Claude Code flow (it works correctly with process-per-conversation)
- [ ] Supporting other IDEs beyond Claude Code and Cursor

## 🗺️ User journeys

### 🔧 Journey: Cursor agent joins project chat

**Actor:** Cursor agent (AI)
**Trigger:** User starts a new Cursor chat session in a project with group-chat-mcp installed
**Happy path:**
1. Cursor fires `sessionStart` hook
2. Hook script calls CLI to register agent + join project conversation
3. Agent ID is written to session state file
4. MCP server reads session state file on each tool call to resolve current agent
5. Agent participates in group chat using MCP tools
6. User ends session, Cursor fires `sessionEnd` hook
7. Hook script calls CLI to leave conversations + unregister agent

**Edge / failure:** If hook script fails, agent falls back to the startup-registered agent ID. If session state file is missing, tools return an error asking the agent to check hook configuration.

**Maps to success criteria:** User success, Quality / reliability

### 🔧 Journey: Cursor agent checks for messages

**Actor:** Cursor agent (AI)
**Trigger:** Agent wants to see if other agents sent messages
**Happy path:**
1. Agent calls `check_inbox` tool
2. Tool reads inbox file for current agent
3. Returns all pending notifications (messages, joins, leaves, profile updates)
4. Inbox is cleared after read

**Edge / failure:** If no notifications exist, returns empty result.

**Maps to success criteria:** User success

## 📦 Scope

### In scope
- [ ] Session state file management (write/read current agent ID per MCP server process)
- [ ] Dynamic agent ID resolution in MCP server tool handler
- [ ] CLI `cursor-join` and `cursor-leave` commands
- [ ] Cursor hook script (`dist/hooks/cursor-hook.js`)
- [ ] `check_inbox` MCP tool for Cursor agents
- [ ] Client-aware inbox poller (skip for non-Claude Code clients)
- [ ] Installer writes `.cursor/hooks.json` alongside `.cursor/mcp.json`
- [ ] `beforeMCPExecution` hook for auto-approval of group-chat-mcp tools
- [ ] Configurable polling interval defaulting to 5000ms via `GC_POLL_INTERVAL_MS`
- [ ] Unit tests for all new business logic

### Out of scope
- [ ] Push notification mechanism for Cursor (no equivalent to `claude/channel`)
- [ ] Changes to Claude Code flow
- [ ] E2E tests or acceptance tests

## ⚙️ Functional requirements

| ID | Requirement | Priority (P0-P3) | Source journey |
|----|-------------|------------------|----------------|
| FR-001 | MCP server resolves agent ID dynamically from session state file on each tool call | P0 | Cursor agent joins project chat |
| FR-002 | CLI `cursor-join` registers agent, joins project conversation, writes session state | P0 | Cursor agent joins project chat |
| FR-003 | CLI `cursor-leave` leaves conversations, unregisters agent, clears session state | P0 | Cursor agent joins project chat |
| FR-004 | Hook script handles sessionStart, sessionEnd, and beforeMCPExecution events | P0 | Cursor agent joins project chat |
| FR-005 | `check_inbox` tool returns pending notifications and clears inbox | P0 | Cursor agent checks for messages |
| FR-006 | Inbox poller is skipped when client does not support `claude/channel` | P1 | Cursor agent checks for messages |
| FR-007 | Installer writes `.cursor/hooks.json` with all three hook entries | P0 | Cursor agent joins project chat |
| FR-008 | `GC_POLL_INTERVAL_MS` defaults to 5000ms in Cursor mcp.json env block | P1 | Cursor agent checks for messages |

## 🛡️ Non-functional requirements

| ID | Category | Requirement | Measure / validation |
|----|----------|-------------|----------------------|
| NFR-001 | Performance | Session state file read adds < 5ms per tool call | Benchmark with fs.readFile on local JSON |
| NFR-002 | Reliability | Atomic writes to session state file prevent corruption | Use temp file + rename pattern |
| NFR-003 | Reliability | Stale session state is cleaned up when MCP server process dies | PID check in session state file |

## 🔗 Dependencies & assumptions

### Dependencies
- [ ] Existing StateService (`src/services/state-service.ts`) for agent registration and conversation management
- [ ] Existing InstallerService (`src/services/installer-service.ts`) for Cursor mcp.json writing

### Assumptions
- [ ] Cursor fires `sessionStart` and `sessionEnd` hook events per chat session
- [ ] Cursor hooks receive JSON on stdin and return JSON on stdout
- [ ] Cursor's `beforeMCPExecution` hook can gate tool execution with `{ "permission": "allow" }`

## 🚦 Risks & open questions

| Item | Type | Likelihood | Impact | Mitigation / next step |
|------|------|------------|--------|-------------------------|
| Cursor may not fire sessionEnd reliably on crash/force-quit | Risk | 🟡 | 🟡 | Stale agent reaper already handles orphaned agents via PID checks |
| beforeMCPExecution auto-approval may not be respected by all Cursor versions | Risk | 🟡 | 🟢 | Users fall back to manual approval or global auto-run mode |

## 🔭 Traceability check

- [x] Every FR references a Source journey
- [x] Every journey maps to at least one Success criterion
- [x] NFRs are tied to real risk for this feature (not boilerplate)
- [x] Non-goals are explicit so scope creep is visible
