import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { ZodError } from 'zod';
import { StateService } from '../../src/services/state-service.js';
import { handleToolCall } from '../../src/services/tool-handlers.js';
import { NotificationType } from '../../src/enums/notification-type.js';
import { UpdateProfileArgsSchema } from '../../src/schemas/tool-schemas.js';
import { formatNotificationContent, writeNotificationToParticipants } from '../../src/utils/notification-utils.js';
import { ConversationType } from '../../src/enums/conversation-type.js';
import type { Notification } from '../../src/types/notification.js';

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

  describe('Silent join', () => {
    it('Given agent A joins conversation X When the join handler completes Then no system message exists in conversation X messages', async () => {
      const projectPath = '/project/test';
      const agentA = await service.registerAgent(projectPath);
      const conversation = await service.getOrCreateProjectConversation(projectPath);

      await handleToolCall(service, 'join_conversation', agentA.id, {
        conversationId: conversation.id,
      });

      const messages = await service.getMessages(conversation.id);
      const systemMessages = messages.filter((m) => m.type === 'system');
      expect(systemMessages).toHaveLength(0);
    });

    it('Given agent A joins conversation X containing agent B When the join handler completes Then agent B inbox contains no Join notification', async () => {
      const projectPath = '/project/test';
      const agentB = await service.registerAgent(projectPath);
      const conversation = await service.getOrCreateProjectConversation(projectPath);
      await service.joinConversation(agentB.id, conversation.id);

      const agentA = await service.registerAgent(projectPath);
      await handleToolCall(service, 'join_conversation', agentA.id, {
        conversationId: conversation.id,
      });

      const inbox = await service.getInbox(agentB.id);
      const joinNotifications = inbox.filter((n) => n.type === NotificationType.Join);
      expect(joinNotifications).toHaveLength(0);
    });

    it('Given agent A joins conversation X as the second participant When the join handler completes Then agent A inbox contains a profile setup notification', async () => {
      const projectPath = '/project/test';
      const agentB = await service.registerAgent(projectPath);
      const conversation = await service.getOrCreateProjectConversation(projectPath);
      await service.joinConversation(agentB.id, conversation.id);

      const agentA = await service.registerAgent(projectPath);
      await handleToolCall(service, 'join_conversation', agentA.id, {
        conversationId: conversation.id,
      });

      const inbox = await service.getInbox(agentA.id);
      expect(inbox).toHaveLength(1);
      expect(inbox[0].type).toBe(NotificationType.Join);
      expect(inbox[0].content).toContain('Update your profile');
    });

    it('Given agent A joins conversation X as the only participant When the join handler completes Then agent A inbox is empty', async () => {
      const projectPath = '/project/test';
      const agentA = await service.registerAgent(projectPath);
      const conversation = await service.getOrCreateProjectConversation(projectPath);

      await handleToolCall(service, 'join_conversation', agentA.id, {
        conversationId: conversation.id,
      });

      const inbox = await service.getInbox(agentA.id);
      expect(inbox).toHaveLength(0);
    });
  });

  describe('Deferred join announcement', () => {
    it('Given agent A has hasAnnounced[convX]=false When agent A calls update_profile with all fields Then a system message "{name} joined the conversation." appears in convX messages', async () => {
      const projectPath = '/project/test';
      const agentB = await service.registerAgent(projectPath);
      const conversation = await service.getOrCreateProjectConversation(projectPath);
      await service.joinConversation(agentB.id, conversation.id);

      const agentA = await service.registerAgent(projectPath);
      await service.joinConversation(agentA.id, conversation.id);

      await handleToolCall(service, 'update_profile', agentA.id, {
        name: 'Alice',
        role: 'Developer',
        expertise: 'TypeScript',
        status: 'Active',
      });

      const messages = await service.getMessages(conversation.id);
      const joinSystemMessage = messages.find(
        (m) => m.type === 'system' && m.content === 'Alice joined the conversation.',
      );
      expect(joinSystemMessage).toBeDefined();
    });

    it('Given agent A has hasAnnounced[convX]=false and convX has agent B When agent A calls update_profile Then agent B inbox contains a Join notification with agentName set', async () => {
      const projectPath = '/project/test';
      const agentB = await service.registerAgent(projectPath);
      const conversation = await service.getOrCreateProjectConversation(projectPath);
      await service.joinConversation(agentB.id, conversation.id);

      const agentA = await service.registerAgent(projectPath);
      await service.joinConversation(agentA.id, conversation.id);

      await handleToolCall(service, 'update_profile', agentA.id, {
        name: 'Alice',
        role: 'Developer',
        expertise: 'TypeScript',
        status: 'Active',
      });

      const inbox = await service.getInbox(agentB.id);
      const joinNotification = inbox.find((n) => n.type === NotificationType.Join);
      expect(joinNotification).toBeDefined();
      expect(joinNotification!.agentName).toBe('Alice');
    });

    it('Given agent A has hasAnnounced[convX]=false When agent A calls update_profile Then agent A hasAnnounced[convX] becomes true', async () => {
      const projectPath = '/project/test';
      const agentA = await service.registerAgent(projectPath);
      const conversation = await service.getOrCreateProjectConversation(projectPath);
      await service.joinConversation(agentA.id, conversation.id);

      await handleToolCall(service, 'update_profile', agentA.id, {
        name: 'Alice',
        role: 'Developer',
        expertise: 'TypeScript',
        status: 'Active',
      });

      const updatedAgent = await service.getAgent(agentA.id);
      expect(updatedAgent!.hasAnnounced[conversation.id]).toBe(true);
    });

    it('Given agent A has hasAnnounced[convX]=true When agent A calls update_profile again Then no new system message is added to convX', async () => {
      const projectPath = '/project/test';
      const agentA = await service.registerAgent(projectPath);
      const conversation = await service.getOrCreateProjectConversation(projectPath);
      await service.joinConversation(agentA.id, conversation.id);

      await handleToolCall(service, 'update_profile', agentA.id, {
        name: 'Alice',
        role: 'Developer',
        expertise: 'TypeScript',
        status: 'Active',
      });

      const messagesAfterFirst = await service.getMessages(conversation.id);
      const systemCountAfterFirst = messagesAfterFirst.filter((m) => m.type === 'system').length;

      await handleToolCall(service, 'update_profile', agentA.id, {
        name: 'Alice Updated',
        role: 'Senior Developer',
        expertise: 'TypeScript, Node.js',
        status: 'Busy',
      });

      const messagesAfterSecond = await service.getMessages(conversation.id);
      const systemCountAfterSecond = messagesAfterSecond.filter((m) => m.type === 'system').length;
      expect(systemCountAfterSecond).toBe(systemCountAfterFirst);
    });
    it('Given agent A in two conversations both with hasAnnounced=false When agent A calls update_profile Then both conversations receive deferred join messages', async () => {
      const projectPath = '/project/test';
      const agentB = await service.registerAgent(projectPath);
      const conv1 = await service.getOrCreateProjectConversation(projectPath);
      await service.joinConversation(agentB.id, conv1.id);

      const agentA = await service.registerAgent(projectPath);
      await service.joinConversation(agentA.id, conv1.id);

      const conv2 = await service.createConversation({
        type: ConversationType.Group,
        name: 'Second Chat',
        participants: [agentA.id, agentB.id],
      });

      await handleToolCall(service, 'update_profile', agentA.id, {
        name: 'Alice',
        role: 'Developer',
        expertise: 'TypeScript',
        status: 'Active',
      });

      const messages1 = await service.getMessages(conv1.id);
      const joinMsg1 = messages1.find(
        (m) => m.type === 'system' && m.content === 'Alice joined the conversation.',
      );
      expect(joinMsg1).toBeDefined();

      const messages2 = await service.getMessages(conv2.id);
      const joinMsg2 = messages2.find(
        (m) => m.type === 'system' && m.content === 'Alice joined the conversation.',
      );
      expect(joinMsg2).toBeDefined();
    });
  });

  describe('send_message profile reminder', () => {
    it('Given agent A has no profile name and conversation has >=2 participants When agent A sends a message Then the response text includes a profile reminder', async () => {
      const projectPath = '/project/test';
      const agentA = await service.registerAgent(projectPath);
      const agentB = await service.registerAgent(projectPath);
      const conversation = await service.getOrCreateProjectConversation(projectPath);
      await service.joinConversation(agentA.id, conversation.id);
      await service.joinConversation(agentB.id, conversation.id);

      const result = await handleToolCall(service, 'send_message', agentA.id, {
        conversationId: conversation.id,
        content: 'hello',
      });

      const text = result.content[0].text;
      expect(text).toContain('Reminder: your profile is not set');
    });

    it('Given agent A has profile name set and conversation has >=2 participants When agent A sends a message Then the response text does not include a profile reminder', async () => {
      const projectPath = '/project/test';
      const agentA = await service.registerAgent(projectPath);
      const agentB = await service.registerAgent(projectPath);
      const conversation = await service.getOrCreateProjectConversation(projectPath);
      await service.joinConversation(agentA.id, conversation.id);
      await service.joinConversation(agentB.id, conversation.id);

      await handleToolCall(service, 'update_profile', agentA.id, {
        name: 'Alice',
        role: 'Developer',
        expertise: 'TypeScript',
        status: 'Active',
      });

      const result = await handleToolCall(service, 'send_message', agentA.id, {
        conversationId: conversation.id,
        content: 'hello',
      });

      const text = result.content[0].text;
      expect(text).not.toContain('Reminder: your profile is not set');
    });

    it('Given agent A has no profile name and conversation has 1 participant When agent A sends a message Then the response text does not include a profile reminder', async () => {
      const projectPath = '/project/test';
      const agentA = await service.registerAgent(projectPath);
      const conversation = await service.getOrCreateProjectConversation(projectPath);
      await service.joinConversation(agentA.id, conversation.id);

      const result = await handleToolCall(service, 'send_message', agentA.id, {
        conversationId: conversation.id,
        content: 'hello',
      });

      const text = result.content[0].text;
      expect(text).not.toContain('Reminder: your profile is not set');
    });
  });

  describe('UpdateProfileArgsSchema validation', () => {
    it('Given an update_profile call missing the name field When the schema parses Then it throws a ZodError', () => {
      expect(() =>
        UpdateProfileArgsSchema.parse({
          role: 'Developer',
          expertise: 'TypeScript',
          status: 'Active',
        }),
      ).toThrow(ZodError);
    });

    it('Given an update_profile call with an empty string for expertise When the schema parses Then it throws a ZodError', () => {
      expect(() =>
        UpdateProfileArgsSchema.parse({
          name: 'Alice',
          role: 'Developer',
          expertise: '',
          status: 'Active',
        }),
      ).toThrow(ZodError);
    });

    it('Given an update_profile call with only name and role When the schema parses Then it throws a ZodError', () => {
      expect(() =>
        UpdateProfileArgsSchema.parse({
          name: 'Alice',
          role: 'Developer',
        }),
      ).toThrow(ZodError);
    });

    it('Given an update_profile call with all four fields as non-empty strings When the schema parses Then it succeeds', () => {
      const result = UpdateProfileArgsSchema.parse({
        name: 'Alice',
        role: 'Developer',
        expertise: 'TypeScript',
        status: 'Active',
      });

      expect(result).toEqual({
        name: 'Alice',
        role: 'Developer',
        expertise: 'TypeScript',
        status: 'Active',
      });
    });
  });

  describe('Notification formatting', () => {
    it('Given a Message notification with agentName "Reviewer" When formatNotificationContent is called Then the output contains "Reviewer" instead of the UUID', () => {
      const agentId = uuidv4();
      const notification: Notification = {
        id: uuidv4(),
        type: NotificationType.Message,
        conversationId: uuidv4(),
        agentId,
        agentName: 'Reviewer',
        content: 'Looks good to me',
        timestamp: Date.now(),
      };

      const output = formatNotificationContent(notification);
      expect(output).toContain('Reviewer');
      expect(output).not.toContain(agentId);
    });

    it('Given writeNotificationToParticipants is called with agentName "Builder" When notifications are written Then each notification has agentName "Builder"', async () => {
      const projectPath = '/project/test';
      const agentA = await service.registerAgent(projectPath);
      const agentB = await service.registerAgent(projectPath);
      const conversation = await service.getOrCreateProjectConversation(projectPath);
      await service.joinConversation(agentA.id, conversation.id);
      await service.joinConversation(agentB.id, conversation.id);

      await writeNotificationToParticipants(
        service,
        conversation.id,
        agentA.id,
        NotificationType.ProfileUpdate,
        'Builder updated profile',
        { agentName: 'Builder' },
      );

      const inbox = await service.getInbox(agentB.id);
      expect(inbox).toHaveLength(1);
      expect(inbox[0].agentName).toBe('Builder');
    });

    it('Given a Join notification without agentName set and no content When formatNotificationContent is called Then the output contains the agentId UUID', () => {
      const agentId = uuidv4();
      const conversationId = uuidv4();
      const notification: Notification = {
        id: uuidv4(),
        type: NotificationType.Join,
        conversationId,
        agentId,
        content: '',
        timestamp: Date.now(),
      };

      const output = formatNotificationContent(notification);
      expect(output).toContain(agentId);
      expect(output).toContain(conversationId);
    });
  });
});
