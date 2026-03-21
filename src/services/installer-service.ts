import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDE } from '../enums/ide.js';
import { Scope } from '../enums/scope.js';
import {
  CLAUDE_CODE_GLOBAL,
  CLAUDE_CODE_LOCAL,
  CURSOR_GLOBAL,
  CURSOR_LOCAL,
} from '../constants/settings-paths.js';
import type { InstallOptions } from '../types/install-options.js';
import type { UninstallOptions } from '../types/uninstall-options.js';

export class InstallerService {
  async install(options: InstallOptions): Promise<void> {
    const serverPath = this.resolveServerPath();
    const settingsPath = this.resolveSettingsPath(options.ide, options.scope);

    await fs.mkdir(path.dirname(settingsPath), { recursive: true });

    const config = await this.readSettingsFile(settingsPath);

    if (!config.mcpServers || typeof config.mcpServers !== 'object' || Array.isArray(config.mcpServers)) {
      config.mcpServers = {};
    }

    (config.mcpServers as Record<string, unknown>)['group-chat-mcp'] = {
      command: 'node',
      args: [serverPath],
    };

    await this.writeAtomically(settingsPath, config);
  }

  async uninstall(options: UninstallOptions): Promise<void> {
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
      case IDE.ClaudeCode:
        return scope === Scope.Global ? CLAUDE_CODE_GLOBAL : CLAUDE_CODE_LOCAL();
      case IDE.Cursor:
        return scope === Scope.Global ? CURSOR_GLOBAL : CURSOR_LOCAL();
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
