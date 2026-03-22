---
name: "🌱 Improve join flow to defer announcements until agent identity is established"
type: enhancement
order: "00"
status: pending
labels: ["type:enhancement", "team:tools", "effort:average", "value:high"]
parent: "none"
dependencies: []
skills: []
todos:
  - id: 01
    content: "[01] [business-logic] ⚙️ Deferred join announcement and forced profile updates -> business-logic-01-deferred-join-profile-flow.md"
    status: pending
  - id: 02
    content: "[02] [test] 🧪 Test deferred join announcement and profile enforcement -> test-02-deferred-join-profile-tests.md"
    status: pending
isProject: false
---

# 🌱 Improve join flow to defer announcements until agent identity is established

## 🔗 Dependencies

None.

## 🔀 Related Issues

None.

---

## ✨ Enhancement

The group-chat-mcp server currently broadcasts a system message and Join notification to all participants the moment an agent joins a conversation. This fires before the agent has set its profile (name, role, expertise, status), resulting in notifications containing raw UUIDs. Agents also never receive a prompt to set their profile, and existing agents are never reminded to do so.

This enhancement changes the join flow to:
1. Join silently (no system message, no notification on join)
2. Track a `hasAnnounced` flag per agent-conversation pair
3. Fire the deferred "{name} joined" announcement on the agent's first `update_profile` call
4. Notify the joining agent via inbox to set their profile (only when >=2 participants)
5. Remind agents to set their profile when sending a message with an unset name (only when >=2 participants)
6. Require all four profile fields (name, role, expertise, status) on every `update_profile` call — no empty or null values

## 💡 Motivation

Agents communicate using opaque UUIDs until they independently discover `update_profile`. The automatic join notification creates noise before any meaningful identity exists. Multi-agent conversations lack alignment on who is who.

## 📦 Scope

### In scope
- [x] Remove automatic system message + Join notification from all join entry points (index.ts, tool-handlers.ts, gchat.ts)
- [x] Add `hasAnnounced` tracking (Record<string, boolean> keyed by conversationId) to Agent type
- [x] Add `agentName` field to Notification type
- [x] Make `update_profile` require all four fields (name, role, expertise, status), non-empty
- [x] Fire deferred join announcement on first `update_profile` call
- [x] Send inbox notification to joining agent when >=2 participants post-join
- [x] Append profile reminder to `send_message` response when sender name is unset and >=2 participants
- [x] Fix `gchat.ts` to use `profile.name ?? id` consistently
- [x] Use `agentName` in `formatNotificationContent`
- [x] Update existing tests and add new test cases

### Out of scope
- Inbox poller changes (no behavioral change needed)
- New tools or MCP capabilities
- UI/frontend changes

## 📍 Current behavior

1. Agent registers with empty profile `{}`
2. Agent joins conversation -> system message "{agentId} joined" written immediately + Join notification broadcast to all participants
3. `update_profile` accepts partial updates with optional fields
4. No prompt to set profile ever issued
5. `send_message` sends without checking profile completeness
6. Notification formatting uses raw `notification.agentId` (UUID)
7. `gchat.ts` uses `agent.id` directly (not `profile.name ?? id`)

## 🎯 Desired behavior

1. Agent registers with empty profile `{}`
2. Agent joins conversation silently (no system message, no notification)
3. If >=2 participants after join: inbox notification sent to joining agent prompting profile setup
4. `update_profile` requires all four fields (name, role, expertise, status), all non-empty
5. On first `update_profile` call: deferred "{name} joined" system message + Join notification fires for each conversation where `hasAnnounced` is false, then sets `hasAnnounced[conversationId] = true`
6. On `send_message`: if sender's `profile.name` is unset AND >=2 participants, append reminder to tool response
7. Notification type includes optional `agentName` field, populated at creation time
8. `formatNotificationContent` uses `agentName` when available
9. All entry points use `profile.name ?? id` consistently

## ⚠️ Constraints

- `hasAnnounced` must be persisted in the Agent record (survives restart via file storage)
- No breaking changes to the MCP tool interface (tools still work, just with stricter validation on `update_profile`)
- Existing `update_profile` callers must now provide all four fields

## ✅ Acceptance criteria

- [ ] Joining a conversation produces no system message and no Join notification
- [ ] When >=2 participants post-join, the joining agent receives an inbox notification to set their profile
- [ ] When only 1 participant, no inbox notification is sent
- [ ] `update_profile` rejects calls missing any of the four fields (name, role, expertise, status)
- [ ] `update_profile` rejects calls with empty string values for any field
- [ ] First `update_profile` call fires deferred "{name} joined" system message + Join notification for all un-announced conversations
- [ ] Subsequent `update_profile` calls do not re-fire the join announcement
- [ ] `send_message` appends a profile reminder when sender name is unset and >=2 participants
- [ ] `send_message` does not append reminder when sender name is set
- [ ] `send_message` does not append reminder when <2 participants
- [ ] Notification formatting uses agent display name instead of raw UUID
- [ ] `gchat.ts` uses `profile.name ?? id` in all messages
- [ ] All existing tests updated and passing
- [ ] New test cases cover the new behaviors

## 📝 Suggested approach

- [ ] Implement business-logic-01-deferred-join-profile-flow.md
- [ ] Implement test-02-deferred-join-profile-tests.md
- [ ] Verify acceptance criteria and no regressions in adjacent flows.

## 📚 References

- Conversation context: planalyze findings 1-6 with confirmed solutions
