import { NotificationType } from '../enums/notification-type.js';

export interface Notification {
  id: string;
  type: NotificationType;
  conversationId: string;
  agentId: string;
  agentName?: string;
  content: string;
  timestamp: number;
}
