import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { StateService } from '../services/state-service.js';
import { handleToolCall } from '../services/tool-handlers.js';
import {
  tryAcquireSendLock,
  sendLockDir,
  releaseSendLock,
} from '../utils/send-lock.js';
import { ConversationType } from '../enums/conversation-type.js';

let tmpDir: string;
let stateService: StateService;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gchat-toolhandlers-test-'));
  stateService = new StateService(tmpDir);
  await stateService.init();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('handleToolCall send_message', () => {
  describe('Given a single agent in a conversation with no contention', () => {
    it('When send_message is called Then the message is sent and no lock directory remains', async () => {
      // Given
      const agent = await stateService.registerAgent('/test/project');
      const conversation = await stateService.createConversation({
        type: ConversationType.Group,
        name: 'test-conv',
        participants: [agent.id],
      });
      await stateService.setHasAnnounced(agent.id, conversation.id);

      // When
      const result = await handleToolCall(stateService, 'send_message', agent.id, {
        content: 'Hello world',
        conversationId: conversation.id,
      });

      // Then
      expect('isError' in result).toBe(false);
      expect(result.content[0].text).toContain('Message sent');

      const lockDir = sendLockDir(tmpDir, conversation.id);
      const lockExists = await fs.stat(lockDir).catch(() => null);
      expect(lockExists).toBeNull();

      const messages = await stateService.getMessages(conversation.id);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello world');
      expect(messages[0].senderId).toBe(agent.id);
    });
  });

  describe('Given two agents in a conversation and agent A holds the send lock', () => {
    it('When agent B calls send_message Then B receives a contention error containing the competing message', async () => {
      // Given
      const agentA = await stateService.registerAgent('/test/project');
      const agentB = await stateService.registerAgent('/test/project');
      const conversation = await stateService.createConversation({
        type: ConversationType.Group,
        name: 'contention-conv',
        participants: [agentA.id, agentB.id],
      });
      await stateService.setHasAnnounced(agentA.id, conversation.id);
      await stateService.setHasAnnounced(agentB.id, conversation.id);

      const lockDir = sendLockDir(tmpDir, conversation.id);
      await tryAcquireSendLock(lockDir, agentA.id);

      // When
      const agentBPromise = handleToolCall(stateService, 'send_message', agentB.id, {
        content: 'Message from B',
        conversationId: conversation.id,
      });

      await new Promise((resolve) => setTimeout(resolve, 200));
      await stateService.addMessage(conversation.id, agentA.id, 'Message from A', 'message');
      await releaseSendLock(lockDir);

      const result = await agentBPromise;

      // Then
      expect((result as { isError?: boolean }).isError).toBe(true);
      expect(result.content[0].text).toContain('Message from A');
      expect(result.content[0].text).toContain('reconsider');

      const messages = await stateService.getMessages(conversation.id);
      const bMessages = messages.filter((m) => m.senderId === agentB.id);
      expect(bMessages).toHaveLength(0);
    });
  });

  describe('Given an agent in a conversation and addMessage throws', () => {
    it('When send_message is called Then the lock is released in finally and the error propagates', async () => {
      // Given
      const agent = await stateService.registerAgent('/test/project');
      const conversation = await stateService.createConversation({
        type: ConversationType.Group,
        name: 'fail-conv',
        participants: [agent.id],
      });
      await stateService.setHasAnnounced(agent.id, conversation.id);

      vi.spyOn(stateService, 'addMessage').mockRejectedValueOnce(new Error('Disk write failed'));

      // When / Then
      await expect(
        handleToolCall(stateService, 'send_message', agent.id, {
          content: 'This will fail',
          conversationId: conversation.id,
        }),
      ).rejects.toThrow('Disk write failed');

      const lockDir = sendLockDir(tmpDir, conversation.id);
      const lockExists = await fs.stat(lockDir).catch(() => null);
      expect(lockExists).toBeNull();
    });
  });
});
