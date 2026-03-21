import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { StateService } from '../services/state-service.js';
import { SessionStateService } from '../services/session-state-service.js';
import { handleCursorJoin, handleCursorLeave } from '../gchat.js';
import { ConversationType } from '../enums/conversation-type.js';
import { NotificationType } from '../enums/notification-type.js';
import { INBOXES_DIR } from '../constants/storage.js';
import type { Notification } from '../types/notification.js';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let tmpDir: string;
let stateService: StateService;
let sessionStateService: SessionStateService;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gchat-cli-test-'));
  stateService = new StateService(tmpDir);
  await stateService.init();
  sessionStateService = new SessionStateService(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('cursor-join', () => {
  describe('Given project path and server PID', () => {
    it('When cursor-join is called Then an agent UUID and conversation UUID are returned', async () => {
      const projectPath = '/test-project';
      const serverPid = 12345;

      const result = await handleCursorJoin(projectPath, serverPid, { stateService, sessionStateService });

      expect(result.agentId).toMatch(UUID_V4_REGEX);
      expect(result.conversationId).toMatch(UUID_V4_REGEX);
    });

    it('When cursor-join is called Then the agent is registered and session state is written', async () => {
      const projectPath = '/test-project';
      const serverPid = 12345;

      const result = await handleCursorJoin(projectPath, serverPid, { stateService, sessionStateService });

      const registeredAgent = await stateService.getAgent(result.agentId);
      expect(registeredAgent).not.toBeNull();
      expect(registeredAgent!.projectPath).toBe(projectPath);

      const sessionResult = await sessionStateService.readSessionAgent(serverPid);
      expect(sessionResult).toEqual({ agentId: result.agentId, projectPath });
    });

    it('When cursor-join is called Then the agent is a participant in the project conversation', async () => {
      const projectPath = '/test-project';
      const serverPid = 12345;

      const result = await handleCursorJoin(projectPath, serverPid, { stateService, sessionStateService });

      const conversation = await stateService.getConversation(result.conversationId);
      expect(conversation).not.toBeNull();
      expect(conversation!.participants).toContain(result.agentId);
    });
  });

  describe('Given project path with existing conversation and 1 participant', () => {
    it('When cursor-join is called Then a join notification is written to the existing participant inbox', async () => {
      const projectPath = '/test-project';

      const agentA = await stateService.registerAgent(projectPath);
      const conversation = await stateService.getOrCreateProjectConversation(projectPath);
      await stateService.joinConversation(agentA.id, conversation.id);

      const serverPidB = 54321;
      const result = await handleCursorJoin(projectPath, serverPidB, { stateService, sessionStateService });

      const inboxPath = path.join(tmpDir, INBOXES_DIR, `${agentA.id}.json`);
      let notifications: Notification[] = [];
      try {
        const raw = await fs.readFile(inboxPath, 'utf-8');
        notifications = JSON.parse(raw) as Notification[];
      } catch {
        notifications = [];
      }

      const joinNotification = notifications.find(
        (n) => n.type === NotificationType.Join && n.agentId === result.agentId,
      );
      expect(joinNotification).toBeDefined();
    });
  });
});

describe('cursor-leave', () => {
  describe('Given agent X registered with PID 1234', () => {
    it('When cursor-leave is called Then X is unregistered and session state is cleared', async () => {
      const projectPath = '/test-project';
      const serverPid = 1234;

      const joinResult = await handleCursorJoin(projectPath, serverPid, { stateService, sessionStateService });

      await handleCursorLeave(serverPid, { stateService, sessionStateService });

      const registeredAgent = await stateService.getAgent(joinResult.agentId);
      expect(registeredAgent).toBeNull();

      const sessionResult = await sessionStateService.readSessionAgent(serverPid);
      expect(sessionResult).toBeNull();
    });
  });

  describe('Given no session state for PID 9999', () => {
    it('When cursor-leave is called Then no error is thrown', async () => {
      await expect(
        handleCursorLeave(9999, { stateService, sessionStateService }),
      ).resolves.toBeUndefined();
    });
  });

  describe('Given agent X in conversation with agent Y', () => {
    it('When cursor-leave is called for X Then Y has a leave notification in its inbox', async () => {
      const projectPath = '/test-project';
      const serverPidX = 1234;
      const serverPidY = 5678;

      const resultY = await handleCursorJoin(projectPath, serverPidY, { stateService, sessionStateService });
      const resultX = await handleCursorJoin(projectPath, serverPidX, { stateService, sessionStateService });

      await handleCursorLeave(serverPidX, { stateService, sessionStateService });

      const inboxPath = path.join(tmpDir, INBOXES_DIR, `${resultY.agentId}.json`);
      let notifications: Notification[] = [];
      try {
        const raw = await fs.readFile(inboxPath, 'utf-8');
        notifications = JSON.parse(raw) as Notification[];
      } catch {
        notifications = [];
      }

      const leaveNotification = notifications.find(
        (n) => n.type === NotificationType.Leave && n.agentId === resultX.agentId,
      );
      expect(leaveNotification).toBeDefined();
    });
  });

  describe('Given agent X in 2 conversations with server PID', () => {
    it('When cursor-leave is called Then X is removed from both conversations and unregistered', async () => {
      const projectPath = '/test-project';
      const serverPid = 1234;

      const joinResult = await handleCursorJoin(projectPath, serverPid, { stateService, sessionStateService });

      const secondConversation = await stateService.createConversation({
        type: ConversationType.Group,
        name: 'Second conversation',
        participants: [joinResult.agentId],
      });

      await handleCursorLeave(serverPid, { stateService, sessionStateService });

      const agent = await stateService.getAgent(joinResult.agentId);
      expect(agent).toBeNull();

      const conv1 = await stateService.getConversation(joinResult.conversationId);
      expect(conv1!.participants).not.toContain(joinResult.agentId);

      const conv2 = await stateService.getConversation(secondConversation.id);
      expect(conv2!.participants).not.toContain(joinResult.agentId);
    });
  });

  describe('Given agent X as sole participant in conversation C', () => {
    it('When cursor-leave is called Then conversation C is archived', async () => {
      const projectPath = '/test-project';
      const serverPid = 1234;

      const joinResult = await handleCursorJoin(projectPath, serverPid, { stateService, sessionStateService });

      await handleCursorLeave(serverPid, { stateService, sessionStateService });

      const conversation = await stateService.getConversation(joinResult.conversationId);
      expect(conversation).not.toBeNull();
      expect(conversation!.archivedAt).toBeDefined();
      expect(typeof conversation!.archivedAt).toBe('number');
    });
  });
});
