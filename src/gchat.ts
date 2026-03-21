#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { IDE } from './enums/ide.js';
import { Scope } from './enums/scope.js';
import { InstallerService } from './services/installer-service.js';
import type { ParseResult } from './types/parse-result.js';
import { PromptUtils } from './utils/prompt-utils.js';

const installer = new InstallerService();

export function parseCommand(args: string[]): ParseResult {
  const command = args[0];
  if (!command) {
    return { error: 'no-command' };
  }
  if (command !== 'install' && command !== 'uninstall') {
    return { error: 'unknown-command' };
  }
  return { command };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const result = parseCommand(args);

  if ('error' in result) {
    if (result.error === 'no-command') {
      console.error('Usage: gchat <command>');
      console.error('Commands:');
      console.error('  install     Install group-chat-mcp into your IDE');
      console.error('  uninstall   Remove group-chat-mcp from your IDE');
      process.exit(1);
    }
    console.error(`Unknown command: ${args[0]}`);
    console.error('Available commands: install, uninstall');
    process.exit(1);
  }

  const prompt = new PromptUtils();
  try {
    const ides = await prompt.selectIDE();
    const scope = await prompt.selectScope();

    for (const ide of ides) {
      const ideName = ide === IDE.ClaudeCode ? 'Claude Code' : 'Cursor';
      const scopeName = scope === Scope.Global ? 'global' : 'local';

      if (result.command === 'install') {
        await installer.install({ ide, scope });
        if (ide === IDE.ClaudeCode) {
          const claudeScope = installer.claudeCodeScope(scope);
          console.log(`✓ Installed group-chat-mcp for ${ideName} (${claudeScope})`);
        } else {
          const settingsPath = installer.resolveSettingsPath(ide, scope);
          console.log(`✓ Installed group-chat-mcp for ${ideName} (${scopeName}): ${settingsPath}`);
        }
      } else {
        await installer.uninstall({ ide, scope });
        if (ide === IDE.ClaudeCode) {
          const claudeScope = installer.claudeCodeScope(scope);
          console.log(`✓ Uninstalled group-chat-mcp from ${ideName} (${claudeScope})`);
        } else {
          const settingsPath = installer.resolveSettingsPath(ide, scope);
          console.log(`✓ Uninstalled group-chat-mcp from ${ideName} (${scopeName}): ${settingsPath}`);
        }
      }
    }
  } finally {
    prompt.close();
  }
}

const currentFile = fileURLToPath(import.meta.url);
const isDirectExecution = (() => {
  try {
    return realpathSync(process.argv[1]) === currentFile;
  } catch {
    return false;
  }
})();

if (isDirectExecution) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
