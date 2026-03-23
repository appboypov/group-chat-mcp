# End Goal

Add a per-conversation message-sending lock that serializes sends within a conversation. When an agent attempts to send while another agent is already sending, the server waits internally until the competing message lands, then returns that message with strict instructions to reconsider and resend — never discarding the blocked agent's intent.

## Steps

- [ ] Add a per-conversation send lock to the state layer
  - [ ] File-based lock per conversation (reusing the existing lock primitive pattern) that tracks the sending agent's ID
  - [ ] 10-second stale threshold with automatic lock breaking and process liveness check
- [ ] Integrate the lock into the send_message tool handler
  - [ ] On lock contention: wait internally (poll) until the competing message lands
  - [ ] On lock release: read the latest message(s) from the conversation file that arrived while waiting, return them with strict instructions to read, reconsider the original intent, and resend (do NOT echo the blocked agent's original message)
  - [ ] On timeout: break the stale lock and proceed with the blocked agent's send normally
- [ ] Handle lock cleanup on agent disconnect/crash to prevent deadlocks

## Questions Answered

1. Q: Should the send lock be scoped per-conversation or global?
   A: Per-conversation. Agents can send to different conversations simultaneously, but only one at a time per conversation.

2. Q: Should the server reject immediately or wait internally?
   A: Wait internally until the competing message is sent, then return that message in the rejection response. This way the blocked agent immediately sees the message that beat it, can adjust its reply, and retry without waiting for a notification cycle.

3. Q: Should the blocked agent still receive the competing message via normal notifications?
   A: Yes. The notification system stays unchanged. Duplicate exposure is acceptable and keeps the system simple.

4. Q: How long should the blocked agent wait before timing out?
   A: 10 seconds. Matches existing stale lock threshold. Normal sends complete in milliseconds.

5. Q: What happens on timeout?
   A: Break the stale lock and let the blocked agent send its message. Automatic recovery, no manual intervention.

6. Q: Should the rejection response echo the blocked agent's original message?
   A: No. Only return the competing message. The agent must reconsider its message in light of what the other agent said — that's the entire point of this feature. Echoing the original would tempt it to just resend without reconsidering.

7. Q: When multiple agents are blocked on the same conversation, queue or race?
   A: Race. All waiters re-contend when the lock releases. Losers wait again and see each subsequent competing message. Natural fit for file-based locks.

8. Q: How should the blocked agent retrieve the competing message?
   A: Read from the conversation's message file after the lock releases. Simple, uses existing data. In a multi-waiter race, each agent sees all messages sent since it started waiting.

9. Q: Should the send_message tool description be updated to document the lock behavior?
   A: No. Discovery only. Agents learn about it when they hit contention via the rejection response.
