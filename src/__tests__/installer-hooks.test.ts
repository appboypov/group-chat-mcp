import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { InstallerService } from '../services/installer-service.js';
import { IDE } from '../enums/ide.js';
import { Scope } from '../enums/scope.js';

class TestableInstallerService extends InstallerService {
  private readonly testDir: string;

  constructor(testDir: string) {
    super();
    this.testDir = testDir;
  }

  override resolveSettingsPath(_ide: IDE, _scope: Scope): string {
    return path.join(this.testDir, 'mcp.json');
  }

  override resolveHooksPath(_ide: IDE, _scope: Scope): string {
    return path.join(this.testDir, 'hooks.json');
  }

  override resolveServerPath(): string {
    return '/fake/dist/index.js';
  }

  override resolveHookScriptPath(): string {
    return '/fake/dist/hooks/cursor-hook.js';
  }

  protected override execClaudeCli(): void {
    // no-op for tests
  }
}

let tmpDir: string;
let installer: TestableInstallerService;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gchat-installer-test-'));
  installer = new TestableInstallerService(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('InstallerService', () => {
  describe('Given no existing hooks.json', () => {
    it('When install(Cursor, Global) is called Then hooks.json is created with sessionStart, sessionEnd, and beforeMCPExecution entries', async () => {
      await installer.install({ ide: IDE.Cursor, scope: Scope.Global });

      const hooksPath = path.join(tmpDir, 'hooks.json');
      const raw = await fs.readFile(hooksPath, 'utf-8');
      const hooksConfig = JSON.parse(raw);

      expect(hooksConfig.version).toBe(1);
      expect(hooksConfig.hooks.sessionStart).toBeDefined();
      expect(hooksConfig.hooks.sessionEnd).toBeDefined();
      expect(hooksConfig.hooks.beforeMCPExecution).toBeDefined();

      const sessionStartEntries = hooksConfig.hooks.sessionStart as { command: string }[];
      expect(sessionStartEntries.some((e: { command: string }) => e.command.includes('cursor-hook.js'))).toBe(true);

      const sessionEndEntries = hooksConfig.hooks.sessionEnd as { command: string }[];
      expect(sessionEndEntries.some((e: { command: string }) => e.command.includes('cursor-hook.js'))).toBe(true);

      const beforeMCPEntries = hooksConfig.hooks.beforeMCPExecution as { command: string; matcher?: string }[];
      const mcpEntry = beforeMCPEntries.find((e: { command: string }) => e.command.includes('cursor-hook.js'));
      expect(mcpEntry).toBeDefined();
      expect(mcpEntry!.matcher).toBe('MCP:group-chat-mcp');
    });
  });

  describe('Given existing hooks.json with other hooks', () => {
    it('When install(Cursor, Global) is called Then group-chat-mcp entries are added and existing hooks are preserved', async () => {
      const hooksPath = path.join(tmpDir, 'hooks.json');
      const existingConfig = {
        version: 1,
        hooks: {
          sessionStart: [{ command: 'echo custom-hook', timeout: 5 }],
        },
      };
      await fs.writeFile(hooksPath, JSON.stringify(existingConfig, null, 2), 'utf-8');

      await installer.install({ ide: IDE.Cursor, scope: Scope.Global });

      const raw = await fs.readFile(hooksPath, 'utf-8');
      const hooksConfig = JSON.parse(raw);

      const sessionStartEntries = hooksConfig.hooks.sessionStart as { command: string }[];
      expect(sessionStartEntries.some((e: { command: string }) => e.command === 'echo custom-hook')).toBe(true);
      expect(sessionStartEntries.some((e: { command: string }) => e.command.includes('cursor-hook.js'))).toBe(true);
    });
  });

  describe('Given hooks.json with group-chat-mcp entries', () => {
    it('When uninstall(Cursor, Global) is called Then group-chat-mcp entries are removed from all hook events and other hooks are preserved', async () => {
      await installer.install({ ide: IDE.Cursor, scope: Scope.Global });

      const hooksPath = path.join(tmpDir, 'hooks.json');
      const raw = await fs.readFile(hooksPath, 'utf-8');
      const hooksConfig = JSON.parse(raw);
      hooksConfig.hooks.sessionStart.push({ command: 'echo custom-hook', timeout: 5 });
      await fs.writeFile(hooksPath, JSON.stringify(hooksConfig, null, 2), 'utf-8');

      await installer.uninstall({ ide: IDE.Cursor, scope: Scope.Global });

      const rawAfter = await fs.readFile(hooksPath, 'utf-8');
      const hooksAfter = JSON.parse(rawAfter);

      const sessionStartEntries = hooksAfter.hooks.sessionStart as { command: string }[];
      expect(sessionStartEntries.some((e: { command: string }) => e.command.includes('cursor-hook.js'))).toBe(false);
      expect(sessionStartEntries.some((e: { command: string }) => e.command === 'echo custom-hook')).toBe(true);

      const sessionEndEntries = (hooksAfter.hooks.sessionEnd ?? []) as { command: string }[];
      expect(sessionEndEntries.some((e: { command: string }) => e.command.includes('cursor-hook.js'))).toBe(false);

      const beforeMCPEntries = (hooksAfter.hooks.beforeMCPExecution ?? []) as { command: string }[];
      expect(beforeMCPEntries.some((e: { command: string }) => e.command.includes('cursor-hook.js'))).toBe(false);
    });
  });

  describe('Given Cursor install', () => {
    it('When mcp.json is written Then it includes GC_CLIENT_TYPE and GC_POLL_INTERVAL_MS in the env block', async () => {
      await installer.install({ ide: IDE.Cursor, scope: Scope.Global });

      const mcpPath = path.join(tmpDir, 'mcp.json');
      const raw = await fs.readFile(mcpPath, 'utf-8');
      const config = JSON.parse(raw);

      const serverConfig = config.mcpServers['group-chat-mcp'];
      expect(serverConfig.env.GC_CLIENT_TYPE).toBe('cursor');
      expect(serverConfig.env.GC_POLL_INTERVAL_MS).toBe('5000');
    });
  });
});
