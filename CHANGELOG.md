# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-03-21

### Changed

- Claude Code installer now uses `claude mcp add/remove` CLI instead of writing settings files directly
- Scope mapping: Global → `--scope user`, Local → `--scope project`

### Fixed

- Paths with spaces no longer break CLI installation (`execFileSync` replaces string-based `execSync`)

## [0.1.0] - 2026-03-21

### Added

- MCP server with 8 tools: `list_conversations`, `list_participants`, `send_message`, `get_conversation`, `update_profile`, `create_conversation`, `join_conversation`, `leave_conversation`
- Self-registering server: generates a fresh UUID per startup, registers the agent, joins the project conversation, performs full cleanup on shutdown, and reaps stale agents
- `gchat install` and `gchat uninstall` CLI commands for configuring Claude Code and Cursor MCP server entries (global or local scope)
- File-based shared state with atomic locking via `withFileLock` and `withStateLock`
- Inbox polling service for channel-push notifications to connected agents
- UUID validation on file paths to prevent directory traversal
- Participant verification on `send_message` (agent must be in conversation)
- Signal handler cleanup (SIGTERM, SIGINT) with `process.once`
- TypeScript project scaffolding with `tsconfig.json`, build scripts, and Vitest
- 58 unit tests covering state service, tool handlers, installer service, and server lifecycle
- Type definitions for agents, conversations, messages, notifications, and profiles
- Enums for `ConversationType`, `MessageType`, `NotificationType`, `IDE`, and `Scope`
- Tool schemas (`src/schemas/tool-schemas.ts`) and handlers (`src/services/tool-handlers.ts`)
- Environment config with `GC_PROJECT_PATH` (optional) and `GC_POLL_INTERVAL_MS` (optional, 2000ms default)
