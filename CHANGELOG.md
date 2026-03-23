# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.6] - 2026-03-23

### Added

- Per-conversation send lock that serializes concurrent `send_message` calls within a conversation, returning competing messages with reconsideration instructions to blocked agents

### Fixed

- Send lock robustness: stale lock detection with process liveness checks, lock release on agent disconnect, and jittered poll intervals to prevent filesystem contention

## [0.1.5] - 2026-03-22

### Added

- Deferred join announcements: agents no longer broadcast anonymous UUID-based join messages; announcements are deferred until `update_profile` is called, producing human-readable join messages with the agent's chosen name
- `hasAnnounced` per-conversation flag on agents to track announcement state
- `writeProfileSetupNotification` prompts joining agents to set their profile when entering a multi-participant conversation
- Profile reminder on `send_message` when a nameless agent messages a multi-participant conversation
- `agentName` field on notifications; `formatNotificationContent` prefers `agentName` over UUID for display

### Changed

- `update_profile` now requires all four fields (`name`, `role`, `expertise`, `status`) as non-empty strings
- `writeNotificationToParticipants` signature changed to accept `opts` object with optional `excludeAgentId` and `agentName`

### Fixed

- Defensive initialization of `hasAnnounced` for agents loaded from pre-migration storage
- DM path no longer calls `setHasAnnounced` on every message (only on new DM creation)
- Profile setup notification skipped for agents that already have a profile name
- Solo conversation deferred join announcements skipped (no pointless system messages)
- Join notification formatting no longer produces redundant output when content is present

## [0.1.4] - 2026-03-22

### Changed

- Default `GC_POLL_INTERVAL_MS` from 2000ms to 5000ms for all clients, configurable per IDE via MCP server env block
- Cursor installer no longer writes `GC_POLL_INTERVAL_MS` to mcp.json (5000ms is now the app default)

## [0.1.3] - 2026-03-21

### Added

- `read_notifications` MCP tool for pull-based notification retrieval (replaces push-based inbox poller for Cursor)
- Cursor session lifecycle hooks: `sessionStart`, `sessionEnd`, `beforeMCPExecution` via `hooks.json`
- `SessionStateService` for per-PID session state management with in-memory cache and stale session reaping
- `cursor-join` and `cursor-leave` CLI commands for hook-driven agent registration
- `GC_CLIENT_TYPE` environment variable to disable push-based inbox poller when set to `cursor`
- `writeNotificationToParticipants` and `formatNotificationContent` extracted to `src/utils/notification-utils.ts`
- `readAndClearInbox` method on `StateService` for atomic inbox read-and-clear
- Cursor installer writes `hooks.json` with idempotent merge logic preserving existing non-group-chat-mcp hooks
- Cursor `mcp.json` entry now includes `GC_CLIENT_TYPE` and `GC_POLL_INTERVAL_MS` in env block
- 28 new tests across 5 test files covering session state, CLI commands, cursor hook, installer hooks, and read_notifications
- Vitest configuration (`vitest.config.ts`)

### Changed

- `ParsedCommand` changed from interface to discriminated union type with `cursor-join` and `cursor-leave` variants
- `ParsedError` extended with `missing-required-arg` variant and optional `message` field
- MCP server dynamically resolves agent ID from session state on each tool call (falls back to startup-registered ID)
- Inbox poller conditionally skipped when `GC_CLIENT_TYPE === 'cursor'`
- Vitest include updated to cover both `src/__tests__/` and `tests/` directories

### Fixed

- `readStdin()` in cursor hook no longer leaks the timeout handle (added cleanup + `.unref()`)
- `--server-pid` validation rejects zero, negative, and non-integer values in both `cursor-join` and `cursor-leave`
- Existing installer tests updated to match new Cursor mcp.json format with `env` block

## [0.1.2] - 2026-03-21

### Added

- npm auto-publish workflow on GitHub release
- `repository` URL in `package.json` for npm provenance verification

### Fixed

- CI pipeline: switched to Node 24 for npm OIDC Trusted Publishing support
- CI pipeline: resolved `NODE_AUTH_TOKEN` / OIDC auth conflicts for `npm publish`

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
