---
name: "⚙️ Update notice on interactive commands"
type: business-logic
order: "02A"
status: completed
labels: ["type:business-logic", "team:tools", "effort:minimum", "value:high"]
parent: "feature-00-cli-update-capability.md"
dependencies: ["business-logic-01B-version-check.md"]
skills: []
---

Load the following skills before starting: none required.

## 🛠️ Skills, tools & MCPs

- No external skills required.

## 🔗 Dependencies

- [ ] `business-logic-01B-version-check.md` — requires `VersionCheckService` to exist
- For additional planning context, read the parent: `feature-00-cli-update-capability.md`

---

## Context

The `gchat` CLI entrypoint is `src/gchat.ts`. The `main()` function handles interactive commands (`install`, `uninstall`). Hook commands (`cursor-join`, `cursor-leave`) are handled before `main()` reaches the interactive flow and output JSON to stdout.

The update notice must:
1. Fire the version check in parallel with the main command (no added latency)
2. Print the notice after the command completes (if a newer version exists)
3. Only run on interactive commands — never on hook commands
4. Silently swallow failures (network errors, cache issues)

---

## ⚙️ Services

No new service. This integrates `VersionCheckService.checkForUpdate()` into the existing `main()` function in `src/gchat.ts`.

---

## 🛠️ Utils

### formatUpdateNotice

- [ ] `formatUpdateNotice`: (current: string, latest: string) → string - Returns the formatted update notice string. Example: `\nUpdate available: 0.1.6 → 0.2.0. Run \`gchat update\` to install.\n`

Place in `src/utils/update-utils.ts`.

---

## Integration with existing code

In `src/gchat.ts`, modify `main()`:

1. At the start of the interactive command flow (after confirming the command is `install` or `uninstall`), fire `VersionCheckService.checkForUpdate()` as a non-awaited promise.
2. After the command completes (before `prompt.close()`), await the version check promise.
3. If the result is non-null and `updateAvailable` is true, print the notice to stderr (using `console.error` to keep stdout clean, matching the existing pattern in `main()` for error output).

The `update` command (added in `business-logic-02B-update-command.md`) does not show the notice — it already performs the update.

---

## TDD Gherkin Tests

- [ ] `Given VersionCheckService returns updateAvailable: true When an interactive command completes Then the update notice is printed`
- [ ] `Given VersionCheckService returns updateAvailable: false When an interactive command completes Then no notice is printed`
- [ ] `Given VersionCheckService returns null When an interactive command completes Then no notice is printed`
- [ ] `Given a hook command (cursor-join) is executed Then the version check is not fired`
- [ ] `Given formatUpdateNotice is called with ("0.1.6", "0.2.0") Then it returns the formatted string`

---

## Acceptance Criteria

- [ ] `formatUpdateNotice` exists in `src/utils/update-utils.ts`
- [ ] Interactive commands (`install`, `uninstall`) fire the version check in parallel and print the notice after completion
- [ ] Hook commands (`cursor-join`, `cursor-leave`) do not trigger the version check
- [ ] The `update` command does not show the notice
- [ ] Network failures and check errors do not affect command execution
- [ ] Unit tests cover all Gherkin scenarios
- [ ] All existing tests pass (`npm test`)

---

## Suggested Approach

1. Create `src/utils/update-utils.ts` with `formatUpdateNotice`
2. Modify `main()` in `src/gchat.ts` to fire the version check in parallel for interactive commands
3. Add tests in `src/__tests__/update-notice.test.ts`
4. Run `npm test` to verify all tests pass
