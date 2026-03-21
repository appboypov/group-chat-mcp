---
name: "🧹 Clean up obsolete CLI and update docs"
type: chore
order: "03"
status: pending
labels: ["type:chore", "team:tools", "effort:low", "value:average"]
parent: "story-00-zero-config-setup.md"
dependencies: ["refactor-01-self-registering-server.md", "business-logic-02-gchat-installer.md"]
skills: ["mcp-builder"]
---

Load the following skills before starting: `mcp-builder`

# 🧹 Clean up obsolete CLI and update docs

## 🔗 Dependencies

- [ ] refactor-01-self-registering-server.md — server must self-register before old CLI can be removed
- [ ] business-logic-02-gchat-installer.md — installer must exist before docs can reference the new flow

## 🔀 Related Issues

- story-00-zero-config-setup.md — parent story (fetch for full context)

---

## 🛠️ Skills, tools & MCPs

- `mcp-builder` — MCP project documentation patterns

---

## 🧹 Chore

The old `src/cli.ts` with `join`/`leave` commands is obsolete. The MCP server now self-registers agents, and the `gchat` CLI handles installation. The old CLI, its hook configuration docs, and all references to `GC_AGENT_ID` need to be removed. README and CHANGELOG must reflect the new zero-config flow.

## 📦 Scope

### In scope
- [ ] Delete `src/cli.ts` (the old join/leave CLI)
- [ ] Remove `"cli": "node dist/cli.js"` script from package.json
- [ ] Update package.json `bin` to remove the old `group-chat-mcp` entry pointing to `dist/cli.js` (the `gchat` entry pointing to `dist/gchat.js` is added by issue 02)
- [ ] Remove any imports or references to the old CLI in other files
- [ ] Verify index.ts self-registration (from issue 01) does not reference or depend on any pattern from cli.ts
- [ ] Update README.md:
  - Installation section: `npm install -g group-chat-mcp`
  - Setup section: `gchat install` (replaces manual hook/MCP config)
  - Remove all references to `GC_AGENT_ID`, SessionStart/SessionEnd hooks, and manual `cli.js` commands
  - Keep the Tools section as-is
  - Update Configuration section (remove `GC_AGENT_ID`, add `GC_PROJECT_PATH` as optional)
- [ ] Update CHANGELOG.md with a new unreleased section covering:
  - self-registering server
  - gchat installer
  - removed old CLI

### Out of scope
- Changing the MCP server or installer (done in prior issues)
- Updating workspace/issues/ (old issues are historical record)

## 📍 Baseline

- `src/cli.ts` exists with join/leave commands
- README.md documents manual hook configuration and `GC_AGENT_ID` env var
- CHANGELOG.md has only the 0.1.0 entry
- package.json has `"group-chat-mcp": "dist/cli.js"` in bin and `"cli"` in scripts

## 🎯 Target state

- `src/cli.ts` deleted
- README.md documents `npm install -g group-chat-mcp` + `gchat install` as the setup flow
- CHANGELOG.md has an unreleased section with all changes
- package.json `bin` only has the `gchat` entry
- No references to `GC_AGENT_ID` as a required env var anywhere in the codebase (except as historical in workspace/issues/)

## ⚠️ Blast radius & safety

- Deleting `src/cli.ts` removes the old entry point. Anyone using the old hooks flow breaks. This is intentional — the old flow was broken by design.
- README changes are documentation only.
- CHANGELOG changes are documentation only.
- Verify `npm run build` still passes after deleting `cli.ts`.

## ✅ Acceptance criteria

- [ ] `src/cli.ts` does not exist
- [ ] `npm run build` succeeds
- [ ] `npm test` passes (no tests reference the old CLI)
- [ ] README.md documents `npm install -g group-chat-mcp` + `gchat install`
- [ ] README.md has no references to `GC_AGENT_ID` as required, manual hooks, or `cli.js join/leave`
- [ ] CHANGELOG.md has an unreleased section with the refactor, installer, and cleanup changes
- [ ] package.json `bin` only contains `"gchat": "dist/gchat.js"`
- [ ] No TypeScript source file imports from `cli.ts`
- [ ] dist/cli.js (and dist/cli.js.map if present) are deleted or a prebuild clean step is added to prevent stale artifacts

## 📝 Steps

1. Read `src/cli.ts`, `package.json`, `README.md`, `CHANGELOG.md`
2. Delete `src/cli.ts`
3. Update `package.json`:
   - Remove `"cli": "node dist/cli.js"` from scripts
   - Ensure `bin` only has `"gchat": "dist/gchat.js"` (issue 02 adds this, verify it's there)
4. Search for any imports of `cli.ts` or `cli.js` in the codebase — remove them
4b. Delete dist/cli.js and dist/cli.js.map if they exist (tsc does not delete outputs for removed source files)
5. Run `npm run build` — verify no compilation errors
6. Run `npm test` — verify all tests pass
7. Update README.md:
   - Installation: `npm install -g group-chat-mcp`
   - Setup: `gchat install` with description of the interactive prompts
   - Usage: MCP server starts automatically when the IDE launches a session
   - Configuration: `GC_PROJECT_PATH` (optional) and `GC_POLL_INTERVAL_MS` (optional)
   - Remove all old hook config, CLI commands, and `GC_AGENT_ID` references
8. Update CHANGELOG.md: prepend unreleased section
9. Confirm acceptance criteria and no unintended regressions
