import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { INBOXES_DIR } from '../constants/storage.js';
import { NotificationType } from '../enums/notification-type.js';
import { StateService } from '../services/state-service.js';
import type { Notification } from '../types/index.js';
import { appendToJsonArray } from './file-utils.js';
import { withFileLock } from './file-lock.js';

export function formatNotificationContent(notification: Notification): string {
  switch (notification.type) {
    case NotificationType.Message:
      return `[${notification.agentId}] in conversation ${notification.conversationId}: ${notification.content}`;
    case NotificationType.Join:
      return `[${notification.agentId}] joined conversation ${notification.conversationId}`;
    case NotificationType.Leave:
      return `[${notification.agentId}] left conversation ${notification.conversationId}`;
    case NotificationType.ProfileUpdate:
      return `[${notification.agentId}] updated their profile: ${notification.content}`;
    default:
      return notification.content;
  }
}

export async function writeNotificationToParticipants(
  stateService: StateService,
  conversationId: string,
  senderId: string,
  type: NotificationType,
  content: string,
  excludeAgentId?: string,
): Promise<void> {
  const conversation = await stateService.getConversation(conversationId);
  if (!conversation) return;

  for (const participantId of conversation.participants) {
    if (participantId === (excludeAgentId ?? senderId)) continue;
    const notification: Notification = {
      id: uuidv4(),
      type,
      conversationId,
      agentId: senderId,
      content,
      timestamp: Date.now(),
    };
    const inboxPath = path.join(stateService.baseDir, INBOXES_DIR, `${participantId}.json`);
    await withFileLock(inboxPath, async () => {
      await appendToJsonArray(inboxPath, notification);
    });
  }
}
