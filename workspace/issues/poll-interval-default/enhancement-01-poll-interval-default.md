---
name: "🌱 Improve GC_POLL_INTERVAL_MS to default 5000ms app-wide"
type: enhancement
order: "01"
status: pending
labels: ["type:enhancement", "effort:minimum", "level:junior"]
parent: none
dependencies: []
skills: []
---

# 🌱 Improve GC_POLL_INTERVAL_MS to default 5000ms app-wide

## 🔗 Dependencies

None.

---

## 📋 OpenSpec change

- Unknown

## 🛠️ Skills, tools & MCPs

- None required. Standard TypeScript editing and `npm run build && npm test` verification.

---

## ✨ Enhancement

`GC_POLL_INTERVAL_MS` defaults to 2000ms, with the Cursor installer overriding it to 5000ms via the mcp.json env block. This makes 5000ms the app-wide default and removes the Cursor-specific override. Any IDE can still override the value via its MCP server env block.

## 💡 Motivation

5000ms is the appropriate polling interval for all clients. The 2000ms default was arbitrary and the Cursor-specific override creates a false impression that the value is IDE-dependent. The interval should be one universal default, configurable per IDE through the standard MCP env mechanism.

## 📦 Scope

### In scope
- [ ] Change the hardcoded default from 2000 to 5000 in `src/constants/env.ts`
- [ ] Remove `GC_POLL_INTERVAL_MS` from the Cursor installer env block in `src/services/installer-service.ts`
- [ ] Update the README Configuration table to reflect 5000 as the universal default
- [ ] Update all test assertions that reference the old default or the removed env entry

### Out of scope
- Adding new configuration mechanisms
- Changing the polling architecture
- Modifying how `GC_CLIENT_TYPE` works

## 📍 Current behavior

- `src/constants/env.ts` defaults to `2000` when `GC_POLL_INTERVAL_MS` is unset or unparseable.
- `src/services/installer-service.ts` writes `GC_POLL_INTERVAL_MS: '5000'` into the Cursor mcp.json env block.
- `README.md` documents the default as `2000` (`5000` for Cursor).
- Tests assert the presence of `GC_POLL_INTERVAL_MS: '5000'` in the Cursor installer output.

## 🎯 Desired behavior

- `src/constants/env.ts` defaults to `5000` when `GC_POLL_INTERVAL_MS` is unset or unparseable.
- `src/services/installer-service.ts` does not write `GC_POLL_INTERVAL_MS` into any env block. The env block for Cursor contains only `GC_CLIENT_TYPE: 'cursor'`.
- `README.md` documents the default as `5000` with a description stating it is configurable per IDE via the MCP server env block.
- Tests assert the Cursor env block contains only `GC_CLIENT_TYPE: 'cursor'`.

## ⚠️ Constraints

- Existing users who already installed with the Cursor installer have `GC_POLL_INTERVAL_MS: '5000'` in their mcp.json. This is harmless — 5000 matches the new default. No migration needed.

## ✅ Acceptance criteria

- [ ] `src/constants/env.ts` uses `5000` as the fallback value (both on line 7 and line 9)
- [ ] `src/services/installer-service.ts` Cursor env block contains only `GC_CLIENT_TYPE: 'cursor'`
- [ ] `README.md` Configuration table shows `5000` as the default with no Cursor-specific note
- [ ] `tests/services/installer-service.test.ts` — all four env assertions updated to `{ GC_CLIENT_TYPE: 'cursor' }` (no `GC_POLL_INTERVAL_MS`)
- [ ] `src/__tests__/installer-hooks.test.ts` — `GC_POLL_INTERVAL_MS` assertion removed; test name updated
- [ ] `npm run build` succeeds
- [ ] `npm test` passes

## 📝 Suggested approach

- [ ] 1. Edit `src/constants/env.ts`: replace both `2000` values with `5000` (lines 7 and 9)
- [ ] 2. Edit `src/services/installer-service.ts`: remove line 41 (`GC_POLL_INTERVAL_MS: '5000'`) from the env object (lines 39-42)
- [ ] 3. Edit `README.md` line 190: change default column to `5000` and description to `Inbox polling interval in milliseconds. Configurable per IDE via the MCP server env block.`
- [ ] 4. Edit `tests/services/installer-service.test.ts`: remove `GC_POLL_INTERVAL_MS: '5000'` from all four env assertions (lines 160, 188, 275, 305)
- [ ] 5. Edit `src/__tests__/installer-hooks.test.ts`: remove the `GC_POLL_INTERVAL_MS` assertion (line 136) and update the test name (line 127) to `When mcp.json is written Then it includes GC_CLIENT_TYPE in the env block`
- [ ] 6. Run `npm run build` and `npm test` to verify

## 📚 References
- Plan file: `.claude/plans/rosy-riding-micali.md`
- Conversation context from 2026-03-22 feedback on poll interval defaults
