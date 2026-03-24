---
name: "⚙️ Install metadata service"
type: business-logic
order: "01A"
status: completed
labels: ["type:business-logic", "team:tools", "effort:low", "value:high"]
parent: "feature-00-cli-update-capability.md"
dependencies: []
skills: []
---

Load the following skills before starting: none required.

## 🛠️ Skills, tools & MCPs

- No external skills required. Standard Node.js file I/O.

## 🔗 Dependencies

- None. This is a foundational issue.
- For additional planning context, read the parent: `feature-00-cli-update-capability.md`

---

## ⚙️ Services

### InstallMetadataService

Purpose: Persist, read, and remove IDE+scope installation records so `gchat update` knows which configurations to refresh after updating the npm package.

#### State
- [ ] `metadataPath`: string - `~/.group-chat-mcp/install-meta.json` (use `BASE_DIR` from `src/constants/storage.ts`)

#### Public Mutators
- [ ] `addInstall`: (ide: IDE, scope: Scope) → Promise<void> - Add an IDE+scope entry to the metadata file. Idempotent: if the combo already exists, no-op.
- [ ] `removeInstall`: (ide: IDE, scope: Scope) → Promise<void> - Remove an IDE+scope entry from the metadata file. If the combo does not exist, no-op. If the file becomes empty, delete it.

#### Public Getters
- [ ] `getInstalls`: () → Promise<Array<{ ide: IDE; scope: Scope }>> - Read and return all persisted IDE+scope entries. If the file does not exist or is corrupt, return an empty array.

#### TDD Gherkin Tests
- [ ] `Given no metadata file exists When addInstall is called with (ClaudeCode, Global) Then the file is created with one entry`
- [ ] `Given a metadata file with (ClaudeCode, Global) When addInstall is called with (Cursor, Local) Then the file contains both entries`
- [ ] `Given a metadata file with (ClaudeCode, Global) When addInstall is called with (ClaudeCode, Global) again Then the file still contains one entry (idempotent)`
- [ ] `Given a metadata file with one entry When removeInstall is called for that entry Then the file is deleted`
- [ ] `Given a metadata file with two entries When removeInstall is called for one Then the file contains the other entry`
- [ ] `Given no metadata file exists When removeInstall is called Then no error is thrown`
- [ ] `Given no metadata file exists When getInstalls is called Then an empty array is returned`
- [ ] `Given a corrupt metadata file When getInstalls is called Then an empty array is returned`

---

## 📦 DTOs

### InstallEntry

```yaml
name: InstallEntry
description: A single IDE+scope installation record
fields:
  ide:
    description: The IDE that was configured
    type: string
    required: true
    example: "claude-code"
  scope:
    description: The scope of the installation
    type: string
    required: true
    example: "global"
```

---

## 📌 Constants

- [ ] `INSTALL_META_FILE` = `install-meta.json` (add to `src/constants/storage.ts`)

---

## Integration with existing code

The `InstallerService` in `src/services/installer-service.ts` must be updated:

1. In `install()`: after successful installation, call `InstallMetadataService.addInstall(ide, scope)`.
2. In `uninstall()`: after successful uninstallation, call `InstallMetadataService.removeInstall(ide, scope)`.

The `InstallerService.install()` method receives `InstallOptions` which already contains `ide` and `scope`. Same for `uninstall()` with `UninstallOptions`.

---

## Acceptance Criteria

- [ ] `InstallMetadataService` exists at `src/services/install-metadata-service.ts`
- [ ] `INSTALL_META_FILE` constant added to `src/constants/storage.ts`
- [ ] `gchat install` persists the chosen IDE+scope to `~/.group-chat-mcp/install-meta.json`
- [ ] `gchat uninstall` removes the corresponding IDE+scope from the metadata file
- [ ] Metadata file is deleted when the last entry is removed
- [ ] Corrupt or missing metadata files do not crash the CLI
- [ ] Unit tests in `src/__tests__/install-metadata-service.test.ts` cover all Gherkin scenarios
- [ ] All existing tests pass (`npm test`)

---

## Suggested Approach

1. Add `INSTALL_META_FILE` to `src/constants/storage.ts`
2. Create `src/services/install-metadata-service.ts` with the service
3. Create `src/__tests__/install-metadata-service.test.ts` with unit tests
4. Update `InstallerService.install()` and `uninstall()` to call the metadata service
5. Run `npm test` to verify all tests pass
