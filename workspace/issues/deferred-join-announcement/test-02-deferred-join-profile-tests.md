---
name: "🧪 Test deferred join announcement and profile enforcement"
type: test
order: "02"
status: pending
labels: ["type:test", "team:tools", "effort:low", "value:high"]
parent: "enhancement-00-deferred-join-announcement.md"
dependencies: ["business-logic-01-deferred-join-profile-flow.md"]
skills: []
---

# 🧪 Test deferred join announcement and profile enforcement

## 🔗 Dependencies

- [ ] business-logic-01-deferred-join-profile-flow.md — Implementation must be complete before tests can verify the new behavior.

## 🔀 Related Issues

- enhancement-00-deferred-join-announcement.md — parent issue with full acceptance criteria

---

## 📋 OpenSpec change

Unknown

## 🛠️ Skills, tools & MCPs

- None beyond the project's existing test tooling (vitest/jest)

---

## 🎯 End Goal

All existing tests updated to reflect the new join/profile behavior. New test cases added covering: silent join, conditional inbox notification, forced full profile updates, deferred join announcement, send_message profile reminder, and agentName in notification formatting. All tests green.

## 📎 Context

The implementation in business-logic-01 changes:
- Join no longer produces system messages or notifications
- `update_profile` requires all four fields (name, role, expertise, status), non-empty
- First `update_profile` fires deferred join announcement
- `send_message` appends profile reminder when name unset + >=2 participants
- Notification type has new optional `agentName` field
- `formatNotificationContent` uses `agentName ?? agentId`

## 🧭 Test layers

- [x] Unit

## ✅ Acceptance & completion

- [ ] All existing tests in `tests/` and `src/__tests__/` pass after updates
- [ ] New test cases cover every Gherkin scenario from business-logic-01
- [ ] No test uses mocks where isolation into services is possible
- [ ] Tests follow BDD Gherkin structure (Given/When/Then)
- [ ] `npm test` (or equivalent) exits green

## ⚠️ Constraints

- Follow existing test patterns and structure in the project
- No mocks unless unavoidable (file system access via temp directories is acceptable as already done in existing tests)
- BDD Gherkin syntax for all new test cases

## Philosophy

Tests validate behavior and outcomes, not implementation details. No mocks where isolation is possible. BDD Gherkin structure. Business logic only — no trivial getters/setters. No testing of third-party libraries.

---

## 🧪 Unit tests

Focus: Verify the six behavioral changes introduced by the implementation.

### UpdateProfileArgsSchema (src/schemas/tool-schemas.ts)

Scope: Schema rejects partial or empty profile updates.

Targets: `UpdateProfileArgsSchema`, `toolDefinitions` update_profile entry

- [ ] `Given an update_profile call missing the name field When the schema parses Then it throws a ZodError`
- [ ] `Given an update_profile call with an empty string for expertise When the schema parses Then it throws a ZodError`
- [ ] `Given an update_profile call with all four fields as non-empty strings When the schema parses Then it succeeds`
- [ ] `Given an update_profile call with only name and role When the schema parses Then it throws a ZodError`

### Silent join — tool-handlers join_conversation (src/services/tool-handlers.ts)

Scope: Join no longer writes system messages or broadcasts Join notifications.

Targets: `handleToolCall('join_conversation', ...)`, message files, inbox files

- [ ] `Given agent A joins conversation X When the join handler completes Then no system message exists in conversation X messages`
- [ ] `Given agent A joins conversation X containing agent B When the join handler completes Then agent B's inbox contains no Join notification`
- [ ] `Given agent A joins conversation X as the second participant When the join handler completes Then agent A's inbox contains a profile setup notification`
- [ ] `Given agent A joins conversation X as the only participant When the join handler completes Then agent A's inbox is empty`

### Silent join — index.ts startup flow (src/index.ts)

Scope: Startup no longer produces join system messages.

Targets: `main()` function flow

- [ ] `Given the MCP server starts and joins a project conversation When startup completes Then no system message is written to the conversation`
- [ ] `Given the MCP server starts and joins a conversation with an existing participant When startup completes Then the new agent's inbox contains a profile setup notification`

### Silent join — gchat.ts cursor join (src/gchat.ts)

Scope: Cursor join no longer produces join system messages and uses consistent name formatting.

Targets: `handleCursorJoin`

- [ ] `Given handleCursorJoin is called When it completes Then no system message is written to the conversation`
- [ ] `Given handleCursorJoin is called for a conversation with existing participants When it completes Then the new agent's inbox contains a profile setup notification`

### Deferred join announcement — update_profile (src/services/tool-handlers.ts)

Scope: First update_profile fires deferred join announcement for un-announced conversations.

Targets: `handleToolCall('update_profile', ...)`, message files, inbox files, agent hasAnnounced

- [ ] `Given agent A has hasAnnounced[convX]=false When agent A calls update_profile with all fields Then a system message "{name} joined the conversation." appears in convX messages`
- [ ] `Given agent A has hasAnnounced[convX]=false and convX has agent B When agent A calls update_profile Then agent B's inbox contains a Join notification with agentName set`
- [ ] `Given agent A has hasAnnounced[convX]=false When agent A calls update_profile Then agent A's hasAnnounced[convX] becomes true`
- [ ] `Given agent A has hasAnnounced[convX]=true When agent A calls update_profile again Then no new system message is added to convX`
- [ ] `Given agent A in two conversations both with hasAnnounced=false When agent A calls update_profile Then both conversations receive deferred join messages`

### send_message profile reminder (src/services/tool-handlers.ts)

Scope: send_message appends profile reminder when name unset + >=2 participants.

Targets: `handleToolCall('send_message', ...)`

- [ ] `Given agent A has no profile name and conversation has >=2 participants When agent A sends a message Then the response text includes a profile reminder`
- [ ] `Given agent A has profile name set and conversation has >=2 participants When agent A sends a message Then the response text does not include a profile reminder`
- [ ] `Given agent A has no profile name and conversation has 1 participant When agent A sends a message Then the response text does not include a profile reminder`

### Notification formatting — agentName (src/utils/notification-utils.ts)

Scope: formatNotificationContent uses agentName when available.

Targets: `formatNotificationContent`, `writeNotificationToParticipants`

- [ ] `Given a Message notification with agentName "Reviewer" When formatNotificationContent is called Then the output contains "Reviewer" instead of the UUID`
- [ ] `Given a Join notification without agentName set When formatNotificationContent is called Then the output contains the agentId UUID`
- [ ] `Given writeNotificationToParticipants is called with agentName "Builder" When notifications are written Then each notification has agentName "Builder"`

---

## 📍 Current state

No tests exist for the new behavior. Existing tests in the following files will need updates to reflect the removed auto-join messages and stricter profile validation:

- `tests/handlers/tool-handlers.test.ts`
- `tests/services/state-service.test.ts`
- `tests/index.test.ts`
- `src/__tests__/cursor-hook.test.ts`

## 📂 Code, tests & artifacts

- `src/services/tool-handlers.ts`
- `src/services/state-service.ts`
- `src/utils/notification-utils.ts`
- `src/schemas/tool-schemas.ts`
- `src/types/agent.ts`
- `src/types/notification.ts`
- `src/index.ts`
- `src/gchat.ts`
- `tests/handlers/tool-handlers.test.ts`
- `tests/services/state-service.test.ts`
- `tests/index.test.ts`
- `src/__tests__/cursor-hook.test.ts`
