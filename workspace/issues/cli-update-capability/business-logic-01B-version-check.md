---
name: "⚙️ Version check service"
type: business-logic
order: "01B"
status: pending
labels: ["type:business-logic", "team:tools", "effort:low", "value:high"]
parent: "feature-00-cli-update-capability.md"
dependencies: []
skills: []
---

Load the following skills before starting: none required.

## 🛠️ Skills, tools & MCPs

- No external skills required. Uses Node.js built-in `https` module for the npm registry query.

## 🔗 Dependencies

- None. This is a foundational issue.
- For additional planning context, read the parent: `feature-00-cli-update-capability.md`

---

## ⚙️ Services

### VersionCheckService

Purpose: Query the npm registry for the latest published version of `group-chat-mcp`, compare it to the locally installed version, and cache the result for 24 hours.

#### State
- [ ] `cachePath`: string - `~/.group-chat-mcp/version-check.json` (use `BASE_DIR` from `src/constants/storage.ts`)
- [ ] `packageName`: string - `group-chat-mcp`
- [ ] `cacheTtlMs`: number - `86_400_000` (24 hours)

#### Public Getters
- [ ] `getLocalVersion`: () → string - Read `version` from the package's own `package.json` (resolved relative to the module, not `process.cwd()`).
- [ ] `checkForUpdate`: () → Promise<{ current: string; latest: string; updateAvailable: boolean } | null> - Check if a newer version is available. Returns null if the check fails (network error, timeout, corrupt cache). Uses the cache if fresh; queries the npm registry otherwise.

#### Private Methods
- [ ] `fetchLatestVersion`: () → Promise<string | null> - HTTP GET `https://registry.npmjs.org/group-chat-mcp/latest` and extract `version` from the JSON response. Timeout after 3 seconds. Return null on any failure.
- [ ] `readCache`: () → Promise<{ latest: string; checkedAt: number } | null> - Read the cache file. Return null if missing, corrupt, or expired (checkedAt + cacheTtlMs < Date.now()).
- [ ] `writeCache`: (latest: string) → Promise<void> - Write `{ latest, checkedAt: Date.now() }` to the cache file.

#### TDD Gherkin Tests
- [ ] `Given a fresh cache with latest "0.2.0" When checkForUpdate is called and local version is "0.1.6" Then it returns { current: "0.1.6", latest: "0.2.0", updateAvailable: true } without hitting the registry`
- [ ] `Given a fresh cache with latest "0.1.6" When checkForUpdate is called and local version is "0.1.6" Then it returns { current: "0.1.6", latest: "0.1.6", updateAvailable: false }`
- [ ] `Given an expired cache When checkForUpdate is called Then it queries the npm registry and writes a new cache`
- [ ] `Given no cache file When checkForUpdate is called Then it queries the npm registry and writes a new cache`
- [ ] `Given the npm registry is unreachable When checkForUpdate is called with no cache Then it returns null`
- [ ] `Given a corrupt cache file When checkForUpdate is called Then it queries the npm registry`
- [ ] `Given getLocalVersion is called Then it returns the version from the package's package.json`

---

## 📦 DTOs

### VersionCheckCache

```yaml
name: VersionCheckCache
description: Cached result of the latest version check
fields:
  latest:
    description: The latest version available on npm
    type: string
    required: true
    example: "0.2.0"
  checkedAt:
    description: Unix timestamp (ms) when the check was performed
    type: number
    required: true
    example: 1711324800000
```

---

## 📌 Constants

- [ ] `VERSION_CHECK_FILE` = `version-check.json` (add to `src/constants/storage.ts`)
- [ ] `VERSION_CHECK_TTL_MS` = `86_400_000` (add to `src/constants/storage.ts`)
- [ ] `NPM_REGISTRY_TIMEOUT_MS` = `3000` (add to `src/constants/storage.ts`)

---

## Acceptance Criteria

- [ ] `VersionCheckService` exists at `src/services/version-check-service.ts`
- [ ] Constants added to `src/constants/storage.ts`
- [ ] `checkForUpdate` returns the correct comparison result using cached or fresh data
- [ ] Cache is written after a fresh registry query
- [ ] Cache is respected when fresh (skips registry call)
- [ ] Network failures, timeouts, and corrupt cache files do not throw — return null
- [ ] `getLocalVersion` reads the package's own package.json (not cwd)
- [ ] Unit tests in `src/__tests__/version-check-service.test.ts` cover all Gherkin scenarios
- [ ] All existing tests pass (`npm test`)

---

## Suggested Approach

1. Add constants to `src/constants/storage.ts`
2. Create `src/services/version-check-service.ts` with the service
3. Create `src/__tests__/version-check-service.test.ts` with unit tests
4. Use Node.js built-in `https` (or `node:https`) for the registry call — no new dependencies
5. Run `npm test` to verify all tests pass
