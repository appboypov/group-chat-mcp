# :gear: Make 5000ms the app-wide default for GC_POLL_INTERVAL_MS

> What does this pull request accomplish and what is its impact?

- Changes the `GC_POLL_INTERVAL_MS` fallback from 2000ms to 5000ms so every client uses the same default without IDE-specific env overrides.

- The 2000ms default was arbitrary, and the Cursor installer's env-block override to 5000ms created a false impression that the value was IDE-dependent. This PR promotes 5000ms to the single app-wide default, removes the now-redundant Cursor override, and updates documentation and tests to match.

## :bar_chart: Summary of Changes
> Which files were involved in this implementation?

- `src/constants/env.ts` -- modified -- Changed both fallback values from `2000` to `5000`
- `src/services/installer-service.ts` -- modified -- Removed `GC_POLL_INTERVAL_MS: '5000'` from the Cursor installer env block
- `README.md` -- modified -- Updated Configuration table to show `5000` as the universal default
- `tests/services/installer-service.test.ts` -- modified -- Removed `GC_POLL_INTERVAL_MS: '5000'` from four env assertions
- `src/__tests__/installer-hooks.test.ts` -- modified -- Updated test name and removed poll interval assertion
- `package.json` -- modified -- Bumped version from `0.1.3` to `0.1.4`
- `src/index.ts` -- modified -- Bumped server version from `0.1.0` to `0.1.4`
- `CHANGELOG.md` -- modified -- Added `[0.1.4]` entry documenting the default change
- `workspace/issues/poll-interval-default/enhancement-01-poll-interval-default.md` -- added -- Issue specification file

## :wrench: Technical Implementation Details
> What are the detailed technical changes that were made?

- **Default poll interval (`src/constants/env.ts`)**
  - Both fallback paths (missing env var and unparseable env var) changed from `2000` to `5000`
  - No structural changes; the parsing logic is identical

- **Cursor installer env block (`src/services/installer-service.ts`)**
  - Removed the `GC_POLL_INTERVAL_MS: '5000'` line from the env object passed into mcp.json
  - The env block now contains only `GC_CLIENT_TYPE: 'cursor'`
  - Existing users who already have `GC_POLL_INTERVAL_MS: '5000'` in their mcp.json are unaffected -- the value matches the new default

- **README Configuration table (`README.md`)**
  - Default column changed from `2000 (5000 for Cursor)` to `5000`
  - Description changed to state the interval is configurable per IDE via the MCP server env block

- **Test updates (`tests/services/installer-service.test.ts`, `src/__tests__/installer-hooks.test.ts`)**
  - Four env assertions in `installer-service.test.ts` updated to expect `{ GC_CLIENT_TYPE: 'cursor' }` only
  - One assertion removed and test name updated in `installer-hooks.test.ts`

- **Version bump (`package.json`, `src/index.ts`, `CHANGELOG.md`)**
  - Version `0.1.3` to `0.1.4` in `package.json` and `src/index.ts`
  - `src/index.ts` server version corrected from `0.1.0` to `0.1.4`
  - New `[0.1.4]` changelog entry added

## :white_check_mark: Manual Acceptance Testing
> How can this implementation be manually tested?

### Default poll interval applies without env override

- **Objective:** Verify the server uses 5000ms as the poll interval when `GC_POLL_INTERVAL_MS` is not set
- **Prerequisites:** Node.js installed, project built (`npm run build`)
- [ ] Start the server without setting `GC_POLL_INTERVAL_MS` -- observe that the poll interval is 5000ms (confirm via log output or debugger on `GC_POLL_INTERVAL_MS` in `env.ts`)
- [ ] Set `GC_POLL_INTERVAL_MS=3000` and restart -- confirm the custom value takes effect
- **Success criteria:** The default is 5000ms; explicit env values override it

### Cursor installer no longer writes poll interval

- **Objective:** Verify the Cursor installer writes only `GC_CLIENT_TYPE` to the env block
- **Prerequisites:** Node.js installed, project built
- [ ] Run the Cursor installer command -- inspect the generated mcp.json
- [ ] Confirm the env block contains `{ "GC_CLIENT_TYPE": "cursor" }` and no `GC_POLL_INTERVAL_MS` key
- **Success criteria:** mcp.json env block has exactly one key: `GC_CLIENT_TYPE`

### Automated tests pass

- **Objective:** All unit tests pass with the updated assertions
- **Prerequisites:** Dependencies installed (`npm install`)
- [ ] Run `npm test` -- all tests pass
- [ ] Run `npm run build` -- build succeeds without errors
- **Success criteria:** Zero test failures and clean build

## :link: Dependencies & Impacts
> Does this change introduce new dependencies or have other system-wide impacts?

- No new packages or libraries
- No breaking changes -- existing mcp.json files with `GC_POLL_INTERVAL_MS: '5000'` are harmless since the value matches the new default
- Users who relied on the 2000ms default will now poll at 5000ms; they can restore the old interval by setting `GC_POLL_INTERVAL_MS=2000` in their MCP server env block

## :clipboard: Checklist
> Has everything been verified before submission?

- [ ] All tests pass and code follows project conventions
- [ ] Documentation updated where applicable
- [ ] Performance and security considered
- [ ] Breaking changes documented; manual testing complete where required
- [ ] CHANGELOG.md updated with `[0.1.4]` entry

## :mag: Related Issues
> Which issues does this pull request address?

- Specification: `workspace/issues/poll-interval-default/enhancement-01-poll-interval-default.md`

## :memo: Additional Notes
> Is there any other relevant information?

- The `src/index.ts` server version was `0.1.0` (stale from initial setup) and is now corrected to `0.1.4` as part of the version bump commit
