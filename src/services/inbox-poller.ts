import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { NotificationType } from '../enums/notification-type.js';
import type { Notification } from '../types/index.js';
import { INBOXES_DIR } from '../constants/storage.js';
import { withFileLock } from '../utils/file-lock.js';
import { readJsonFile, writeJsonFile } from '../utils/file-utils.js';

function formatNotificationContent(notification: Notification): string {
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

export class InboxPollerService {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  start(
    agentId: string,
    pollIntervalMs: number,
    mcpServer: Server,
    storagePath: string,
  ): void {
    this.intervalId = setInterval(async () => {
      try {
        const inboxPath = path.join(storagePath, INBOXES_DIR, `${agentId}.json`);
        await withFileLock(inboxPath, async () => {
          const notifications = (await readJsonFile<Notification[]>(inboxPath)) ?? [];
          if (notifications.length === 0) return;

          for (const notification of notifications) {
            await mcpServer.notification({
              method: 'notifications/claude/channel',
              params: {
                content: formatNotificationContent(notification),
                meta: {
                  conversationId: notification.conversationId,
                  senderId: notification.agentId,
                  type: notification.type,
                },
              },
            });
          }

          await writeJsonFile(inboxPath, []);
        });
      } catch (err: unknown) {
        if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
          return;
        }
        console.error('Inbox poller error:', err);
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('transport') || message.includes('notification')) {
          this.stop();
        }
      }
    }, pollIntervalMs);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
