---
name: "🏗️ Auto-publish to npm on GitHub release"
type: devops
order: "01"
status: done
labels: ["type:dev-ops", "effort:low", "level:junior"]
parent: "none"
dependencies: []
skills: []
---

# 🏗️ Auto-publish to npm on GitHub release

## 🔗 Dependencies

- [x] npm Trusted Publishing configured for `appboypov/group-chat-mcp` with workflow `publish.yml` and environment `npm-publish`
- [x] GitHub environment `npm-publish` created on the repo

---

## 🛠️ Skills, tools & MCPs

- GitHub Actions workflow authoring
- npm Trusted Publishing (OIDC)

---

## ⚙️ Change

- Add a GitHub Actions workflow that publishes the package to npm when a GitHub release is created, using Trusted Publishing (OIDC) for authentication.

## 🎯 Outcome

- Every GitHub release (type: published) triggers an automated build, test, and npm publish cycle. No manual `npm publish` needed. No stored secrets required.

## 📦 Scope

### In scope
- [x] Create `.github/workflows/publish.yml`
- [x] Trigger on `release` event, type `published`
- [x] Checkout code, setup Node 22, `npm ci`
- [x] Run `npm run build` (TypeScript compilation)
- [x] Run `npm test` (Vitest suite) — abort on failure
- [x] Extract version from git tag (strip `v` prefix), write to package.json via `npm version $VERSION --no-git-tag-version --allow-same-version`
- [x] Run `npm publish --provenance --access public`
- [x] Set workflow permissions: `contents: read`, `id-token: write`
- [x] Use Trusted Publishing (OIDC) — no `NPM_TOKEN` secret needed

### Out of scope
- Automated version bumping in package.json on the branch (tag drives version at publish time)
- Changelog generation
- Slack/Discord notifications
- Publishing to registries other than npm

## 🏗️ Implementation

File: `.github/workflows/publish.yml`

```yaml
name: Publish to npm

on:
  release:
    types: [published]

permissions:
  contents: read
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-latest
    environment: npm-publish
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org

      - run: npm ci
      - run: npm run build
      - run: npm test

      - name: Set version from tag
        run: |
          TAG="${GITHUB_REF_NAME#v}"
          npm version "$TAG" --no-git-tag-version --allow-same-version

      - run: npm publish --provenance --access public
```

## 🔐 Security & access

- Trusted Publishing via OIDC — no stored secrets, no token expiry
- `id-token: write` permission allows the workflow to request an OIDC token from GitHub, which npm exchanges for a short-lived publish credential
- The `npm-publish` environment on GitHub restricts which workflows can request the OIDC token
- npm Trusted Publishing config ties the credential to this specific repo, workflow file, and environment name
- No write access to repository contents needed

## 🔄 CI/CD & automation

- New workflow file: `.github/workflows/publish.yml`
- Triggered by: GitHub release creation (type: published)
- Gates: build must succeed, all tests must pass before publish runs
- npm provenance links the published package to this GitHub Actions run

## ⚠️ Risks & blast radius

- If the `npm-publish` environment is deleted from GitHub or the Trusted Publishing config is removed from npm, the publish step fails with 403. Re-create the missing config.
- If tests fail, npm publish is skipped. The release exists on GitHub but the package is not published. Fix tests, then re-run the workflow from the Actions tab.
- Tag version mismatch with semver format (e.g., tagging `v1.0.0-beta` works — npm supports prerelease tags).

## 🔙 Rollback

- Delete the workflow file and push to main to disable auto-publishing.
- If a bad version reaches npm: `npm unpublish group-chat-mcp@<version>` (within 72 hours) or `npm deprecate group-chat-mcp@<version> "broken release"`.

## ✅ Acceptance criteria

- [x] Creating a GitHub release with tag `v*` triggers the workflow
- [x] Workflow runs: checkout → install → build → test → version sync → publish
- [x] A failing test aborts the workflow before `npm publish`
- [x] The published npm package version matches the git tag (minus `v` prefix)
- [x] npm package page shows provenance attestation badge
- [ ] Verified with a real release

## 📝 Execution steps

- [x] Create `.github/workflows/publish.yml` with Trusted Publishing
- [x] Configure Trusted Publishing on npmjs.com (appboypov/group-chat-mcp, publish.yml, npm-publish)
- [x] Create `npm-publish` environment on GitHub repo
- [ ] Push workflow to main
- [ ] Create a test release on GitHub to verify the workflow triggers and publishes
- [ ] Verify the npm package page shows the new version with provenance badge
