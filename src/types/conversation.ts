export enum ConversationType {
  Project = 'project',
  Dm = 'dm',
  Group = 'group',
}

export interface Conversation {
  id: string;
  type: ConversationType;
  projectPath?: string;
  name?: string;
  topic?: string;
  participants: string[];
  createdAt: number;
  archivedAt?: number;
}

export interface CreateConversationParams {
  type: ConversationType;
  projectPath?: string;
  name?: string;
  topic?: string;
  participants: string[];
}
