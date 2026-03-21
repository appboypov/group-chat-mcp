---
name: "⚙️ State service and data models"
type: business-logic
order: "02"
status: pending
labels: ["type:business-logic", "team:tools", "effort:average", "value:maximum"]
parent: "feature-00-group-chat-mcp.md"
dependencies: ["chore-01-project-scaffolding.md"]
skills: ["mcp-builder"]
---

Load the following skills before starting: `mcp-builder`

# ⚙️ State service and data models

## 🔗 Dependencies

- [ ] chore-01-project-scaffolding.md — project must be scaffolded first

## 🔀 Related Issues

- feature-00-group-chat-mcp.md — parent feature spec (fetch for full context on requirements)
- development-03A-mcp-server.md — consumes this service for tool handlers
- business-logic-03B-cli-hooks.md — consumes this service for join/leave CLI

---

## 🛠️ Skills, tools & MCPs

- `mcp-builder` — MCP server patterns

---

## 📈 Data Flow Diagrams

```
MCP Server / CLI
      │
      ▼
  StateService
      │
      ├── agents.json           (active agent registry)
      ├── conversations.json    (conversation metadata)
      ├── messages/{conv-id}.json (messages per conversation)
      └── inboxes/{agent-id}.json (pending notifications per agent)
```

All reads/writes go through StateService. No direct file access elsewhere.

## 📦 Packages

| Package | Version | Purpose |
|---------|---------|---------|
| uuid | ^9.0.0 | Generate UUIDs for agents, conversations, messages |
| zod | ^3.0.0 | Schema validation for data models |

---

## ⚙️ Services

### StateService

**Purpose:** CRUD operations for agents, conversations, messages, and inbox notifications. All file I/O is centralized here with atomic write-then-rename to prevent corruption.

#### State
- [ ] `storagePath`: string — `~/.group-chat-mcp/` base directory

#### Public Getters
- [ ] `getAgent(agentId: string)`: Agent | null — retrieve a single agent
- [ ] `getAgents()`: Agent[] — all active agents
- [ ] `getAgentsByProject(projectPath: string)`: Agent[] — agents in a project
- [ ] `getConversation(conversationId: string)`: Conversation | null — single conversation
- [ ] `getConversations(scope: { projectPath?: string })`: Conversation[] — filtered list
- [ ] `getMessages(conversationId: string)`: Message[] — full message history
- [ ] `getInbox(agentId: string)`: Notification[] — pending notifications

#### Public Mutators
- [ ] `registerAgent(projectPath: string)`: Agent — create agent with UUID, return it
- [ ] `unregisterAgent(agentId: string)`: void — remove from active agents, leave all conversations
- [ ] `updateProfile(agentId: string, profile: ProfileUpdate)`: Agent — update agent profile fields
- [ ] `createConversation(params: CreateConversationParams)`: Conversation — create project/dm/group conversation
- [ ] `getOrCreateProjectConversation(projectPath: string)`: Conversation — find active project conversation or create new one
- [ ] `getOrCreateDmConversation(agentId1: string, agentId2: string)`: Conversation — find or create DM
- [ ] `joinConversation(agentId: string, conversationId: string)`: void — add agent to participants
- [ ] `leaveConversation(agentId: string, conversationId: string)`: void — remove agent, archive if empty
- [ ] `updateConversation(conversationId: string, updates: { name?: string, topic?: string })`: Conversation
- [ ] `addMessage(conversationId: string, senderId: string, content: string, type: 'message' | 'system')`: Message — store message and write to participant inboxes
- [ ] `clearInbox(agentId: string)`: void — clear after processing
- [ ] `ensureStorageDir()`: void — create ~/.group-chat-mcp/ and subdirectories if missing

#### On Init
- [ ] Call `ensureStorageDir()` to guarantee storage structure exists

#### TDD Gherkin Tests
- [ ] `Given no agents exist When registerAgent is called Then a new agent with UUID and projectPath is created`
- [ ] `Given an agent exists When unregisterAgent is called Then the agent is removed and leaves all conversations`
- [ ] `Given a project with no active conversation When getOrCreateProjectConversation is called Then a new project conversation is created`
- [ ] `Given a project conversation with participants When the last participant leaves Then the conversation is archived`
- [ ] `Given an archived project conversation exists When a new agent joins the project Then a fresh conversation is created`
- [ ] `Given two agents with no DM When send_message targets an agent Then a DM conversation is auto-created`
- [ ] `Given a message is added to a conversation When addMessage completes Then each participant's inbox contains a notification`
- [ ] `Given concurrent writes When two agents register simultaneously Then both agents are persisted without data loss`

---

## 📦 DTOs

### Agent

```yaml
name: Agent
description: An active Claude Code agent session
locations:
  - agents.json
fields:
  id:
    description: Unique identifier for this agent session
    type: string (UUID)
    required: true
    example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  projectPath:
    description: Absolute path to the project this agent is working in
    type: string
    required: true
    example: "/Users/codaveto/Repos/my-project"
  profile:
    description: Agent's self-described identity
    type: object (Profile)
    required: false
    default: {}
  joinedAt:
    description: Timestamp when agent registered
    type: number (epoch ms)
    required: true
    example: 1711000000000
  conversations:
    description: IDs of conversations this agent is in
    type: string[]
    required: true
    default: []
```

### Profile

```yaml
name: Profile
description: Agent's self-described identity
fields:
  name:
    description: Display name
    type: string
    required: false
    example: "Backend Builder"
  role:
    description: Agent's role description
    type: string
    required: false
    example: "Senior TypeScript Developer"
  expertise:
    description: Agent's area of expertise
    type: string
    required: false
    example: "API design, MCP servers"
  status:
    description: Current status
    type: string
    required: false
    example: "Implementing state service"
```

### Conversation

```yaml
name: Conversation
description: A chat room (project, DM, or ad-hoc group)
locations:
  - conversations.json
fields:
  id:
    description: Unique identifier
    type: string (UUID)
    required: true
  type:
    description: Conversation type
    type: enum ('project' | 'dm' | 'group')
    required: true
  projectPath:
    description: Project path (only for type 'project')
    type: string
    required: false
  name:
    description: Display name
    type: string
    required: false
  topic:
    description: Conversation topic
    type: string
    required: false
  participants:
    description: Agent IDs currently in the conversation
    type: string[]
    required: true
    default: []
  createdAt:
    description: Creation timestamp
    type: number (epoch ms)
    required: true
  archivedAt:
    description: When archived (all participants left)
    type: number (epoch ms)
    required: false
```

### Message

```yaml
name: Message
description: A single message in a conversation
locations:
  - messages/{conversationId}.json
fields:
  id:
    description: Unique identifier
    type: string (UUID)
    required: true
  conversationId:
    description: Which conversation this belongs to
    type: string
    required: true
  senderId:
    description: Agent ID of the sender (or 'system')
    type: string
    required: true
  content:
    description: Message text
    type: string
    required: true
  type:
    description: Message type
    type: enum ('message' | 'system')
    required: true
  timestamp:
    description: When sent
    type: number (epoch ms)
    required: true
```

### Notification

```yaml
name: Notification
description: Pending notification for an agent's inbox
locations:
  - inboxes/{agentId}.json
fields:
  id:
    description: Unique identifier
    type: string (UUID)
    required: true
  type:
    description: Notification type
    type: enum ('message' | 'join' | 'leave' | 'profile_update' | 'conversation_created' | 'conversation_updated')
    required: true
  conversationId:
    description: Related conversation
    type: string
    required: true
  agentId:
    description: Agent who triggered this notification
    type: string
    required: true
  content:
    description: Notification content (message text or event description)
    type: string
    required: true
  timestamp:
    description: When created
    type: number (epoch ms)
    required: true
```

---

## 🏷️ Enums

- [ ] **ConversationType**
    - [ ] `project`
    - [ ] `dm`
    - [ ] `group`

- [ ] **MessageType**
    - [ ] `message`
    - [ ] `system`

- [ ] **NotificationType**
    - [ ] `message`
    - [ ] `join`
    - [ ] `leave`
    - [ ] `profile_update`
    - [ ] `conversation_created`
    - [ ] `conversation_updated`

---

## 📌 Constants

- [ ] **StoragePaths**
    - [ ] `BASE_DIR` = `~/.group-chat-mcp`
    - [ ] `AGENTS_FILE` = `agents.json`
    - [ ] `CONVERSATIONS_FILE` = `conversations.json`
    - [ ] `MESSAGES_DIR` = `messages`
    - [ ] `INBOXES_DIR` = `inboxes`

---

## 🛠️ Utils

- [ ] **FileUtils** — Atomic file operations
    - [ ] `readJsonFile<T>(path: string)`: T | null — read and parse JSON, return null if missing
    - [ ] `writeJsonFile(path: string, data: unknown)`: void — write JSON atomically (write to .tmp, rename)
    - [ ] `appendToJsonArray<T>(path: string, item: T)`: void — read array, push item, write back atomically

---

# Tests

## 🧪 TDD Gherkin Unit Tests

### StateService

- [ ] `Given no agents exist When registerAgent("/project/a") is called Then agents.json contains one agent with projectPath "/project/a"`
- [ ] `Given agent X exists When unregisterAgent(X) is called Then agents.json no longer contains X`
- [ ] `Given agent X is in conversation C When unregisterAgent(X) is called Then X is removed from C's participants`
- [ ] `Given no project conversation for "/project/a" When getOrCreateProjectConversation is called Then a conversation with type "project" is created`
- [ ] `Given an active project conversation C exists When getOrCreateProjectConversation is called Then C is returned (no new conversation)`
- [ ] `Given an archived project conversation When getOrCreateProjectConversation is called Then a new conversation is created (archived one untouched)`
- [ ] `Given agents X and Y with no DM When getOrCreateDmConversation(X, Y) is called Then a DM conversation with both as participants is created`
- [ ] `Given a conversation C with agent X as sole participant When leaveConversation(X, C) is called Then C's archivedAt is set`
- [ ] `Given agent X in conversation C When addMessage(C, X, "hello") is called Then messages file contains the message and other participants' inboxes contain a notification`

### FileUtils

- [ ] `Given a file does not exist When readJsonFile is called Then null is returned`
- [ ] `Given valid JSON data When writeJsonFile is called Then the file contains the data and no .tmp file remains`
