import { MessageType } from '../enums/message-type.js';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: MessageType;
  timestamp: number;
}
