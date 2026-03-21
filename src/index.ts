import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { GC_PROJECT_PATH, GC_POLL_INTERVAL_MS } from './constants/env.js';
import { BASE_DIR } from './constants/storage.js';
import { NotificationType } from './enums/notification-type.js';
import { handleToolCall, writeNotificationToParticipants } from './services/tool-handlers.js';
import { toolDefinitions } from './schemas/tool-schemas.js';
import { StateService } from './services/state-service.js';
import { InboxPollerService } from './services/inbox-poller.js';

const stateService = new StateService();
const inboxPoller = new InboxPollerService();

const server = new Server(
  { name: 'group-chat-mcp', version: '0.1.0' },
  {
    capabilities: {
      experimental: { 'claude/channel': {} },
      tools: {},
    },
    instructions:
      'Group chat MCP server enabling multi-agent communication. ' +
      'Agents can create and join conversations, send messages, and receive notifications ' +
      'from other agents via the claude/channel capability.',
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions,
}));

async function main(): Promise<void> {
  await stateService.init();

  if (GC_PROJECT_PATH !== undefined && !path.isAbsolute(GC_PROJECT_PATH)) {
    throw new Error(`GC_PROJECT_PATH must be an absolute path, got: ${GC_PROJECT_PATH}`);
  }
  const projectPath = path.resolve(GC_PROJECT_PATH ?? process.cwd());

  const staleIds = await stateService.reapStaleAgents();
  if (staleIds.length > 0) {
    console.error(`Reaped ${staleIds.length} stale agent(s): ${staleIds.join(', ')}`);
  }

  const agent = await stateService.registerAgent(projectPath);
  const agentId = agent.id;
  console.error(`Agent registered: ${agentId}, project: ${projectPath}`);

  const conversation = await stateService.getOrCreateProjectConversation(projectPath);
  const conversationId = conversation.id;
  await stateService.joinConversation(agentId, conversationId);
  console.error(`Joined project conversation: ${conversationId}`);

  const agentName = agent.profile.name ?? agentId;
  await stateService.addMessage(conversationId, agentId, `${agentName} joined the conversation.`, 'system');
  await writeNotificationToParticipants(
    stateService,
    conversationId,
    agentId,
    NotificationType.Join,
    `${agentName} joined the conversation.`,
  );

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;
    try {
      return await handleToolCall(stateService, name, agentId, rawArgs);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
    }
  });

  inboxPoller.start(agentId, GC_POLL_INTERVAL_MS, server, BASE_DIR);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  let shuttingDown = false;

  const cleanup = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error('Shutdown started');

    try {
      const currentAgent = await stateService.getAgent(agentId);
      if (currentAgent) {
        for (const convId of [...currentAgent.conversations]) {
          try {
            const name = currentAgent.profile.name ?? agentId;
            await stateService.addMessage(convId, agentId, `${name} left the conversation.`, 'system');
            await writeNotificationToParticipants(
              stateService,
              convId,
              agentId,
              NotificationType.Leave,
              `${name} left the conversation.`,
            );
          } catch (err: unknown) {
            console.error(`Failed to write leave message for conversation ${convId}:`, err);
          }
        }
      }
    } catch (err: unknown) {
      console.error('Failed to read agent state during cleanup:', err);
    }

    try {
      await stateService.unregisterAgent(agentId);
      console.error('Agent unregistered');
    } catch (err: unknown) {
      console.error('Failed to unregister agent:', err);
    }

    try {
      inboxPoller.stop();
      console.error('Poller stopped');
    } catch (err: unknown) {
      console.error('Failed to stop poller:', err);
    }

    console.error('Shutdown complete');
    process.exitCode = 0;
  };

  process.once('SIGTERM', cleanup);
  process.once('SIGINT', cleanup);

  server.onclose = () => {
    cleanup().catch((err) => {
      console.error('Cleanup error on transport close:', err);
    });
  };

  console.error('group-chat-mcp server running');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
