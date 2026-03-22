---
name: "⚙️ Deferred join announcement and forced profile updates"
type: business-logic
order: "01"
status: pending
labels: ["type:business-logic", "team:tools", "effort:average", "value:high"]
parent: "enhancement-00-deferred-join-announcement.md"
dependencies: []
skills: ["mcp-builder"]
---

Load the following skills before starting: mcp-builder

# ⚙️ Deferred join announcement and forced profile updates

## 🔗 Dependencies

None. This is the first issue in the sequence.

## 🔀 Related Issues

- enhancement-00-deferred-join-announcement.md — parent issue with full context and acceptance criteria

---

## 📋 OpenSpec change

Unknown

## 🛠️ Skills, tools & MCPs

- mcp-builder — MCP server development patterns

---

## 📦 DTOs

### Agent (update existing)

File: `src/types/agent.ts`

Add field:
```yaml
hasAnnounced:
  description: Tracks whether the deferred join announcement has fired per conversation
  type: Record<string, boolean>
  required: true
  default: {}
  example: { "conv-uuid-1": true, "conv-uuid-2": false }
```

### Notification (update existing)

File: `src/types/notification.ts`

Add field:
```yaml
agentName:
  description: Display name of the agent at notification creation time
  type: string
  required: false
  nullable: false
  example: "CodeReviewer"
```

---

## ⚙️ Services

### StateService (update existing)

File: `src/services/state-service.ts`

Purpose: Add `hasAnnounced` management.

#### Public Mutators

- [ ] `setHasAnnounced`: (agentId: string, conversationId: string) -> Promise<void> — Sets `hasAnnounced[conversationId] = true` for the agent. Uses file lock on agents file.
- [ ] `registerAgent` (update): Initialize `hasAnnounced: {}` in the agent record.

---

## Tool Handler Changes

File: `src/services/tool-handlers.ts`

### join_conversation handler (update)

Current: Adds system message + broadcasts Join notification.
Change: Remove the system message and Join notification entirely. After join, check participant count. If >=2 participants post-join, write an inbox notification to the joining agent prompting them to update their profile via `update_profile`.

Implementation:
1. Remove lines that call `stateService.addMessage()` with the join system message
2. Remove lines that call `writeNotificationToParticipants()` with `NotificationType.Join`
3. After `stateService.joinConversation()`, fetch the conversation to get participant count
4. If `conversation.participants.length >= 2`, write a notification to the joining agent's inbox:
   - type: `NotificationType.Join` (reuse existing type)
   - content: "You joined a conversation with other participants. Update your profile (name, role, expertise, status) using update_profile once your role becomes clear."
   - Write directly to the joining agent's inbox file (not via `writeNotificationToParticipants` since this targets the joiner, not others)

### update_profile handler (update)

Current: Accepts partial profile updates with optional fields.
Change:
1. Require all four fields (name, role, expertise, status) on every call. Reject if any field is missing or empty string.
2. After updating the profile, check if the agent has any conversations where `hasAnnounced` is false.
3. For each un-announced conversation:
   a. Add system message: "{name} joined the conversation."
   b. Broadcast Join notification to other participants (using `writeNotificationToParticipants`) with `agentName` populated
   c. Call `stateService.setHasAnnounced(agentId, conversationId)`
4. Continue with existing ProfileUpdate notification broadcast for all conversations.

### send_message handler (update)

Current: Sends message without checking profile completeness.
Change: After sending the message, check if:
- `agent.profile.name` is unset (undefined or null)
- AND conversation has >=2 participants

If both true, append to the tool response text: "Reminder: your profile is not set. Use update_profile to set your name, role, expertise, and status so other participants can identify you."

---

## Schema Changes

File: `src/schemas/tool-schemas.ts`

### UpdateProfileArgsSchema (update)

Current: All four fields are `z.string().optional()`.
Change: All four fields are `z.string().min(1)` (required, non-empty).

### toolDefinitions update_profile entry (update)

Current: No `required` array in inputSchema.
Change: Add `required: ['name', 'role', 'expertise', 'status']` to the inputSchema.

---

## Entry Point Changes

### index.ts (update)

File: `src/index.ts`

Current (lines 69-77): Adds system message + broadcasts Join notification on startup.
Change: Remove the system message and Join notification. After joining, check participant count. If >=2, write inbox notification to the joining agent.

### gchat.ts (update)

File: `src/gchat.ts`

Current (lines 80-87): Uses `agent.id` directly in system message + broadcasts Join notification.
Change:
1. Remove the system message and Join notification from `handleCursorJoin`
2. After joining, check participant count. If >=2, write inbox notification to the joining agent.

---

## Notification Formatting Changes

File: `src/utils/notification-utils.ts`

### writeNotificationToParticipants (update)

Current: Creates Notification without `agentName`.
Change: Accept an optional `agentName` parameter. Populate `notification.agentName` when provided.

### formatNotificationContent (update)

Current: Uses `notification.agentId` (UUID) in all formatted strings.
Change: Use `notification.agentName ?? notification.agentId` in all formatted output strings.

---

# Tests

## 🧪 TDD Gherkin Unit Tests

### UpdateProfileArgsSchema validation

- [ ] `Given an update_profile call missing the name field When the schema validates Then it rejects with a validation error`
- [ ] `Given an update_profile call with an empty string for role When the schema validates Then it rejects with a validation error`
- [ ] `Given an update_profile call with all four fields non-empty When the schema validates Then it passes`

### Join flow (silent join)

- [ ] `Given an agent joins a conversation When the join completes Then no system message is added to the conversation`
- [ ] `Given an agent joins a conversation When the join completes Then no Join notification is broadcast to other participants`
- [ ] `Given an agent joins a conversation with >=2 participants When the join completes Then the joining agent receives an inbox notification to set their profile`
- [ ] `Given an agent joins a conversation as the only participant When the join completes Then no inbox notification is sent`

### Deferred join announcement (update_profile)

- [ ] `Given an agent with hasAnnounced[convId]=false When the agent calls update_profile for the first time Then a system message "{name} joined" is added to the conversation`
- [ ] `Given an agent with hasAnnounced[convId]=false When the agent calls update_profile Then a Join notification with agentName is broadcast to other participants`
- [ ] `Given an agent with hasAnnounced[convId]=false When the agent calls update_profile Then hasAnnounced[convId] is set to true`
- [ ] `Given an agent with hasAnnounced[convId]=true When the agent calls update_profile again Then no additional join system message is added`

### send_message profile reminder

- [ ] `Given an agent with no profile name in a conversation with >=2 participants When the agent sends a message Then the response includes a profile reminder`
- [ ] `Given an agent with a profile name set When the agent sends a message Then the response does not include a profile reminder`
- [ ] `Given an agent with no profile name in a conversation with 1 participant When the agent sends a message Then the response does not include a profile reminder`

### Notification formatting with agentName

- [ ] `Given a notification with agentName set When formatNotificationContent is called Then it uses agentName instead of agentId`
- [ ] `Given a notification without agentName When formatNotificationContent is called Then it falls back to agentId`
