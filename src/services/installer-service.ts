import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDE } from '../enums/ide.js';
import { Scope } from '../enums/scope.js';
import {
  CURSOR_GLOBAL,
  CURSOR_LOCAL,
  CURSOR_HOOKS_GLOBAL,
  CURSOR_HOOKS_LOCAL,
} from '../constants/settings-paths.js';
import type { InstallOptions } from '../types/install-options.js';
import type { UninstallOptions } from '../types/uninstall-options.js';

export class InstallerService {
  async install(options: InstallOptions): Promise<void> {
    const serverPath = this.resolveServerPath();

    if (options.ide === IDE.ClaudeCode) {
      const scope = this.claudeCodeScope(options.scope);
      this.execClaudeCli(['mcp', 'add', 'group-chat-mcp', '--scope', scope, '--', 'node', serverPath]);
      return;
    }

    // Cursor: JSON file approach
    const settingsPath = this.resolveSettingsPath(options.ide, options.scope);
    await fs.mkdir(path.dirname(settingsPath), { recursive: true });
    const config = await this.readSettingsFile(settingsPath);

    if (!config.mcpServers || typeof config.mcpServers !== 'object' || Array.isArray(config.mcpServers)) {
      config.mcpServers = {};
    }

    (config.mcpServers as Record<string, unknown>)['group-chat-mcp'] = {
      command: 'node',
      args: [serverPath],
      env: {
        GC_CLIENT_TYPE: 'cursor',
        GC_POLL_INTERVAL_MS: '5000',
      },
    };

    await this.writeAtomically(settingsPath, config);

    // Hooks: write hooks.json
    const hookScriptPath = this.resolveHookScriptPath();
    const hooksPath = this.resolveHooksPath(options.ide, options.scope);
    await fs.mkdir(path.dirname(hooksPath), { recursive: true });
    const hooksConfig = await this.readSettingsFile(hooksPath);

    if (!hooksConfig.version) {
      hooksConfig.version = 1;
    }

    if (!hooksConfig.hooks || typeof hooksConfig.hooks !== 'object' || Array.isArray(hooksConfig.hooks)) {
      hooksConfig.hooks = {};
    }

    const hooks = hooksConfig.hooks as Record<string, unknown[]>;
    const hookCommand = `node "${hookScriptPath}"`;

    const sessionStartEntry = { command: hookCommand, timeout: 10 };
    const sessionEndEntry = { command: hookCommand, timeout: 5 };
    const beforeMCPExecutionEntry = { command: hookCommand, timeout: 5, matcher: 'MCP:group-chat-mcp' };

    const mergeHookEntries = (eventName: string, entry: Record<string, unknown>): void => {
      if (!Array.isArray(hooks[eventName])) {
        hooks[eventName] = [];
      }
      const arr = hooks[eventName] as Record<string, unknown>[];
      const idx = arr.findIndex((e) => typeof e.command === 'string' && (e.command as string).includes('cursor-hook.js'));
      if (idx >= 0) {
        arr[idx] = entry;
      } else {
        arr.push(entry);
      }
    };

    mergeHookEntries('sessionStart', sessionStartEntry);
    mergeHookEntries('sessionEnd', sessionEndEntry);
    mergeHookEntries('beforeMCPExecution', beforeMCPExecutionEntry);

    await this.writeAtomically(hooksPath, hooksConfig);
  }

  async uninstall(options: UninstallOptions): Promise<void> {
    if (options.ide === IDE.ClaudeCode) {
      const scope = this.claudeCodeScope(options.scope);
      try {
        this.execClaudeCli(['mcp', 'remove', 'group-chat-mcp', '--scope', scope]);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (!message.toLowerCase().includes('not found')) {
          throw err;
        }
      }
      return;
    }

    // Cursor: JSON file approach
    const settingsPath = this.resolveSettingsPath(options.ide, options.scope);

    let config: Record<string, unknown>;
    try {
      config = await this.readSettingsFile(settingsPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw err;
    }

    if (!config.mcpServers || typeof config.mcpServers !== 'object' || Array.isArray(config.mcpServers)) {
      return;
    }

    const servers = config.mcpServers as Record<string, unknown>;
    if (!('group-chat-mcp' in servers)) {
      return;
    }

    delete servers['group-chat-mcp'];

    await this.writeAtomically(settingsPath, config);

    // Hooks: clean up hooks.json
    const hooksPath = this.resolveHooksPath(options.ide, options.scope);
    let hooksConfig: Record<string, unknown>;
    try {
      hooksConfig = await this.readSettingsFile(hooksPath);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return;
      }
      throw err;
    }

    if (!hooksConfig.hooks || typeof hooksConfig.hooks !== 'object' || Array.isArray(hooksConfig.hooks)) {
      return;
    }

    const hooks = hooksConfig.hooks as Record<string, unknown[]>;
    for (const eventName of Object.keys(hooks)) {
      if (!Array.isArray(hooks[eventName])) {
        continue;
      }
      hooks[eventName] = (hooks[eventName] as Record<string, unknown>[]).filter(
        (e) => typeof e.command !== 'string' || !(e.command as string).includes('cursor-hook.js'),
      );
    }

    await this.writeAtomically(hooksPath, hooksConfig);
  }

  resolveServerPath(): string {
    const currentFile = fileURLToPath(import.meta.url);
    const servicesDir = path.dirname(currentFile);
    const distDir = path.dirname(servicesDir);
    const serverPath = path.join(distDir, 'index.js');

    if (!existsSync(serverPath)) {
      throw new Error(
        `Server entry point not found at ${serverPath}. Run 'npm run build' first.`,
      );
    }

    return serverPath;
  }

  resolveSettingsPath(ide: IDE, scope: Scope): string {
    switch (ide) {
      case IDE.Cursor:
        return scope === Scope.Global ? CURSOR_GLOBAL : CURSOR_LOCAL();
      default:
        throw new Error(`resolveSettingsPath is not supported for ${ide}`);
    }
  }

  resolveHooksPath(ide: IDE, scope: Scope): string {
    switch (ide) {
      case IDE.Cursor:
        return scope === Scope.Global ? CURSOR_HOOKS_GLOBAL : CURSOR_HOOKS_LOCAL();
      default:
        throw new Error(`resolveHooksPath is not supported for ${ide}`);
    }
  }

  resolveHookScriptPath(): string {
    const currentFile = fileURLToPath(import.meta.url);
    const servicesDir = path.dirname(currentFile);
    const distDir = path.dirname(servicesDir);
    const hookScriptPath = path.join(distDir, 'hooks', 'cursor-hook.js');

    if (!existsSync(hookScriptPath)) {
      throw new Error(
        `Hook script not found at ${hookScriptPath}. Run 'npm run build' first.`,
      );
    }

    return hookScriptPath;
  }

  claudeCodeScope(scope: Scope): string {
    return scope === Scope.Global ? 'user' : 'project';
  }

  protected execClaudeCli(args: string[]): void {
    try {
      execFileSync('claude', args, { stdio: 'pipe' });
    } catch (err: unknown) {
      const nodeErr = err as NodeJS.ErrnoException;
      if (nodeErr.code === 'ENOENT') {
        throw new Error('Claude Code CLI not found. Install it from https://docs.anthropic.com/en/docs/claude-code');
      }
      const stderr = (err as { stderr?: Buffer })?.stderr?.toString().trim() ?? '';
      throw new Error(`Claude CLI failed: ${stderr || 'unknown error'}`);
    }
  }

  private async readSettingsFile(settingsPath: string): Promise<Record<string, unknown>> {
    let raw: string;
    try {
      raw = await fs.readFile(settingsPath, 'utf-8');
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return {};
      }
      throw err;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Settings file contains invalid JSON — fix manually before retrying');
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Settings file contains invalid JSON — fix manually before retrying');
    }

    return parsed as Record<string, unknown>;
  }

  private async writeAtomically(filePath: string, data: Record<string, unknown>): Promise<void> {
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    try {
      await fs.rename(tmpPath, filePath);
    } catch (err) {
      await fs.unlink(tmpPath).catch(() => {});
      throw err;
    }
  }
}
