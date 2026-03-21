import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { StateService } from '../../src/services/state-service.js';
import { handleToolCall } from '../../src/services/tool-handlers.js';

describe('Tool Handlers', () => {
  let tempDir: string;
  let service: StateService;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `tool-handlers-test-${uuidv4()}`);
    service = new StateService(tempDir);
    await service.init();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('Given handleToolCall receives agentId as parameter When send_message is called Then the agentId parameter is used for participant validation', async () => {
    const projectPath = '/project/test';
    const agent = await service.registerAgent(projectPath);
    const conversation = await service.getOrCreateProjectConversation(projectPath);
    await service.joinConversation(agent.id, conversation.id);

    const result = await handleToolCall(service, 'send_message', agent.id, {
      conversationId: conversation.id,
      content: 'hello from test',
    });

    expect(result.isError).toBeUndefined();

    const messages = await service.getMessages(conversation.id);
    expect(messages).toHaveLength(1);
    expect(messages[0].senderId).toBe(agent.id);
    expect(messages[0].content).toBe('hello from test');
  });
});
