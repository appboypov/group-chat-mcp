import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { InstallerService } from '../../src/services/installer-service.js';
import { IDE } from '../../src/enums/ide.js';
import { Scope } from '../../src/enums/scope.js';
import { parseCommand } from '../../src/gchat.js';

class TestInstallerService extends InstallerService {
  private readonly testServerPath: string;
  private readonly testSettingsPath: string;

  constructor(testServerPath: string, testSettingsPath: string) {
    super();
    this.testServerPath = testServerPath;
    this.testSettingsPath = testSettingsPath;
  }

  override resolveServerPath(): string {
    return this.testServerPath;
  }

  override resolveSettingsPath(_ide: IDE, _scope: Scope): string {
    return this.testSettingsPath;
  }
}

describe('InstallerService', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `installer-service-test-${uuidv4()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('Given no settings file exists When install is called for Claude Code global Then a new settings.json is created with the correct mcpServers entry', async () => {
    const serverPath = '/test/dist/index.js';
    const settingsPath = path.join(tempDir, 'settings.json');
    const service = new TestInstallerService(serverPath, settingsPath);

    await service.install({ ide: IDE.ClaudeCode, scope: Scope.Global });

    const raw = await fs.readFile(settingsPath, 'utf-8');
    const config = JSON.parse(raw);
    expect(config.mcpServers['group-chat-mcp']).toEqual({
      command: 'node',
      args: [serverPath],
    });
  });

  it('Given a settings file with existing MCP servers When install is called Then group-chat-mcp is added alongside existing entries', async () => {
    const serverPath = '/test/dist/index.js';
    const settingsPath = path.join(tempDir, 'settings.json');
    const service = new TestInstallerService(serverPath, settingsPath);

    await fs.writeFile(
      settingsPath,
      JSON.stringify({
        mcpServers: { 'other-mcp': { command: 'node', args: ['/other'] } },
      }),
    );

    await service.install({ ide: IDE.ClaudeCode, scope: Scope.Global });

    const raw = await fs.readFile(settingsPath, 'utf-8');
    const config = JSON.parse(raw);
    expect(config.mcpServers['other-mcp']).toEqual({
      command: 'node',
      args: ['/other'],
    });
    expect(config.mcpServers['group-chat-mcp']).toEqual({
      command: 'node',
      args: [serverPath],
    });
  });

  it('Given group-chat-mcp already exists in settings When install is called Then the entry is overwritten with the current path', async () => {
    const settingsPath = path.join(tempDir, 'settings.json');
    const newServerPath = '/new/dist/index.js';
    const service = new TestInstallerService(newServerPath, settingsPath);

    await fs.writeFile(
      settingsPath,
      JSON.stringify({
        mcpServers: {
          'group-chat-mcp': { command: 'node', args: ['/old/dist/index.js'] },
        },
      }),
    );

    await service.install({ ide: IDE.ClaudeCode, scope: Scope.Global });

    const raw = await fs.readFile(settingsPath, 'utf-8');
    const config = JSON.parse(raw);
    expect(config.mcpServers['group-chat-mcp']).toEqual({
      command: 'node',
      args: [newServerPath],
    });
  });

  it('Given group-chat-mcp exists in settings When uninstall is called Then the entry is removed and all other settings are preserved', async () => {
    const settingsPath = path.join(tempDir, 'settings.json');
    const service = new TestInstallerService('/test/dist/index.js', settingsPath);

    await fs.writeFile(
      settingsPath,
      JSON.stringify({
        mcpServers: {
          'other-mcp': { command: 'node', args: ['/other'] },
          'group-chat-mcp': { command: 'node', args: ['/test/dist/index.js'] },
        },
      }),
    );

    await service.uninstall({ ide: IDE.ClaudeCode, scope: Scope.Global });

    const raw = await fs.readFile(settingsPath, 'utf-8');
    const config = JSON.parse(raw);
    expect(config.mcpServers['other-mcp']).toEqual({
      command: 'node',
      args: ['/other'],
    });
    expect(config.mcpServers['group-chat-mcp']).toBeUndefined();
  });

  it('Given no settings file exists When uninstall is called Then no error occurs', async () => {
    const settingsPath = path.join(tempDir, 'nonexistent', 'settings.json');
    const service = new TestInstallerService('/test/dist/index.js', settingsPath);

    await expect(
      service.uninstall({ ide: IDE.ClaudeCode, scope: Scope.Global }),
    ).resolves.toBeUndefined();
  });

  it('Given Cursor global scope When resolveSettingsPath is called Then the path is path.join(os.homedir(), .cursor, mcp.json)', () => {
    const service = new InstallerService();
    const result = service.resolveSettingsPath(IDE.Cursor, Scope.Global);
    expect(result).toBe(path.join(os.homedir(), '.cursor', 'mcp.json'));
  });

  it('Given Claude Code local scope When resolveSettingsPath is called Then the path is path.join(process.cwd(), .mcp.json)', () => {
    const service = new InstallerService();
    const result = service.resolveSettingsPath(IDE.ClaudeCode, Scope.Local);
    expect(result).toBe(path.join(process.cwd(), '.mcp.json'));
  });

  it('Given a settings.json with existing non-MCP settings When install is called Then all non-mcpServers keys are preserved unchanged', async () => {
    const serverPath = '/test/dist/index.js';
    const settingsPath = path.join(tempDir, 'settings.json');
    const service = new TestInstallerService(serverPath, settingsPath);

    await fs.writeFile(
      settingsPath,
      JSON.stringify({
        allowedTools: ['tool1'],
        permissions: { read: true },
        mcpServers: {},
      }),
    );

    await service.install({ ide: IDE.ClaudeCode, scope: Scope.Global });

    const raw = await fs.readFile(settingsPath, 'utf-8');
    const config = JSON.parse(raw);
    expect(config.allowedTools).toEqual(['tool1']);
    expect(config.permissions).toEqual({ read: true });
    expect(config.mcpServers['group-chat-mcp']).toBeDefined();
  });

  it('Given dist/index.js does not exist at the resolved path When resolveServerPath is called Then an error is thrown', () => {
    const service = new InstallerService();
    expect(() => service.resolveServerPath()).toThrow();
  });

  it('Given Claude Code local scope When install is called Then .mcp.json is created in the current directory', async () => {
    const serverPath = '/test/dist/index.js';
    const settingsPath = path.join(tempDir, '.mcp.json');
    const service = new TestInstallerService(serverPath, settingsPath);

    await service.install({ ide: IDE.ClaudeCode, scope: Scope.Local });

    const exists = await fs.stat(settingsPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const raw = await fs.readFile(settingsPath, 'utf-8');
    const config = JSON.parse(raw);
    expect(config.mcpServers['group-chat-mcp']).toEqual({
      command: 'node',
      args: [serverPath],
    });
  });

  it('Given Cursor global scope When install is called Then the settings file is created with the correct entry', async () => {
    const serverPath = '/test/dist/index.js';
    const settingsPath = path.join(tempDir, '.cursor', 'mcp.json');
    const service = new TestInstallerService(serverPath, settingsPath);

    await service.install({ ide: IDE.Cursor, scope: Scope.Global });

    const raw = await fs.readFile(settingsPath, 'utf-8');
    const config = JSON.parse(raw);
    expect(config.mcpServers['group-chat-mcp']).toEqual({
      command: 'node',
      args: [serverPath],
    });
  });

  it('Given a settings file with invalid JSON When install is called Then an error is thrown with a message to fix the file manually', async () => {
    const settingsPath = path.join(tempDir, 'settings.json');
    const service = new TestInstallerService('/test/dist/index.js', settingsPath);

    await fs.writeFile(settingsPath, 'not valid json {{{');

    await expect(
      service.install({ ide: IDE.ClaudeCode, scope: Scope.Global }),
    ).rejects.toThrow();
  });

  it('Given the parent directory for the settings file does not exist When install is called Then the directory is created before writing', async () => {
    const serverPath = '/test/dist/index.js';
    const settingsPath = path.join(tempDir, 'nonexistent', 'subdir', 'settings.json');
    const service = new TestInstallerService(serverPath, settingsPath);

    await service.install({ ide: IDE.ClaudeCode, scope: Scope.Global });

    const raw = await fs.readFile(settingsPath, 'utf-8');
    const config = JSON.parse(raw);
    expect(config.mcpServers['group-chat-mcp']).toEqual({
      command: 'node',
      args: [serverPath],
    });
  });

  it('Given install is called Then the group-chat-mcp entry has command node and args containing the absolute path to dist/index.js', async () => {
    const serverPath = '/absolute/path/to/dist/index.js';
    const settingsPath = path.join(tempDir, 'settings.json');
    const service = new TestInstallerService(serverPath, settingsPath);

    await service.install({ ide: IDE.ClaudeCode, scope: Scope.Global });

    const raw = await fs.readFile(settingsPath, 'utf-8');
    const config = JSON.parse(raw);
    const entry = config.mcpServers['group-chat-mcp'];
    expect(entry.command).toBe('node');
    expect(entry.args).toEqual([serverPath]);
    expect(path.isAbsolute(entry.args[0])).toBe(true);
  });

  it('Given group-chat-mcp already exists with a different path When install is called Then exactly one entry exists with the updated path', async () => {
    const settingsPath = path.join(tempDir, 'settings.json');
    const newServerPath = '/updated/dist/index.js';
    const service = new TestInstallerService(newServerPath, settingsPath);

    await fs.writeFile(
      settingsPath,
      JSON.stringify({
        mcpServers: {
          'group-chat-mcp': { command: 'node', args: ['/old/dist/index.js'] },
        },
      }),
    );

    await service.install({ ide: IDE.ClaudeCode, scope: Scope.Global });

    const raw = await fs.readFile(settingsPath, 'utf-8');
    const config = JSON.parse(raw);
    const keys = Object.keys(config.mcpServers).filter((k) => k === 'group-chat-mcp');
    expect(keys).toHaveLength(1);
    expect(config.mcpServers['group-chat-mcp'].args).toEqual([newServerPath]);
  });
});

describe('CLI Entry Point', () => {
  it('Given args ["install"] When parseCommand is called Then it returns { command: "install" }', () => {
    const result = parseCommand(['install']);
    expect(result).toEqual({ command: 'install' });
  });

  it('Given args [] (empty) When parseCommand is called Then it returns { error: "no-command" }', () => {
    const result = parseCommand([]);
    expect(result).toEqual({ error: 'no-command' });
  });

  it('Given args ["unknown"] When parseCommand is called Then it returns { error: "unknown-command" }', () => {
    const result = parseCommand(['unknown']);
    expect(result).toEqual({ error: 'unknown-command' });
  });
});
