import { ConversationType } from '../enums/conversation-type.js';

export interface CreateConversationParams {
  type: ConversationType;
  projectPath?: string;
  name?: string;
  topic?: string;
  participants: string[];
}
