import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { StateService } from '../services/state-service.js';
import { handleToolCall } from '../services/tool-handlers.js';
import { NotificationType } from '../enums/notification-type.js';
import { writeJsonFile } from '../utils/file-utils.js';
import { formatNotificationContent } from '../utils/notification-utils.js';
import type { Notification } from '../types/notification.js';

let tmpDir: string;
let stateService: StateService;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gchat-inbox-test-'));
  stateService = new StateService(tmpDir);
  await stateService.init();
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('read_notifications', () => {
  describe('Given 3 notifications in agent inbox', () => {
    it('When read_notifications tool is called Then all 3 are returned', async () => {
      const agent = await stateService.registerAgent('/test-project');
      const inboxPath = path.join(tmpDir, 'inboxes', `${agent.id}.json`);

      const notifications: Notification[] = [
        { id: 'n1', type: NotificationType.Message, conversationId: 'conv-1', agentId: 'sender-1', content: 'Hello', timestamp: Date.now() },
        { id: 'n2', type: NotificationType.Join, conversationId: 'conv-1', agentId: 'sender-2', content: 'sender-2 joined', timestamp: Date.now() },
        { id: 'n3', type: NotificationType.Leave, conversationId: 'conv-1', agentId: 'sender-3', content: 'sender-3 left', timestamp: Date.now() },
      ];
      await writeJsonFile(inboxPath, notifications);

      const result = await handleToolCall(stateService, 'read_notifications', agent.id, undefined);

      const outputText = result.content[0].text;
      const outputLines = outputText.split('\n');
      const headerLine = outputLines[0];
      const notificationLines = outputLines.slice(1).filter((line: string) => line.trim().length > 0);
      expect(headerLine).toMatch(/^3 notification/);
      expect(notificationLines.length).toBe(3);
    });

    it('When read_notifications tool is called Then inbox is empty after the call', async () => {
      const agent = await stateService.registerAgent('/test-project');
      const inboxPath = path.join(tmpDir, 'inboxes', `${agent.id}.json`);

      const notifications: Notification[] = [
        { id: 'n1', type: NotificationType.Message, conversationId: 'conv-1', agentId: 'sender-1', content: 'Hello', timestamp: Date.now() },
        { id: 'n2', type: NotificationType.Join, conversationId: 'conv-1', agentId: 'sender-2', content: 'sender-2 joined', timestamp: Date.now() },
        { id: 'n3', type: NotificationType.Leave, conversationId: 'conv-1', agentId: 'sender-3', content: 'sender-3 left', timestamp: Date.now() },
      ];
      await writeJsonFile(inboxPath, notifications);

      await handleToolCall(stateService, 'read_notifications', agent.id, undefined);

      const raw = await fs.readFile(inboxPath, 'utf-8');
      const remaining = JSON.parse(raw);
      expect(remaining).toEqual([]);
    });
  });

  describe('Given empty inbox', () => {
    it('When read_notifications tool is called Then result indicates no notifications and inbox remains empty', async () => {
      const agent = await stateService.registerAgent('/test-project');

      const result = await handleToolCall(stateService, 'read_notifications', agent.id, undefined);

      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      expect('isError' in result).toBe(false);

      const inbox = await stateService.getInbox(agent.id);
      expect(inbox).toEqual([]);
    });
  });

  describe('Given agent has notifications', () => {
    it('When read_notifications is called Then notifications are formatted using the same format as the inbox poller', async () => {
      const agent = await stateService.registerAgent('/test-project');
      const inboxPath = path.join(tmpDir, 'inboxes', `${agent.id}.json`);

      const notifications: Notification[] = [
        { id: 'n1', type: NotificationType.Message, conversationId: 'conv-1', agentId: 'sender-1', content: 'Hello', timestamp: Date.now() },
        { id: 'n2', type: NotificationType.Join, conversationId: 'conv-1', agentId: 'sender-2', content: 'sender-2 joined', timestamp: Date.now() },
        { id: 'n3', type: NotificationType.Leave, conversationId: 'conv-1', agentId: 'sender-3', content: 'sender-3 left', timestamp: Date.now() },
      ];
      await writeJsonFile(inboxPath, notifications);

      const result = await handleToolCall(stateService, 'read_notifications', agent.id, undefined);
      const outputText = result.content[0].text;
      const outputLines = outputText.split('\n').slice(1);

      for (let i = 0; i < notifications.length; i++) {
        const expected = formatNotificationContent(notifications[i]);
        expect(outputLines[i]).toBe(expected);
      }
    });
  });
});
