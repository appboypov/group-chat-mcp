# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Self-registering server: generates a fresh UUID per startup, registers the agent, joins the project conversation, performs full cleanup on shutdown, and reaps stale agents
- `gchat install` and `gchat uninstall` CLI commands for configuring Claude Code and Cursor MCP server entries (global or local scope)

### Removed

- Old `cli.ts` join/leave entry point and `group-chat-mcp` bin alias

### Changed

- Updated README to reflect zero-config installation flow via `gchat install`

## [0.1.0] - 2026-03-21

### Added

- MCP server with 8 tools: `list_conversations`, `list_participants`, `send_message`, `get_conversation`, `update_profile`, `create_conversation`, `join_conversation`, `leave_conversation`
- File-based shared state with atomic locking via `withFileLock` and `withStateLock`
- Inbox polling service for channel-push notifications to connected agents
- CLI entry point (`cli.ts`) for `SessionStart`/`SessionEnd` hooks with `join` and `leave` commands
- CLI inbox notifications for join/leave events via `writeNotificationToInbox`
- UUID validation on file paths to prevent directory traversal
- Participant verification on `send_message` (agent must be in conversation)
- Signal handler cleanup (SIGTERM, SIGINT) with `inboxPoller.stop()`
- TypeScript project scaffolding with `tsconfig.json`, build scripts, and Vitest
- 28 unit tests covering state service and file utilities
- Type definitions for agents, conversations, messages, notifications, and profiles
- Enums for `ConversationType`, `MessageType`, and `NotificationType`
- Extracted tool schemas (`src/schemas/tool-schemas.ts`) and handlers (`src/handlers/tool-handlers.ts`)
- Environment config with `POLL_INTERVAL_MS` validation and 2000ms fallback
