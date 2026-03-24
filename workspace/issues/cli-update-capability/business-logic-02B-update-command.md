---
name: "⚙️ Update command with config refresh"
type: business-logic
order: "02B"
status: pending
labels: ["type:business-logic", "team:tools", "effort:average", "value:high"]
parent: "feature-00-cli-update-capability.md"
dependencies: ["business-logic-01A-install-metadata.md", "business-logic-01B-version-check.md"]
skills: []
---

Load the following skills before starting: none required.

## 🛠️ Skills, tools & MCPs

- No external skills required.

## 🔗 Dependencies

- [ ] `business-logic-01A-install-metadata.md` — requires `InstallMetadataService` to exist
- [ ] `business-logic-01B-version-check.md` — requires `VersionCheckService` to exist
- For additional planning context, read the parent: `feature-00-cli-update-capability.md`

---

## Context

`gchat update` performs three phases:
1. Check if a newer version exists on npm
2. Run `npm install -g group-chat-mcp@latest`
3. Re-exec the newly installed `gchat` binary with `update --post-install` to refresh IDE configs

The re-exec is necessary because the running process has the old version's code loaded. The new binary's installer logic must apply its own config format.

`gchat update --post-install` is an internal command (not shown in help text). It reads install metadata and re-applies the installer for each persisted IDE+scope combo.

---

## ⚙️ Services

### UpdateService

Purpose: Orchestrate the update flow: version check, npm install, re-exec.

#### Public Mutators
- [ ] `performUpdate`: () → Promise<void> - Full update flow:
  1. Call `VersionCheckService.checkForUpdate()`
  2. If null (check failed), print error and exit
  3. If `updateAvailable` is false, print "Already up to date ({version})" and exit
  4. Print "Updating group-chat-mcp {current} → {latest}..."
  5. Run `npm install -g group-chat-mcp@latest` via `execFileSync('npm', ['install', '-g', 'group-chat-mcp@latest'], { stdio: 'inherit' })`
  6. If npm fails, print error and exit with code 1
  7. Resolve the new `gchat` binary path (use `which gchat` or `process.execPath` + resolve)
  8. Spawn `gchat update --post-install` using `execFileSync` with stdio inherit
  9. Exit

- [ ] `performPostInstall`: () → Promise<void> - Config refresh flow:
  1. Read install metadata via `InstallMetadataService.getInstalls()`
  2. If empty, print "No install metadata found. Run `gchat install` to configure your IDE." and exit
  3. For each entry, call `InstallerService.install({ ide, scope })`
  4. Print confirmation for each refreshed IDE+scope combo
  5. Print "Updated group-chat-mcp to {version}" (read from `VersionCheckService.getLocalVersion()`)

---

## Integration with existing code

### parseCommand in `src/gchat.ts`

Add two new command variants:

1. `update` — maps to `{ command: 'update' }`
2. `update` with `--post-install` flag — maps to `{ command: 'update-post-install' }`

### ParseResult type in `src/types/parse-result.ts`

Add the new command types to the union.

### main() in `src/gchat.ts`

Add handlers for both commands:
- `update`: call `UpdateService.performUpdate()`
- `update-post-install`: call `UpdateService.performPostInstall()`

### Help text

Add `update` to the usage output:
```
  update           Update group-chat-mcp to the latest version
```

Do not list `update --post-install` — it is internal.

---

## TDD Gherkin Tests

### parseCommand tests
- [ ] `Given args ["update"] When parseCommand is called Then it returns { command: "update" }`
- [ ] `Given args ["update", "--post-install"] When parseCommand is called Then it returns { command: "update-post-install" }`

### UpdateService tests
- [ ] `Given checkForUpdate returns updateAvailable: false When performUpdate is called Then it prints "Already up to date" and does not run npm install`
- [ ] `Given checkForUpdate returns updateAvailable: true When performUpdate is called Then it runs npm install -g group-chat-mcp@latest`
- [ ] `Given checkForUpdate returns null When performUpdate is called Then it prints an error`
- [ ] `Given install metadata has entries When performPostInstall is called Then it calls InstallerService.install for each entry`
- [ ] `Given install metadata is empty When performPostInstall is called Then it prints "No install metadata found" and does not call InstallerService.install`

---

## Acceptance Criteria

- [ ] `UpdateService` exists at `src/services/update-service.ts`
- [ ] `gchat update` checks for a newer version and runs `npm install -g` if available
- [ ] `gchat update` re-execs the new binary with `--post-install` after npm install
- [ ] `gchat update --post-install` reads install metadata and refreshes all IDE configs
- [ ] `gchat update --post-install` with no metadata prints a notice to run `gchat install`
- [ ] `gchat update` prints "Already up to date" when already on the latest version
- [ ] `update` appears in the CLI help text; `--post-install` does not
- [ ] `parseCommand` handles both `update` and `update --post-install`
- [ ] Unit tests cover all Gherkin scenarios
- [ ] All existing tests pass (`npm test`)

---

## Suggested Approach

1. Update `ParseResult` in `src/types/parse-result.ts` to include the new commands
2. Update `parseCommand` in `src/gchat.ts` to handle `update` and `update --post-install`
3. Create `src/services/update-service.ts`
4. Add handlers in `main()` for both commands
5. Update the help text in `main()`
6. Create `src/__tests__/update-service.test.ts`
7. Run `npm test` to verify all tests pass
