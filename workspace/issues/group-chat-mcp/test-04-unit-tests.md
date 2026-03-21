---
name: "🧪 Unit tests for state service"
type: test
order: "04"
status: pending
labels: ["type:test", "team:tools", "effort:average", "value:high"]
parent: "feature-00-group-chat-mcp.md"
dependencies: ["business-logic-02-state-service.md", "development-03A-mcp-server.md", "business-logic-03B-cli-hooks.md"]
skills: ["mcp-builder"]
---

Load the following skills before starting: `mcp-builder`

# 🧪 Unit tests for state service

## 🔗 Dependencies

- [ ] business-logic-02-state-service.md — StateService implementation must exist
- [ ] development-03A-mcp-server.md — MCP server must exist (tests verify tool schemas)
- [ ] business-logic-03B-cli-hooks.md — CLI must exist (tests verify join/leave flow)

## 🔀 Related Issues

- feature-00-group-chat-mcp.md — parent feature spec

---

## 🛠️ Skills, tools & MCPs

- `mcp-builder` — MCP testing patterns

---

## 🎯 End Goal

Unit tests covering StateService business logic and FileUtils reliability. Tests use a temporary directory for file state, not the real `~/.group-chat-mcp/`.

## 📎 Context

StateService is the core of the system — every tool and CLI command depends on it. Tests must verify:
- Agent lifecycle (register, unregister, profile update)
- Conversation lifecycle (create, join, leave, archive)
- Message storage and inbox notification delivery
- File atomicity (no corruption from write-then-rename)
- Edge cases: concurrent-like access, missing files, empty state

## 🧭 Test layers

- [x] Unit
- [ ] Evals
- [ ] Integration
- [ ] End-to-end
- [ ] UI flow verification

## ✅ Acceptance & completion

- [ ] All unit tests pass via `npm test`
- [ ] StateService CRUD operations are covered
- [ ] FileUtils atomic write is verified
- [ ] Edge cases (missing files, empty state, last participant leaving) are covered
- [ ] No mocks — tests use real file I/O against a temp directory

## ⚠️ Constraints

- Use a temp directory (os.tmpdir()) per test suite — clean up after
- No mocks for file operations — StateService uses real file I/O
- Test framework: vitest (add as dev dependency if not present)

## Philosophy

- Tests validate behavior and outcomes, not implementation details
- BDD Gherkin structure (Given/When/Then) for test names
- Only test meaningful business logic — no trivial getters
- Isolate via temp directories, not mocks

---

## 🧪 Unit tests

### StateService Agent Lifecycle (src/services/state-service.ts)

**Scope:** Agent registration, unregistration, and profile updates

**Targets:** StateService.registerAgent, unregisterAgent, updateProfile, getAgent, getAgents

- [ ] `Given no agents exist When registerAgent is called Then agents.json contains the new agent with a UUID and projectPath`
- [ ] `Given agent X exists When registerAgent is called again Then two agents exist`
- [ ] `Given agent X exists When unregisterAgent(X) is called Then agents.json no longer contains X`
- [ ] `Given agent X in conversation C When unregisterAgent(X) is called Then X is removed from C's participants`
- [ ] `Given agent X exists When updateProfile(X, { name: "Builder" }) is called Then agent X's profile.name is "Builder"`
- [ ] `Given agents in projects A and B When getAgentsByProject(A) is called Then only agents in project A are returned`

### StateService Conversation Lifecycle (src/services/state-service.ts)

**Scope:** Conversation creation, joining, leaving, archiving

**Targets:** StateService.getOrCreateProjectConversation, createConversation, joinConversation, leaveConversation, getOrCreateDmConversation

- [ ] `Given no conversations When getOrCreateProjectConversation("/project/a") is called Then a project conversation is created`
- [ ] `Given active project conversation C When getOrCreateProjectConversation is called for same project Then C is returned`
- [ ] `Given archived project conversation When getOrCreateProjectConversation is called for same project Then a new conversation is created`
- [ ] `Given agents X and Y When getOrCreateDmConversation(X, Y) is called Then a DM conversation with both participants exists`
- [ ] `Given DM between X and Y exists When getOrCreateDmConversation(X, Y) is called again Then the existing DM is returned`
- [ ] `Given DM between X and Y exists When getOrCreateDmConversation(Y, X) is called Then the same DM is returned (order-independent)`
- [ ] `Given conversation C When createConversation({ name: "Team Chat", type: "group" }) is called Then a group conversation with name "Team Chat" exists`
- [ ] `Given agent X not in conversation C When joinConversation(X, C) is called Then X is in C's participants`
- [ ] `Given agent X in conversation C with other participants When leaveConversation(X, C) is called Then X is removed but C is not archived`
- [ ] `Given agent X as sole participant in C When leaveConversation(X, C) is called Then C's archivedAt is set`
- [ ] `Given conversation C When updateConversation(C, { topic: "New topic" }) is called Then C's topic is "New topic"`

### StateService Messaging (src/services/state-service.ts)

**Scope:** Message storage and inbox notification delivery

**Targets:** StateService.addMessage, getMessages, getInbox, clearInbox

- [ ] `Given conversation C with agents X and Y When addMessage(C, X, "hello") is called Then messages file contains the message`
- [ ] `Given conversation C with agents X and Y When addMessage(C, X, "hello") is called Then Y's inbox contains a notification with content "hello"`
- [ ] `Given conversation C with agents X and Y When addMessage(C, X, "hello") is called Then X's inbox does NOT contain the notification (sender excluded)`
- [ ] `Given agent Y with 3 inbox notifications When clearInbox(Y) is called Then Y's inbox is empty`
- [ ] `Given conversation C with 5 messages When getMessages(C) is called Then all 5 messages are returned in chronological order`

### StateService Conversation Filtering (src/services/state-service.ts)

**Scope:** List conversations by scope

**Targets:** StateService.getConversations

- [ ] `Given project conversations for /a and /b and a DM When getConversations({ projectPath: "/a" }) is called Then only conversations involving /a are returned`
- [ ] `Given 3 conversations (2 active, 1 archived) When getConversations({}) is called Then all 3 are returned`

### FileUtils (src/utils/file-utils.ts)

**Scope:** Atomic file read/write operations

**Targets:** FileUtils.readJsonFile, writeJsonFile

- [ ] `Given a file does not exist When readJsonFile is called Then null is returned`
- [ ] `Given data When writeJsonFile is called Then the file contains the JSON and no .tmp file remains`
- [ ] `Given an existing file When writeJsonFile is called with new data Then the file contains only the new data`

---

## 📍 Current state

- No tests exist yet
- StateService, MCP server, and CLI are implemented

## 📂 Code, tests & artifacts

- @src/services/state-service.ts
- @src/utils/file-utils.ts
- @src/types/
- @tests/ (to be created)

## 📋 Execution Steps

1. Add vitest as dev dependency: `npm install -D vitest`
2. Add test script to package.json: `"test": "vitest run"`
3. Configure vitest in vitest.config.ts (if needed)
4. Create `tests/services/state-service.test.ts` with all StateService test suites
5. Create `tests/utils/file-utils.test.ts` with FileUtils tests
6. Each test suite creates a temp directory in beforeEach, cleans up in afterEach
7. Run `npm test` — all tests must pass
8. Fix any failing tests by adjusting test expectations or reporting bugs in implementation
