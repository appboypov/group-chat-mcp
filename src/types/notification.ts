export enum NotificationType {
  Message = 'message',
  Join = 'join',
  Leave = 'leave',
  ProfileUpdate = 'profile_update',
}

export interface Notification {
  id: string;
  type: NotificationType;
  conversationId: string;
  agentId: string;
  content: string;
  timestamp: number;
}
