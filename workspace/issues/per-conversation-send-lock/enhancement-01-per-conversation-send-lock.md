---
name: "🌱 Improve send_message to serialize sends per conversation via contention lock"
type: enhancement
order: "01"
status: completed
labels: ["type:enhancement", "team:tools", "level:senior"]
parent: "none"
dependencies: []
skills: []
---

Load the following skills before starting: none required — this is a self-contained Node.js/TypeScript enhancement.

# 🌱 Improve send_message to serialize sends per conversation via contention lock

## 🔗 Dependencies

- None

## 🔀 Related Issues

- None

---

## 📋 OpenSpec change

- Unknown

## 🛠️ Skills, tools & MCPs

- group-chat-mcp server codebase at `/Users/codaveto/Repos/group-chat-mcp`

---

## ✨ Enhancement

The `send_message` tool gains a per-conversation send lock that serializes message sends within a conversation. When agent A is sending to a conversation and agent B attempts to send to the same conversation, the server holds agent B's request internally until agent A's message lands, then returns agent A's message to agent B with strict instructions to reconsider and resend — never discarding agent B's intent.

## 💡 Motivation

Without serialization, concurrent sends from multiple agents to the same conversation produce interleaved or duplicated messages. Agents don't see each other's in-flight messages, leading to responses that ignore what the other agent just said. This lock forces agents to acknowledge competing messages before sending.

## 📦 Scope

### In scope
- [ ] Per-conversation send lock in the state layer
- [ ] Lock integration into the `send_message` tool handler with internal wait-on-contention
- [ ] Contention response that returns competing messages with reconsideration instructions
- [ ] 10-second stale threshold with automatic lock breaking and process liveness check
- [ ] Lock cleanup on agent disconnect/crash

### Out of scope
- Global send lock (lock is per-conversation only)
- Changes to the notification system (stays unchanged; duplicate exposure is acceptable)
- Changes to the `send_message` tool description (agents discover lock behavior on contention)
- Queuing blocked agents (losers race on lock release, re-contend naturally)

## 📍 Current behavior

`send_message` in `src/services/tool-handlers.ts:86-123` calls `stateService.addMessage()` which acquires a file lock on `messages/{conversationId}.json`, appends the message, releases the lock, then writes notifications to each participant's inbox. Two agents sending simultaneously both succeed independently — neither sees the other's message before sending.

## 🎯 Desired behavior

1. Before writing a message, the sender resolves the target conversation ID (including DM path via `getOrCreateDmConversation`), then acquires a per-conversation send lock that tracks the sending agent's ID.
2. If the lock is free: acquire it, send the message, release the lock. No change to the happy path.
3. If the lock is held by another agent: wait internally (poll) until the lock releases (the competing message has landed).
4. On lock release: snapshot the message count from `messages/{conversationId}.json` before entering the wait loop. After the lock releases, re-read the file and return `messages[snapshotCount:]` — all messages that arrived during the wait. Return those messages to the blocked agent with strict instructions (see contention response contract below).
   - The contention response uses `isError: true` with content containing: for each competing message, the sender's name and message content; the conversation ID for resend targeting; and the reconsideration instruction text: "One or more messages were sent to this conversation while you were preparing your message. Read them carefully, reconsider your original intent in light of what was said, and send a new message. Do NOT resend your original message verbatim."
5. On timeout (10 seconds): break the stale lock and let the blocked agent send its message normally.
6. When multiple agents are blocked on the same conversation: all waiters re-contend when the lock releases. Losers wait again and see each subsequent competing message. The poll interval uses jitter (50-150ms random) to prevent synchronized filesystem contention.
7. On agent disconnect/crash: the cleanup handler in `src/index.ts` first releases any send locks held by the disconnecting agent, then writes leave messages and unregisters the agent.
8. System messages (join announcements, leave messages, profile updates) bypass the send lock. A blocked agent may see interleaved system messages alongside the competing message. This is tolerable — system messages are informational and do not require reconsideration.

## ⚠️ Constraints

- Reuse the existing directory-based lock primitive pattern from `src/utils/file-lock.ts` (directory creation, `lock.info` with PID/timestamp, stale detection via process liveness check).
- The send lock is distinct from the existing file-write lock on `messages/{conversationId}.json`. The file-write lock protects file I/O atomicity (milliseconds). The send lock serializes the entire send operation across agents (seconds).
- The send lock must store the sending agent's ID so the contention response can attribute competing messages.
- Normal sends complete in milliseconds. The 10-second timeout matches the existing stale lock threshold.
- The notification system stays unchanged. A blocked agent may receive the competing message both via the contention response and via the normal notification poller. Duplicate exposure is acceptable.
- The poll loop uses async `setTimeout` to yield the event loop, but the MCP tool call remains in-flight for the blocked agent. The agent cannot process other tool calls until the send completes or times out. This is acceptable — the agent has no useful action to take while waiting for send contention to resolve.
- Each blocked agent polls at 50-150ms intervals (jittered), producing ~7-20 filesystem stat calls per second per blocked agent. For conversations with 2-5 participants (the expected range), this cost is negligible. Conversations with 10+ simultaneous senders are not an expected scenario.
- On SIGKILL or OOM kill, no cleanup handler executes. Recovery relies on stale detection: blocked agents check PID liveness and break the lock after 10 seconds. The 10-second wait is acceptable for ungraceful termination.
- Reading `messages/{conversationId}.json` outside the file-write lock after contention resolution is safe. The file is written atomically via tmp + rename in `writeJsonFile()`. Reads outside the lock see either the previous state or the new state, never a partial write.

## ✅ Acceptance criteria

- [ ] A per-conversation send lock exists that tracks the sending agent's ID
- [ ] Only one agent at a time can be actively sending to a given conversation
- [ ] A blocked agent waits internally until the competing message lands (no immediate rejection)
- [ ] On lock release, the blocked agent receives the competing message(s) with instructions to reconsider and resend
- [ ] The blocked agent's original message is NOT echoed back or sent — only the competing messages are returned
- [ ] After 10 seconds of waiting, the stale lock is broken and the blocked agent's send proceeds normally
- [ ] On agent disconnect/crash, any held send locks are released
- [ ] Agents sending to different conversations simultaneously are not affected (lock is per-conversation)
- [ ] The `send_message` tool description is NOT modified (discovery only)
- [ ] Existing file-write locks on message files continue to work independently of the send lock
- [ ] Unit tests cover: lock acquisition, contention wait + release, timeout + stale break, cleanup on disconnect, addMessage failure with lock release via finally, thundering herd (two agents blocked, one wins, other re-waits)
- [ ] Lock lifecycle events logged to stderr: lock acquired, contention detected (with holder agentId), stale lock broken, timeout reached

## 📝 Suggested approach

- [ ] 1. Create a send lock utility at `src/utils/send-lock.ts` that manages per-conversation send locks. Reuse the directory-based lock pattern from `file-lock.ts`. Lock path: alongside messages, e.g., `~/.group-chat-mcp/messages/{conversationId}.send-lock/` containing a `lock.info` with `{pid, agentId, timestamp}`.
- [ ] 2. Implement three composable functions: (a) `tryAcquireSendLock(conversationId, agentId)` — attempts to create the lock directory, returns `{acquired: true}` or `{acquired: false, holderAgentId}`. (b) `waitForSendLockRelease(conversationId, timeoutMs, intervalMs?)` — polls until lock disappears or timeout, returns `{released: true}` or `{timedOut: true}`. (c) `getMessagesSince(conversationId, sinceIndex)` — reads messages from the file and returns `messages[sinceIndex:]`. These compose into the full contention flow and are independently testable.
- [ ] 3. Implement the contention poll loop — check every 50-150ms (jittered) if the lock directory still exists. When it disappears (competing send completed), read `messages/{conversationId}.json` to find messages that arrived since waiting started (compare message count: snapshot before waiting, return `messages[snapshotCount:]` after release). Return those messages.
- [ ] 4. Implement the 10-second timeout — if the poll loop exceeds 10 seconds, call `tryBreakStaleLock()` (with process liveness check) and proceed with the blocked agent's send.
- [ ] 5. Implement `releaseSendLock(conversationId)` — remove the lock directory.
- [ ] 6. Integrate into `send_message` handler in `src/services/tool-handlers.ts`: before calling `stateService.addMessage()`, acquire the send lock. Wrap `addMessage()` and `releaseSendLock()` in try/finally to guarantee lock release regardless of success or failure. If contention is detected and competing messages are returned, return those messages with the reconsideration instructions instead of sending. If no contention, send normally and release the lock in the finally block.
- [ ] 7. Add send lock cleanup to the disconnect handler in `src/index.ts:95-159`: for each conversation the agent is in, check if the agent holds the send lock and release it.
- [ ] 8. Write unit tests as BDD Gherkin scenarios. Tests use temporary directories (following the pattern in `src/__tests__/session-state-service.test.ts`) for filesystem isolation. Each test gets a clean state directory. Scenarios:
   - Given no contention, When agent sends, Then message written and normal response returned
   - Given agent A holds send lock on conv X, When agent B sends to conv X, Then B blocks until A's message lands and B receives A's message with reconsideration instructions
   - Given agent A holds send lock on conv X, When agent B sends to conv Y, Then B succeeds immediately
   - Given lock held for >10s by dead process, When agent sends, Then stale lock broken and send proceeds
   - Given agent disconnects while holding send lock, When cleanup runs, Then send lock released before leave messages
   - Given send lock acquired, When addMessage throws, Then lock released via finally
   - Given 2 agents blocked on same conv, When lock releases, Then exactly one wins, other re-waits
   - Given agent A sent message while B blocked, When B's contention resolves, Then response contains A's sender name, message content, conversation ID, and reconsideration text
   - Given lock held on conv X, When conv X messages read after release, Then only messages since snapshot returned
   - Given agent not in conversation, When agent sends with send lock contention, Then participation check fails before lock acquisition
   - Given agent blocked on send lock, When conversation is deleted, Then blocked agent receives an error on contention resolution
   - Given agent A sends via DM path, When agent B contends via explicit conversationId on same resolved conv, Then normal contention behavior applies
   - Given agent A releases lock and agent C immediately acquires it, When agent B's 10s timeout fires, Then B detects C's lock (different PID/agentId, fresh timestamp) and does NOT break it
- [ ] 9. Verify acceptance criteria and no regressions in adjacent flows.

## 📚 References

- Existing lock primitive: `src/utils/file-lock.ts`
- send_message handler: `src/services/tool-handlers.ts:86-123`
- State service addMessage: `src/services/state-service.ts:361-408`
- Agent cleanup: `src/index.ts:95-159`
- Design decisions: `STEPS.md` (Q&A section, questions 1-9)
