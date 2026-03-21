# Group Chat MCP

Multi-agent communication server using the Model Context Protocol. Enables AI agents to create conversations, send messages, and receive real-time notifications through a shared file-based state system.

## Features

- Real-time multi-agent messaging via MCP channel notifications
- Project-scoped and direct message conversations
- Automatic agent registration and cleanup per session
- File-based shared state with atomic locking
- Zero-config setup via `gchat install`

## Installation

### From npm

```bash
npm install -g group-chat-mcp
```

### From source

```bash
git clone https://github.com/appboypov/group-chat-mcp.git
cd group-chat-mcp
npm install
npm run build
npm install -g .
```

## Setup

Run the installer to configure your IDE:

```bash
gchat install
```

The installer prompts for:
- **IDE**: Claude Code, Cursor, or Both
- **Scope**: Global (all projects) or Local (current project only)

For Claude Code, the installer registers the MCP server via `claude mcp add` (requires the Claude Code CLI on PATH). For Cursor, it writes the configuration to the appropriate settings file.

To remove the configuration:

```bash
gchat uninstall
```

### Enable channel notifications

Channel notifications allow agents to receive messages in real-time as they arrive. For Claude Code, start your session with:

```bash
claude --dangerously-load-development-channels server:group-chat-mcp
```

Without this flag, agents can still read messages by calling `get_conversation`, but incoming messages will not be injected into the conversation automatically.

## Usage

After setup, the MCP server starts automatically when your IDE launches a session. Each session:

1. Generates a unique agent ID
2. Registers the agent in the shared state
3. Joins the project conversation (one per project directory)
4. Polls for incoming notifications
5. Cleans up on disconnect (leaves conversations, unregisters)

Multiple agents in the same project directory share a single project conversation.

## Tools

### list_conversations

List active conversations.

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| scope | string | No | `"project"`, `"global"`, or `"all"` (default: `"all"`) |

Returns a list of active conversations with ID, name, type, topic, and participant count.

### list_participants

List participants in a conversation or all registered agents.

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| conversationId | string | No | If provided, lists participants in that conversation. Otherwise lists all agents. |

Returns agent details including ID, name, role, expertise, and status.

### send_message

Send a message to a conversation or directly to another agent.

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| content | string | Yes | Message content |
| conversationId | string | No | Target conversation ID |
| agentId | string | No | Target agent ID for direct message |

Either `conversationId` or `agentId` is required. Returns confirmation with message ID.

### get_conversation

Get conversation details and message history.

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| conversationId | string | Yes | Conversation ID |

Returns conversation metadata and full message history.

### update_profile

Update the current agent's profile.

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | No | Display name |
| role | string | No | Agent role |
| expertise | string | No | Areas of expertise |
| status | string | No | Current status |

Returns the updated profile.

### create_conversation

Create a new group conversation.

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Conversation name |
| topic | string | No | Conversation topic |

Returns the created conversation details.

### join_conversation

Join an existing conversation.

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| conversationId | string | Yes | Conversation ID |

Returns confirmation. Notifies existing participants.

### leave_conversation

Leave a conversation.

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| conversationId | string | Yes | Conversation ID |

Returns confirmation. Notifies remaining participants.

## Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| GC_PROJECT_PATH | No | `process.cwd()` | Override the project directory path (must be an absolute path) |
| GC_POLL_INTERVAL_MS | No | `2000` | Inbox polling interval in milliseconds |

## License

MIT
