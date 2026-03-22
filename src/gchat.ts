#!/usr/bin/env node
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { NotificationType } from './enums/notification-type.js';
import { IDE } from './enums/ide.js';
import { Scope } from './enums/scope.js';
import { InstallerService } from './services/installer-service.js';
import { SessionStateService } from './services/session-state-service.js';
import { StateService } from './services/state-service.js';
import { writeNotificationToParticipants, writeProfileSetupNotification } from './utils/notification-utils.js';
import type { ParseResult } from './types/parse-result.js';
import { PromptUtils } from './utils/prompt-utils.js';

const installer = new InstallerService();

function parseArg(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) return undefined;
  return args[index + 1];
}

export function parseCommand(args: string[]): ParseResult {
  const command = args[0];
  if (!command) {
    return { error: 'no-command' };
  }

  if (command === 'install' || command === 'uninstall') {
    return { command };
  }

  if (command === 'cursor-join') {
    const project = parseArg(args, '--project');
    const serverPidRaw = parseArg(args, '--server-pid');
    if (!project) {
      return { error: 'missing-required-arg', message: 'cursor-join requires --project <path>' };
    }
    if (!path.isAbsolute(project)) {
      return { error: 'missing-required-arg', message: '--project must be an absolute path' };
    }
    if (!serverPidRaw) {
      return { error: 'missing-required-arg', message: 'cursor-join requires --server-pid <pid>' };
    }
    const serverPid = Number(serverPidRaw);
    if (!Number.isInteger(serverPid) || serverPid <= 0) {
      return { error: 'missing-required-arg', message: '--server-pid must be a positive integer' };
    }
    return { command, project, serverPid };
  }

  if (command === 'cursor-leave') {
    const serverPidRaw = parseArg(args, '--server-pid');
    if (!serverPidRaw) {
      return { error: 'missing-required-arg', message: 'cursor-leave requires --server-pid <pid>' };
    }
    const serverPid = Number(serverPidRaw);
    if (!Number.isInteger(serverPid) || serverPid <= 0) {
      return { error: 'missing-required-arg', message: '--server-pid must be a positive integer' };
    }
    return { command, serverPid };
  }

  return { error: 'unknown-command' };
}

export async function handleCursorJoin(
  projectPath: string,
  serverPid: number,
  services?: { stateService: StateService; sessionStateService: SessionStateService },
): Promise<{ agentId: string; conversationId: string }> {
  const stateService = services?.stateService ?? new StateService();
  if (!services?.stateService) await stateService.init();
  const sessionStateService = services?.sessionStateService ?? new SessionStateService();

  await stateService.reapStaleAgents();
  const agent = await stateService.registerAgent(projectPath);
  const conversation = await stateService.getOrCreateProjectConversation(projectPath);
  await stateService.joinConversation(agent.id, conversation.id);

  const updatedConversation = await stateService.getConversation(conversation.id);
  if (updatedConversation && updatedConversation.participants.length >= 2) {
    await writeProfileSetupNotification(stateService, conversation.id, agent.id);
  }

  await sessionStateService.writeSessionAgent(serverPid, agent.id, projectPath);
  return { agentId: agent.id, conversationId: conversation.id };
}

export async function handleCursorLeave(
  serverPid: number,
  services?: { stateService: StateService; sessionStateService: SessionStateService },
): Promise<void> {
  const stateService = services?.stateService ?? new StateService();
  if (!services?.stateService) await stateService.init();
  const sessionStateService = services?.sessionStateService ?? new SessionStateService();

  const result = await sessionStateService.readSessionAgent(serverPid);
  if (!result) return;

  const agent = await stateService.getAgent(result.agentId);
  if (agent) {
    for (const convId of agent.conversations) {
      await stateService.addMessage(convId, agent.id, `${agent.profile.name ?? agent.id} left the conversation.`, 'system');
      await writeNotificationToParticipants(
        stateService,
        convId,
        agent.id,
        NotificationType.Leave,
        `${agent.profile.name ?? agent.id} left the conversation.`,
        { agentName: agent.profile.name },
      );
    }
  }

  await stateService.unregisterAgent(result.agentId);
  await sessionStateService.clearSessionAgent(serverPid);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const result = parseCommand(args);

  if ('error' in result) {
    if (result.error === 'no-command') {
      console.error('Usage: gchat <command>');
      console.error('Commands:');
      console.error('  install          Install group-chat-mcp into your IDE');
      console.error('  uninstall        Remove group-chat-mcp from your IDE');
      console.error('  cursor-join      Register an agent for a Cursor session');
      console.error('  cursor-leave     Unregister an agent for a Cursor session');
      process.exit(1);
    }
    if (result.error === 'missing-required-arg') {
      console.error(result.message ?? 'Missing required argument.');
      process.exit(1);
    }
    console.error(`Unknown command: ${args[0]}`);
    console.error('Available commands: install, uninstall, cursor-join, cursor-leave');
    process.exit(1);
  }

  if (result.command === 'cursor-join') {
    const joinResult = await handleCursorJoin(result.project, result.serverPid);
    console.log(JSON.stringify(joinResult));
    return;
  }

  if (result.command === 'cursor-leave') {
    await handleCursorLeave(result.serverPid);
    return;
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
