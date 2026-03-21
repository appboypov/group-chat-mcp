#!/usr/bin/env node
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { StateService } from './services/state-service.js';
import { NotificationType } from './enums/notification-type.js';
import type { Notification } from './types/index.js';
import { readJsonFile, writeJsonFile } from './utils/file-utils.js';
import { withFileLock } from './utils/file-lock.js';
import { BASE_DIR, INBOXES_DIR } from './constants/storage.js';

const stateService = new StateService();

async function writeNotificationToInbox(agentId: string, notification: Notification): Promise<void> {
  const inboxPath = path.join(BASE_DIR, INBOXES_DIR, `${agentId}.json`);
  await withFileLock(inboxPath, async () => {
    const inbox = (await readJsonFile<Notification[]>(inboxPath)) ?? [];
    inbox.push(notification);
    await writeJsonFile(inboxPath, inbox);
  });
}

async function handleJoin(projectPath: string): Promise<void> {
  projectPath = path.resolve(projectPath);
  await stateService.init();
  const agent = await stateService.registerAgent(projectPath);
  const conversation = await stateService.getOrCreateProjectConversation(projectPath);
  await stateService.joinConversation(agent.id, conversation.id);
  await stateService.addMessage(
    conversation.id,
    'system',
    `${agent.id} joined the conversation`,
    'system',
  );

  const updatedConversation = await stateService.getConversation(conversation.id);
  if (updatedConversation) {
    for (const participantId of updatedConversation.participants) {
      if (participantId === agent.id) continue;
      const notification: Notification = {
        id: uuidv4(),
        type: NotificationType.Join,
        conversationId: conversation.id,
        agentId: agent.id,
        content: `${agent.id} joined the conversation`,
        timestamp: Date.now(),
      };
      await writeNotificationToInbox(participantId, notification);
    }
  }

  console.log(agent.id);
}

async function handleLeave(agentId: string): Promise<void> {
  await stateService.init();
  const agent = await stateService.getAgent(agentId);
  if (!agent) {
    console.error(`Agent ${agentId} not found`);
    process.exit(1);
  }

  for (const conversationId of [...agent.conversations]) {
    const conversation = await stateService.getConversation(conversationId);
    if (conversation) {
      for (const participantId of conversation.participants) {
        if (participantId === agentId) continue;
        const notification: Notification = {
          id: uuidv4(),
          type: NotificationType.Leave,
          conversationId,
          agentId,
          content: `${agentId} left the conversation`,
          timestamp: Date.now(),
        };
        await writeNotificationToInbox(participantId, notification);
      }
    }

    await stateService.addMessage(
      conversationId,
      'system',
      `${agentId} left the conversation`,
      'system',
    );
  }

  await stateService.unregisterAgent(agentId);
}

function parseArgs(argv: string[]): { command: string; project?: string; agentId?: string } {
  const command = argv[2];
  let project: string | undefined;
  let agentId: string | undefined;

  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === '--project' && i + 1 < argv.length) {
      project = argv[++i];
    } else if (argv[i] === '--agent-id' && i + 1 < argv.length) {
      agentId = argv[++i];
    }
  }

  return { command, project, agentId };
}

async function main(): Promise<void> {
  const { command, project, agentId } = parseArgs(process.argv);

  switch (command) {
    case 'join': {
      if (!project) {
        console.error('Error: --project <path> is required for join command');
        process.exit(1);
      }
      await handleJoin(project);
      break;
    }
    case 'leave': {
      if (!agentId) {
        console.error('Error: --agent-id <uuid> is required for leave command');
        process.exit(1);
      }
      await handleLeave(agentId);
      break;
    }
    default: {
      console.error('Usage: group-chat-mcp <command>');
      console.error('Commands:');
      console.error('  join --project <path>    Register agent and join project conversation');
      console.error('  leave --agent-id <uuid>  Leave all conversations and unregister');
      process.exit(1);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
