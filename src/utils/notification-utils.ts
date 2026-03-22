import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { INBOXES_DIR } from '../constants/storage.js';
import { NotificationType } from '../enums/notification-type.js';
import { StateService } from '../services/state-service.js';
import type { Notification } from '../types/index.js';
import { appendToJsonArray } from './file-utils.js';
import { withFileLock } from './file-lock.js';

export function formatNotificationContent(notification: Notification): string {
  const displayName = notification.agentName ?? notification.agentId;
  switch (notification.type) {
    case NotificationType.Message:
      return `[${displayName}] in conversation ${notification.conversationId}: ${notification.content}`;
    case NotificationType.Join:
      return `[${displayName}] joined conversation ${notification.conversationId}${notification.content ? ': ' + notification.content : ''}`;
    case NotificationType.Leave:
      return `[${displayName}] left conversation ${notification.conversationId}`;
    case NotificationType.ProfileUpdate:
      return `[${displayName}] updated their profile: ${notification.content}`;
    default:
      return notification.content;
  }
}

export async function writeProfileSetupNotification(
  stateService: StateService,
  conversationId: string,
  agentId: string,
): Promise<void> {
  const notification: Notification = {
    id: uuidv4(),
    type: NotificationType.Join,
    conversationId,
    agentId,
    content: 'You joined a conversation with other participants. Update your profile (name, role, expertise, status) using update_profile once your role becomes clear.',
    timestamp: Date.now(),
  };
  const inboxPath = path.join(stateService.baseDir, INBOXES_DIR, `${agentId}.json`);
  await withFileLock(inboxPath, async () => {
    await appendToJsonArray(inboxPath, notification);
  });
}

export async function writeNotificationToParticipants(
  stateService: StateService,
  conversationId: string,
  senderId: string,
  type: NotificationType,
  content: string,
  opts?: { excludeAgentId?: string; agentName?: string },
): Promise<void> {
  const conversation = await stateService.getConversation(conversationId);
  if (!conversation) return;

  for (const participantId of conversation.participants) {
    if (participantId === (opts?.excludeAgentId ?? senderId)) continue;
    const notification: Notification = {
      id: uuidv4(),
      type,
      conversationId,
      agentId: senderId,
      ...(opts?.agentName != null && { agentName: opts.agentName }),
      content,
      timestamp: Date.now(),
    };
    const inboxPath = path.join(stateService.baseDir, INBOXES_DIR, `${participantId}.json`);
    await withFileLock(inboxPath, async () => {
      await appendToJsonArray(inboxPath, notification);
    });
  }
}
