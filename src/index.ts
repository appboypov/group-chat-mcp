import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { GC_AGENT_ID, GC_POLL_INTERVAL_MS } from './constants/env.js';
import { BASE_DIR } from './constants/storage.js';
import { handleToolCall } from './handlers/tool-handlers.js';
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

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: rawArgs } = request.params;

  try {
    return await handleToolCall(stateService, name, rawArgs);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
  }
});

async function main(): Promise<void> {
  await stateService.init();

  inboxPoller.start(GC_AGENT_ID, GC_POLL_INTERVAL_MS, server, BASE_DIR);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const cleanup = () => {
    inboxPoller.stop();
    process.exit(0);
  };

  process.on('SIGTERM', cleanup);
  process.on('SIGINT', cleanup);

  server.onclose = () => {
    inboxPoller.stop();
  };

  console.error('group-chat-mcp server running');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
