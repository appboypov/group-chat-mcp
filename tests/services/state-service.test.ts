import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { StateService } from '../../src/services/state-service.js';
import { ConversationType } from '../../src/enums/conversation-type.js';

describe('StateService', () => {
  let tempDir: string;
  let service: StateService;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `state-service-test-${uuidv4()}`);
    service = new StateService(tempDir);
    await service.init();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Agent Lifecycle', () => {
    it('Given no agents exist When registerAgent is called Then agents.json contains the new agent with a UUID and projectPath', async () => {
      const agent = await service.registerAgent('/project/a');

      expect(agent.id).toBeDefined();
      expect(agent.projectPath).toBe('/project/a');
      expect(agent.profile).toEqual({});
      expect(agent.conversations).toEqual([]);

      const agents = await service.getAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe(agent.id);
    });

    it('Given agent X exists When registerAgent is called again Then two agents exist', async () => {
      await service.registerAgent('/project/a');
      await service.registerAgent('/project/b');

      const agents = await service.getAgents();
      expect(agents).toHaveLength(2);
    });

    it('Given agent X exists When unregisterAgent(X) is called Then agents.json no longer contains X', async () => {
      const agent = await service.registerAgent('/project/a');

      await service.unregisterAgent(agent.id);

      const agents = await service.getAgents();
      expect(agents).toHaveLength(0);
    });

    it('Given agent X in conversation C When unregisterAgent(X) is called Then X is removed from C\'s participants', async () => {
      const agent = await service.registerAgent('/project/a');
      const conversation = await service.getOrCreateProjectConversation('/project/a');
      await service.joinConversation(agent.id, conversation.id);

      await service.unregisterAgent(agent.id);

      const updatedConversation = await service.getConversation(conversation.id);
      expect(updatedConversation!.participants).not.toContain(agent.id);
    });

    it('Given agent X exists When updateProfile(X, { name: "Builder" }) is called Then agent X\'s profile.name is "Builder"', async () => {
      const agent = await service.registerAgent('/project/a');

      const updated = await service.updateProfile(agent.id, { name: 'Builder' });

      expect(updated.profile.name).toBe('Builder');

      const fetched = await service.getAgent(agent.id);
      expect(fetched!.profile.name).toBe('Builder');
    });

    it('Given agents in projects A and B When getAgentsByProject(A) is called Then only agents in project A are returned', async () => {
      await service.registerAgent('/project/a');
      await service.registerAgent('/project/a');
      await service.registerAgent('/project/b');

      const projectAAgents = await service.getAgentsByProject('/project/a');
      expect(projectAAgents).toHaveLength(2);
      expect(projectAAgents.every((a) => a.projectPath === '/project/a')).toBe(true);
    });
  });

  describe('Conversation Lifecycle', () => {
    it('Given no conversations When getOrCreateProjectConversation("/project/a") is called Then a project conversation is created', async () => {
      const conversation = await service.getOrCreateProjectConversation('/project/a');

      expect(conversation.id).toBeDefined();
      expect(conversation.type).toBe(ConversationType.Project);
      expect(conversation.projectPath).toBe('/project/a');
    });

    it('Given active project conversation C When getOrCreateProjectConversation is called for same project Then C is returned', async () => {
      const first = await service.getOrCreateProjectConversation('/project/a');
      const second = await service.getOrCreateProjectConversation('/project/a');

      expect(second.id).toBe(first.id);
    });

    it('Given archived project conversation When getOrCreateProjectConversation is called for same project Then a new conversation is created', async () => {
      const agent = await service.registerAgent('/project/a');
      const first = await service.getOrCreateProjectConversation('/project/a');
      await service.joinConversation(agent.id, first.id);
      await service.leaveConversation(agent.id, first.id);

      const second = await service.getOrCreateProjectConversation('/project/a');

      expect(second.id).not.toBe(first.id);
    });

    it('Given agents X and Y When getOrCreateDmConversation(X, Y) is called Then a DM conversation with both participants exists', async () => {
      const agentX = await service.registerAgent('/project/a');
      const agentY = await service.registerAgent('/project/a');

      const dm = await service.getOrCreateDmConversation(agentX.id, agentY.id);

      expect(dm.type).toBe(ConversationType.Dm);
      expect(dm.participants).toContain(agentX.id);
      expect(dm.participants).toContain(agentY.id);
    });

    it('Given DM between X and Y exists When getOrCreateDmConversation(X, Y) is called again Then the existing DM is returned', async () => {
      const agentX = await service.registerAgent('/project/a');
      const agentY = await service.registerAgent('/project/a');

      const first = await service.getOrCreateDmConversation(agentX.id, agentY.id);
      const second = await service.getOrCreateDmConversation(agentX.id, agentY.id);

      expect(second.id).toBe(first.id);
    });

    it('Given DM between X and Y exists When getOrCreateDmConversation(Y, X) is called Then the same DM is returned (order-independent)', async () => {
      const agentX = await service.registerAgent('/project/a');
      const agentY = await service.registerAgent('/project/a');

      const first = await service.getOrCreateDmConversation(agentX.id, agentY.id);
      const second = await service.getOrCreateDmConversation(agentY.id, agentX.id);

      expect(second.id).toBe(first.id);
    });

    it('Given conversation C When createConversation({ name: "Team Chat", type: "group" }) is called Then a group conversation with name "Team Chat" exists', async () => {
      const conversation = await service.createConversation({
        type: ConversationType.Group,
        name: 'Team Chat',
        participants: [],
      });

      expect(conversation.type).toBe(ConversationType.Group);
      expect(conversation.name).toBe('Team Chat');

      const fetched = await service.getConversation(conversation.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.name).toBe('Team Chat');
    });

    it('Given agent X not in conversation C When joinConversation(X, C) is called Then X is in C\'s participants', async () => {
      const agent = await service.registerAgent('/project/a');
      const conversation = await service.getOrCreateProjectConversation('/project/a');

      await service.joinConversation(agent.id, conversation.id);

      const updated = await service.getConversation(conversation.id);
      expect(updated!.participants).toContain(agent.id);
    });

    it('Given agent X in conversation C with other participants When leaveConversation(X, C) is called Then X is removed but C is not archived', async () => {
      const agentX = await service.registerAgent('/project/a');
      const agentY = await service.registerAgent('/project/a');
      const conversation = await service.getOrCreateProjectConversation('/project/a');
      await service.joinConversation(agentX.id, conversation.id);
      await service.joinConversation(agentY.id, conversation.id);

      await service.leaveConversation(agentX.id, conversation.id);

      const updated = await service.getConversation(conversation.id);
      expect(updated!.participants).not.toContain(agentX.id);
      expect(updated!.participants).toContain(agentY.id);
      expect(updated!.archivedAt).toBeUndefined();
    });

    it('Given agent X as sole participant in C When leaveConversation(X, C) is called Then C\'s archivedAt is set', async () => {
      const agent = await service.registerAgent('/project/a');
      const conversation = await service.getOrCreateProjectConversation('/project/a');
      await service.joinConversation(agent.id, conversation.id);

      await service.leaveConversation(agent.id, conversation.id);

      const updated = await service.getConversation(conversation.id);
      expect(updated!.archivedAt).toBeDefined();
      expect(typeof updated!.archivedAt).toBe('number');
    });

    it('Given conversation C When updateConversation(C, { topic: "New topic" }) is called Then C\'s topic is "New topic"', async () => {
      const conversation = await service.getOrCreateProjectConversation('/project/a');

      const updated = await service.updateConversation(conversation.id, { topic: 'New topic' });

      expect(updated.topic).toBe('New topic');

      const fetched = await service.getConversation(conversation.id);
      expect(fetched!.topic).toBe('New topic');
    });
  });

  describe('Messaging', () => {
    it('Given conversation C with agents X and Y When addMessage(C, X, "hello") is called Then messages file contains the message', async () => {
      const agentX = await service.registerAgent('/project/a');
      const agentY = await service.registerAgent('/project/a');
      const conversation = await service.getOrCreateProjectConversation('/project/a');
      await service.joinConversation(agentX.id, conversation.id);
      await service.joinConversation(agentY.id, conversation.id);

      await service.addMessage(conversation.id, agentX.id, 'hello', 'message');

      const messages = await service.getMessages(conversation.id);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('hello');
      expect(messages[0].senderId).toBe(agentX.id);
    });

    it('Given conversation C with agents X and Y When addMessage(C, X, "hello") is called Then Y\'s inbox contains a notification with content "hello"', async () => {
      const agentX = await service.registerAgent('/project/a');
      const agentY = await service.registerAgent('/project/a');
      const conversation = await service.getOrCreateProjectConversation('/project/a');
      await service.joinConversation(agentX.id, conversation.id);
      await service.joinConversation(agentY.id, conversation.id);

      await service.addMessage(conversation.id, agentX.id, 'hello', 'message');

      const inbox = await service.getInbox(agentY.id);
      expect(inbox).toHaveLength(1);
      expect(inbox[0].content).toBe('hello');
    });

    it('Given conversation C with agents X and Y When addMessage(C, X, "hello") is called Then X\'s inbox does NOT contain the notification (sender excluded)', async () => {
      const agentX = await service.registerAgent('/project/a');
      const agentY = await service.registerAgent('/project/a');
      const conversation = await service.getOrCreateProjectConversation('/project/a');
      await service.joinConversation(agentX.id, conversation.id);
      await service.joinConversation(agentY.id, conversation.id);

      await service.addMessage(conversation.id, agentX.id, 'hello', 'message');

      const inbox = await service.getInbox(agentX.id);
      expect(inbox).toHaveLength(0);
    });

    it('Given conversation C with agents X and Y When addMessage with type "system" is called Then no inbox notifications are written', async () => {
      const agentX = await service.registerAgent('/project/a');
      const agentY = await service.registerAgent('/project/a');
      const conversation = await service.getOrCreateProjectConversation('/project/a');
      await service.joinConversation(agentX.id, conversation.id);
      await service.joinConversation(agentY.id, conversation.id);

      await service.addMessage(conversation.id, agentX.id, 'system event', 'system');

      const inboxX = await service.getInbox(agentX.id);
      const inboxY = await service.getInbox(agentY.id);
      expect(inboxX).toHaveLength(0);
      expect(inboxY).toHaveLength(0);
    });

    it('Given agent Y with 3 inbox notifications When clearInbox(Y) is called Then Y\'s inbox is empty', async () => {
      const agentX = await service.registerAgent('/project/a');
      const agentY = await service.registerAgent('/project/a');
      const conversation = await service.getOrCreateProjectConversation('/project/a');
      await service.joinConversation(agentX.id, conversation.id);
      await service.joinConversation(agentY.id, conversation.id);

      await service.addMessage(conversation.id, agentX.id, 'msg1', 'message');
      await service.addMessage(conversation.id, agentX.id, 'msg2', 'message');
      await service.addMessage(conversation.id, agentX.id, 'msg3', 'message');

      const inboxBefore = await service.getInbox(agentY.id);
      expect(inboxBefore).toHaveLength(3);

      await service.clearInbox(agentY.id);

      const inboxAfter = await service.getInbox(agentY.id);
      expect(inboxAfter).toHaveLength(0);
    });

    it('Given conversation C with 5 messages When getMessages(C) is called Then all 5 messages are returned in chronological order', async () => {
      const agentX = await service.registerAgent('/project/a');
      const conversation = await service.getOrCreateProjectConversation('/project/a');
      await service.joinConversation(agentX.id, conversation.id);

      for (let i = 1; i <= 5; i++) {
        await service.addMessage(conversation.id, agentX.id, `message ${i}`, 'message');
      }

      const messages = await service.getMessages(conversation.id);
      expect(messages).toHaveLength(5);
      for (let i = 0; i < messages.length - 1; i++) {
        expect(messages[i].timestamp).toBeLessThanOrEqual(messages[i + 1].timestamp);
      }
      expect(messages.map((m) => m.content)).toEqual([
        'message 1',
        'message 2',
        'message 3',
        'message 4',
        'message 5',
      ]);
    });
  });

  describe('Conversation Filtering', () => {
    it('Given project conversations for /a and /b and a DM When getConversations({ projectPath: "/a" }) is called Then only conversations involving /a are returned', async () => {
      await service.getOrCreateProjectConversation('/a');
      await service.getOrCreateProjectConversation('/b');

      const agentX = await service.registerAgent('/a');
      const agentY = await service.registerAgent('/b');
      await service.getOrCreateDmConversation(agentX.id, agentY.id);

      const result = await service.getConversations({ projectPath: '/a' });
      expect(result).toHaveLength(1);
      expect(result[0].projectPath).toBe('/a');
    });

    it('Given 3 conversations (2 active, 1 archived) When getConversations({}) is called Then all 3 are returned', async () => {
      await service.getOrCreateProjectConversation('/a');
      await service.getOrCreateProjectConversation('/b');

      const agent = await service.registerAgent('/c');
      const conv = await service.getOrCreateProjectConversation('/c');
      await service.joinConversation(agent.id, conv.id);
      await service.leaveConversation(agent.id, conv.id);

      const result = await service.getConversations({});
      expect(result).toHaveLength(3);
    });
  });
});
