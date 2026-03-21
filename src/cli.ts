#!/usr/bin/env node
import path from 'node:path';
import { StateService } from './services/state-service.js';

const stateService = new StateService();

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
