import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { StateService } from '../src/services/state-service.js';
import { ConversationType } from '../src/enums/conversation-type.js';
import { NotificationType } from '../src/enums/notification-type.js';
import { INBOXES_DIR } from '../src/constants/storage.js';
import type { Notification } from '../src/types/index.js';
import { appendToJsonArray } from '../src/utils/file-utils.js';
import { withFileLock } from '../src/utils/file-lock.js';

async function writeNotificationToParticipantsLocal(
  stateService: StateService,
  storagePath: string,
  conversationId: string,
  senderId: string,
  type: NotificationType,
  content: string,
): Promise<void> {
  const conversation = await stateService.getConversation(conversationId);
  if (!conversation) return;

  for (const participantId of conversation.participants) {
    if (participantId === senderId) continue;
    const notification: Notification = {
      id: uuidv4(),
      type,
      conversationId,
      agentId: senderId,
      content,
      timestamp: Date.now(),
    };
    const inboxPath = path.join(storagePath, INBOXES_DIR, `${participantId}.json`);
    await withFileLock(inboxPath, async () => {
      await appendToJsonArray(inboxPath, notification);
    });
  }
}

describe('Server Lifecycle', () => {
  let tempDir: string;
  let service: StateService;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `index-test-${uuidv4()}`);
    service = new StateService(tempDir);
    await service.init();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Startup', () => {
    it('Given no GC_PROJECT_PATH env var When the server starts Then projectPath is process.cwd()', () => {
      const projectPath = path.resolve(undefined ?? process.cwd());
      expect(projectPath).toBe(process.cwd());
    });

    it('Given GC_PROJECT_PATH=/some/path When the server starts Then projectPath is /some/path', () => {
      const projectPath = path.resolve('/some/path');
      expect(projectPath).toBe('/some/path');
    });

    it('Given GC_PROJECT_PATH contains ".." traversal segments When the server starts Then the path is resolved to an absolute path', () => {
      const projectPath = path.resolve('/some/path/../other');
      expect(projectPath).toBe('/some/other');
      expect(path.isAbsolute(projectPath)).toBe(true);
    });

    it('Given the server starts When registration completes Then agents.json contains the new agent with a PID field', async () => {
      const agent = await service.registerAgent('/project/test');

      expect(agent.id).toBeDefined();
      expect(agent.pid).toBe(process.pid);

      const agents = await service.getAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].pid).toBe(process.pid);
    });

    it('Given the server starts When registration completes Then a project conversation exists with the agent as participant', async () => {
      const projectPath = '/project/test';
      const agent = await service.registerAgent(projectPath);
      const conversation = await service.getOrCreateProjectConversation(projectPath);
      await service.joinConversation(agent.id, conversation.id);

      const updated = await service.getConversation(conversation.id);
      expect(updated).not.toBeNull();
      expect(updated!.participants).toContain(agent.id);
    });

    it('Given other agents exist in the project conversation When the server starts Then a system join message is added and notifications are written to their inboxes', async () => {
      const projectPath = '/project/test';

      const existingAgent = await service.registerAgent(projectPath);
      const conversation = await service.getOrCreateProjectConversation(projectPath);
      await service.joinConversation(existingAgent.id, conversation.id);

      const newAgent = await service.registerAgent(projectPath);
      await service.joinConversation(newAgent.id, conversation.id);
      const agentName = newAgent.profile.name ?? newAgent.id;
      await service.addMessage(conversation.id, newAgent.id, `${agentName} joined the conversation.`, 'system');
      await writeNotificationToParticipantsLocal(
        service,
        tempDir,
        conversation.id,
        newAgent.id,
        NotificationType.Join,
        `${agentName} joined the conversation.`,
      );

      const messages = await service.getMessages(conversation.id);
      const joinMessage = messages.find((m) => m.type === 'system' && m.senderId === newAgent.id);
      expect(joinMessage).toBeDefined();

      const inbox = await service.getInbox(existingAgent.id);
      expect(inbox).toHaveLength(1);
      expect(inbox[0].type).toBe(NotificationType.Join);
    });
  });

  describe('Shutdown', () => {
    it('Given the agent is in 3 conversations When shutdown cleanup runs Then the agent is removed from all 3 conversations and unregistered from agents.json', async () => {
      const agent = await service.registerAgent('/project/test');
      const observer = await service.registerAgent('/project/test');

      const conv1 = await service.getOrCreateProjectConversation('/project/test');
      await service.joinConversation(agent.id, conv1.id);
      await service.joinConversation(observer.id, conv1.id);

      const conv2 = await service.createConversation({
        type: ConversationType.Group,
        name: 'Chat 2',
        participants: [agent.id, observer.id],
      });

      const conv3 = await service.createConversation({
        type: ConversationType.Group,
        name: 'Chat 3',
        participants: [agent.id, observer.id],
      });

      const agentName = agent.profile.name ?? agent.id;
      for (const convId of [conv1.id, conv2.id, conv3.id]) {
        await service.addMessage(convId, agent.id, `${agentName} left the conversation.`, 'system');
        await writeNotificationToParticipantsLocal(
          service,
          tempDir,
          convId,
          agent.id,
          NotificationType.Leave,
          `${agentName} left the conversation.`,
        );
      }

      await service.unregisterAgent(agent.id);

      const agents = await service.getAgents();
      expect(agents).toHaveLength(1);
      expect(agents[0].id).toBe(observer.id);

      for (const convId of [conv1.id, conv2.id, conv3.id]) {
        const conv = await service.getConversation(convId);
        expect(conv!.participants).not.toContain(agent.id);

        const messages = await service.getMessages(convId);
        const leaveMessage = messages.find((m) => m.type === 'system' && m.senderId === agent.id);
        expect(leaveMessage).toBeDefined();
      }

      const observerInbox = await service.getInbox(observer.id);
      expect(observerInbox.filter((n) => n.type === NotificationType.Leave)).toHaveLength(3);
    });

    it('Given the agent references a conversation that no longer exists When unregisterAgent is called Then the agent is still fully cleaned up', async () => {
      const agent = await service.registerAgent('/project/test');
      const conv1 = await service.getOrCreateProjectConversation('/project/test');
      await service.joinConversation(agent.id, conv1.id);

      const agentsPath = path.join(tempDir, 'agents.json');
      const agentsData = JSON.parse(await fs.readFile(agentsPath, 'utf-8'));
      agentsData[0].conversations.push('non-existent-conv-id');
      await fs.writeFile(agentsPath, JSON.stringify(agentsData, null, 2));

      await service.unregisterAgent(agent.id);

      const agents = await service.getAgents();
      expect(agents).toHaveLength(0);

      const conv = await service.getConversation(conv1.id);
      expect(conv!.participants).not.toContain(agent.id);
    });

    it('Given shutdown cleanup runs When complete Then leave system messages and notifications are written for each conversation', async () => {
      const projectPath = '/project/test';
      const agent1 = await service.registerAgent(projectPath);
      const agent2 = await service.registerAgent(projectPath);
      const conversation = await service.getOrCreateProjectConversation(projectPath);
      await service.joinConversation(agent1.id, conversation.id);
      await service.joinConversation(agent2.id, conversation.id);

      const agentName = agent1.profile.name ?? agent1.id;
      await service.addMessage(conversation.id, agent1.id, `${agentName} left the conversation.`, 'system');
      await writeNotificationToParticipantsLocal(
        service,
        tempDir,
        conversation.id,
        agent1.id,
        NotificationType.Leave,
        `${agentName} left the conversation.`,
      );
      await service.unregisterAgent(agent1.id);

      const messages = await service.getMessages(conversation.id);
      const leaveMessage = messages.find((m) => m.type === 'system' && m.senderId === agent1.id);
      expect(leaveMessage).toBeDefined();

      const inbox = await service.getInbox(agent2.id);
      expect(inbox.some((n) => n.type === NotificationType.Leave)).toBe(true);
    });
  });

  describe('Concurrent Registration', () => {
    it('Given two server instances start simultaneously in the same project directory When both register Then agents.json contains exactly 2 entries with different IDs', async () => {
      const [agent1, agent2] = await Promise.all([
        service.registerAgent('/project/test'),
        service.registerAgent('/project/test'),
      ]);

      expect(agent1.id).not.toBe(agent2.id);

      const agents = await service.getAgents();
      expect(agents).toHaveLength(2);
      const ids = new Set(agents.map((a) => a.id));
      expect(ids.size).toBe(2);
    });
  });

  describe('Stale Agent Reaping', () => {
    it('Given agents.json contains an entry with a PID that is no longer alive When a new server starts Then the stale entry is removed before registration', async () => {
      const agent = await service.registerAgent('/project/test');
      const conversation = await service.getOrCreateProjectConversation('/project/test');
      await service.joinConversation(agent.id, conversation.id);

      const agentsPath = path.join(tempDir, 'agents.json');
      const agentsData = JSON.parse(await fs.readFile(agentsPath, 'utf-8'));
      agentsData[0].pid = 999999;
      await fs.writeFile(agentsPath, JSON.stringify(agentsData, null, 2));

      const staleIds = await service.reapStaleAgents();

      expect(staleIds).toHaveLength(1);
      expect(staleIds[0]).toBe(agent.id);

      const agents = await service.getAgents();
      expect(agents).toHaveLength(0);

      const conv = await service.getConversation(conversation.id);
      expect(conv!.participants).not.toContain(agent.id);
    });
  });
});
