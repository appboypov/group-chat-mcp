---
name: "🧹 Project scaffolding for group-chat-mcp"
type: chore
order: "01"
status: pending
labels: ["type:chore", "team:tools", "effort:low", "value:low"]
parent: "feature-00-group-chat-mcp.md"
dependencies: []
skills: ["mcp-builder"]
---

Load the following skills before starting: `mcp-builder`

# 🧹 Project scaffolding for group-chat-mcp

## 🔗 Dependencies

- None — first issue in the chain

## 🔀 Related Issues

- feature-00-group-chat-mcp.md — parent feature spec (fetch for full context)

---

## 🛠️ Skills, tools & MCPs

- `mcp-builder` — MCP server project structure and SDK setup patterns

---

## 🧹 Chore

Initialize the TypeScript project at `/Users/codaveto/Repos/group-chat-mcp/` with all dependencies and configuration needed for an MCP server with channel capability.

## 📦 Scope

### In scope
- [ ] package.json with name, version, scripts, dependencies
- [ ] tsconfig.json for TypeScript compilation
- [ ] Project folder structure
- [ ] .gitignore
- [ ] Entry point file stubs (src/index.ts, src/cli.ts)

### Out of scope
- Any implementation logic — just project skeleton and config

## 📍 Baseline

- Empty directory at `/Users/codaveto/Repos/group-chat-mcp/`

## 🎯 Target state

- Fully configured TypeScript project that compiles and can be extended with MCP server code
- `npm install` succeeds
- `npm run build` compiles without errors (on stub files)
- Folder structure ready for state service, MCP server, CLI, and types

## ⚠️ Blast radius & safety

- No existing code to break — greenfield project

## ✅ Acceptance criteria

- [ ] `npm install` completes without errors
- [ ] `npm run build` compiles TypeScript without errors
- [ ] package.json includes `@modelcontextprotocol/sdk`, `zod`, and `uuid` as dependencies
- [ ] package.json includes `typescript`, `@types/node`, `@types/uuid` as dev dependencies
- [ ] tsconfig.json targets ES2022+ with ESM module resolution
- [ ] src/ folder exists with stub index.ts and cli.ts
- [ ] .gitignore covers node_modules, dist, .DS_Store

## 📝 Steps

1. Initialize package.json with `name: "group-chat-mcp"`, `version: "0.1.0"`, `type: "module"`, scripts for build/start/cli
2. Create tsconfig.json targeting ES2022, ESM output to dist/, strict mode
3. Install dependencies: `@modelcontextprotocol/sdk`, `zod`, `uuid`
4. Install dev dependencies: `typescript`, `@types/node`, `@types/uuid`
5. Create folder structure:
   ```
   src/
   ├── index.ts        (MCP server entry — stub export)
   ├── cli.ts          (CLI entry for hooks — stub export)
   ├── types/          (data models)
   ├── services/       (state service)
   └── constants/      (paths, defaults)
   ```
6. Add .gitignore (node_modules, dist, .DS_Store)
7. Run `npm run build` to verify compilation
8. Confirm acceptance criteria and no unintended regressions
