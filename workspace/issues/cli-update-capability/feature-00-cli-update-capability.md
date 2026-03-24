---
name: "✨ CLI update capability"
type: feature
order: "00"
status: completed
labels: ["type:feature", "team:tools", "effort:average", "value:high"]
parent: "none"
dependencies: []
skills: ["project-management"]
todos:
  - id: 01A
    content: "[01A] [business-logic] ⚙️ Install metadata service -> business-logic-01A-install-metadata.md"
    status: completed
  - id: 01B
    content: "[01B] [business-logic] ⚙️ Version check service -> business-logic-01B-version-check.md"
    status: completed
  - id: 02A
    content: "[02A] [business-logic] ⚙️ Update notice on interactive commands -> business-logic-02A-update-notice.md"
    status: completed
  - id: 02B
    content: "[02B] [business-logic] ⚙️ Update command with config refresh -> business-logic-02B-update-command.md"
    status: completed
isProject: false
---

# ✨ CLI update capability

**Author:** codaveto
**Status:** 🟡 Draft
**Last updated:** 2026-03-24

## 🛠️ Skills, tools & MCPs

- project-management (decomposition methodology and templates)

---

## 📣 Executive summary

Users who install `group-chat-mcp` globally via npm have no way to know when a newer version is available and no built-in command to update. They must manually check npm and re-run `npm install -g group-chat-mcp`.

This feature adds two capabilities: (1) a passive update notice printed after interactive CLI commands when a newer version exists on npm, and (2) a `gchat update` command that installs the latest version and refreshes all IDE configurations that were previously set up via `gchat install`.

The update command re-executes the newly installed binary to apply config changes using the new version's installer logic, ensuring IDE configurations always match the installed version.

## 🎯 Goals & non-goals

### Goals
- [ ] Users see an update notice after interactive commands when a newer npm version exists
- [ ] Users can run `gchat update` to install the latest version and refresh IDE configs
- [ ] IDE configurations are refreshed using the new version's installer logic (re-exec)
- [ ] Install metadata persists which IDE+scope combos were installed so update knows what to refresh

### Non-goals
- [ ] Auto-updating without user action
- [ ] Targeting a specific version (always latest)
- [ ] Update notices on non-interactive commands (cursor-join, cursor-leave)
- [ ] Interactive prompts asking whether to update

## 🏷️ Feature context

| Dimension | Choice | Implications for this feature |
|-----------|--------|--------------------------------|
| Surfaces | CLI (`gchat` binary) | All changes are in the Node.js CLI layer |
| Domain constraints | npm registry availability, global install permissions | Network required for version check; user must have global npm install permissions |
| Release slice | v0.2.0 | First version with self-update capability |

## 👥 Users & stakeholders

| Role | Who | Needs & success |
|------|-----|-----------------|
| Primary actor | Developer using gchat CLI | Knows when updates are available; can update with one command |

## ✅ Success criteria

### User success
- [ ] Running `gchat install` or `gchat uninstall` prints an update notice when a newer version exists on npm
- [ ] Running `gchat update` installs the latest version and prints confirmation with old → new version
- [ ] After `gchat update`, all previously installed IDE configs are refreshed to match the new version

### Quality / reliability
- [ ] Version check does not block or slow interactive commands (runs in parallel)
- [ ] Version check result is cached for 24 hours to avoid repeated registry calls
- [ ] Hook commands (cursor-join, cursor-leave) are unaffected — no stdout pollution
- [ ] If npm registry is unreachable, commands proceed normally without the notice

## 🗺️ User journeys

### 🔔 Journey: passive update notice

**Actor:** Developer running an interactive gchat command
**Trigger:** User runs `gchat install` or `gchat uninstall`
**Happy path:**
1. CLI fires a background version check against the npm registry
2. CLI runs the requested command normally
3. After command output, CLI prints: `Update available: 0.1.6 → 0.2.0. Run gchat update to install.`

**Edge / failure:** npm registry unreachable → no notice printed, command runs normally. Cache fresh (<24h) → no registry call, uses cached result.

**Maps to success criteria:** User success #1, Quality #1-#4

### ⬆️ Journey: manual update

**Actor:** Developer who wants the latest version
**Trigger:** User runs `gchat update`
**Happy path:**
1. CLI checks npm registry for the latest version
2. If already on latest, prints "Already up to date (0.2.0)" and exits
3. If newer version exists, runs `npm install -g group-chat-mcp@latest`
4. After npm install completes, spawns the new `gchat` binary with `update --post-install`
5. New binary reads install metadata, re-applies installer for each persisted IDE+scope combo
6. Prints confirmation: `Updated group-chat-mcp 0.1.6 → 0.2.0` and lists refreshed IDE configs

**Edge / failure:** npm install fails → prints error, does not attempt config refresh. No install metadata file → skips config refresh, prints notice that user should run `gchat install`.

**Maps to success criteria:** User success #2-#3

## 📦 Scope

### In scope
- [ ] Install metadata persistence (write on install, remove on uninstall)
- [ ] Version check service with 24h file cache
- [ ] Update notice after interactive commands
- [ ] `gchat update` command with npm install + re-exec for config refresh
- [ ] `gchat update --post-install` internal command for config refresh by new binary
- [ ] Unit tests for metadata service, version check, and update flow

### Out of scope
- [ ] Auto-update (silent or prompted)
- [ ] Version pinning or downgrade
- [ ] Update notices on hook commands
- [ ] Changelog display after update

## ⚙️ Functional requirements

| ID | Requirement | Priority (P0–P3) | Source journey |
|----|-------------|------------------|----------------|
| FR-001 | `gchat install` persists the chosen IDE+scope combo in install metadata | P0 | Manual update |
| FR-002 | `gchat uninstall` removes the corresponding IDE+scope combo from install metadata | P0 | Manual update |
| FR-003 | Version check queries the npm registry for the latest published version of `group-chat-mcp` | P0 | Both |
| FR-004 | Version check caches the result (latest version + timestamp) for 24 hours | P1 | Both |
| FR-005 | Interactive commands fire the version check in parallel and print the notice after command output | P0 | Passive notice |
| FR-006 | `gchat update` runs `npm install -g group-chat-mcp@latest` | P0 | Manual update |
| FR-007 | `gchat update` re-execs the new binary with `--post-install` after npm install succeeds | P0 | Manual update |
| FR-008 | `gchat update --post-install` reads install metadata and re-runs the installer for each entry | P0 | Manual update |

## 🛡️ Non-functional requirements

| ID | Category | Requirement | Measure / validation |
|----|----------|-------------|----------------------|
| NFR-001 | Performance | Version check does not add latency to interactive commands | Runs in parallel; command output appears at normal speed |
| NFR-002 | Reliability | Commands work normally when npm registry is unreachable | Version check failure is silently swallowed; no error printed |
| NFR-003 | Reliability | Corrupt or missing cache/metadata files do not crash the CLI | Fallback to fresh check / empty metadata |

## 🔗 Dependencies & assumptions

### Dependencies
- [ ] npm registry API (public, no auth required for read)
- [ ] `npm` CLI on user's PATH (required for `npm install -g`)

### Assumptions
- [ ] Users installed the package globally via npm (the standard install path documented in README)
- [ ] Users have permissions for global npm installs (they used them to install initially)

## 🚦 Risks & open questions

| Item | Type | Likelihood | Impact | Mitigation / next step |
|------|------|------------|--------|-------------------------|
| npm registry temporarily down | Risk | 🟢 | 🟢 | Silently skip version check; commands work normally |
| User installed via source (git clone) instead of npm | Risk | 🟡 | 🟡 | `gchat update` will fail on npm install; error message tells user to update manually |

## 🔭 Traceability check

- [x] Every FR references a Source journey
- [x] Every journey maps to at least one Success criterion
- [x] NFRs are tied to real risk for this feature (not boilerplate)
- [x] Non-goals are explicit so scope creep is visible
