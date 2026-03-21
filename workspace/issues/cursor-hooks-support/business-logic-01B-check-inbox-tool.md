---
name: "⚙️ check_inbox tool and client-aware polling fallback"
type: business-logic
order: "01B"
status: pending
labels: ["type:business-logic", "team:tools", "effort:average", "value:high"]
parent: "feature-00-cursor-hooks-support.md"
dependencies: []
skills: ["mcp-builder"]
---

Load the following skills before starting: `mcp-builder`

# ⚙️ check_inbox tool and client-aware polling fallback

## 🛠️ Skills, tools & MCPs

- `mcp-builder` — MCP project patterns

## 🔗 Dependencies

- None (independent of session state work)

## 🔀 Related Issues

- feature-00-cursor-hooks-support.md — parent feature (fetch for full context)
- business-logic-01A-session-state-management.md — parallel sibling; independent work

---

## 📈 Data Flow Diagrams

```
Cursor Agent
      │
      ▼
MCP Tool: check_inbox
      │
      ├── StateService.getInbox(agentId) → Notification[]
      ├── Format notifications as readable text
      ├── StateService.clearInbox(agentId)
      └── Return formatted notifications

Claude Code Agent
      │
      ▼
InboxPollerService (existing)
      │
      ├── Reads inbox file
      ├── Pushes via notifications/claude/channel ✅
      └── Clears inbox
```

---

## ⚙️ Services

### check_inbox Tool Handler

**Purpose:** Provide Cursor agents with a manual polling mechanism to read pending notifications. Claude Code agents use the inbox poller with `claude/channel` push; Cursor agents call this tool.

The tool:
1. Reads all pending notifications from the agent's inbox file
2. Formats them as readable text (same format as `formatNotificationContent` in `inbox-poller.ts`)
3. Clears the inbox after reading
4. Returns the formatted notifications or "No new notifications." if empty

#### Tool Schema

```typescript
{
  name: 'check_inbox',
  description: 'Check for new messages and notifications from other agents. Use this tool periodically (every few seconds) to stay updated on conversation activity. Returns all pending notifications and clears the inbox.',
  inputSchema: {
    type: 'object',
    properties: {},
  },
}
```

#### Tool Handler Logic

```
case 'check_inbox': {
  const notifications = await stateService.getInbox(agentId);
  if (notifications.length === 0) {
    return textResult('No new notifications.');
  }
  const lines = notifications.map(formatNotificationContent);
  await stateService.clearInbox(agentId);
  return textResult(`${notifications.length} notification(s):\n${lines.join('\n')}`);
}
```

#### TDD Gherkin Tests

- [ ] `Given 3 pending notifications in agent's inbox When check_inbox is called Then all 3 are returned formatted and inbox is cleared`
- [ ] `Given empty inbox When check_inbox is called Then "No new notifications." is returned`

---

## Client-Aware Inbox Poller

**Purpose:** Detect whether the connected client supports `claude/channel` notifications. If not, skip starting the inbox poller entirely (it would silently fail anyway).

Detection approach: Check if the server's capabilities include `experimental: { 'claude/channel': {} }` AND the client declared support for it during initialization. The simplest approach: add a `GC_CLIENT_TYPE` env var that the installer sets. Claude Code config gets `GC_CLIENT_TYPE=claude-code`, Cursor config gets `GC_CLIENT_TYPE=cursor`.

In `index.ts`, conditionally start the poller:

```typescript
const clientType = process.env.GC_CLIENT_TYPE;
if (clientType !== 'cursor') {
  inboxPoller.start(agentId, GC_POLL_INTERVAL_MS, server, BASE_DIR);
}
```

The `GC_POLL_INTERVAL_MS` default changes to 5000ms when set in the Cursor mcp.json env block by the installer.

---

## 📌 Constants

- [ ] **Environment Variables** (add to `src/constants/env.ts`)
    - [ ] `GC_CLIENT_TYPE` = `process.env.GC_CLIENT_TYPE` (string | undefined)

---

## Affected Files

- `src/schemas/tool-schemas.ts` — add `CheckInboxArgsSchema` and `check_inbox` tool definition
- `src/services/tool-handlers.ts` — add `check_inbox` case, extract `formatNotificationContent` from `inbox-poller.ts` to shared location
- `src/services/inbox-poller.ts` — move `formatNotificationContent` to shared utils
- `src/index.ts` — conditional poller start based on `GC_CLIENT_TYPE`
- `src/constants/env.ts` — add `GC_CLIENT_TYPE`

---

# Tests

## 🧪 TDD Gherkin Unit Tests

### check_inbox Tool

- [ ] `Given agent has 2 Message notifications and 1 Join notification When check_inbox is called Then 3 formatted notifications are returned and inbox is empty`
- [ ] `Given agent has empty inbox When check_inbox is called Then "No new notifications." is returned`
- [ ] `Given agent has notifications When check_inbox is called Then notifications are formatted using the same format as the inbox poller`

### Client-Aware Poller

- [ ] `Given GC_CLIENT_TYPE is "cursor" When MCP server starts Then inbox poller is not started`
- [ ] `Given GC_CLIENT_TYPE is "claude-code" When MCP server starts Then inbox poller is started`
- [ ] `Given GC_CLIENT_TYPE is undefined When MCP server starts Then inbox poller is started (backward compatible)`
