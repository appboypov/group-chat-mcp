export enum MessageType {
  Message = 'message',
  System = 'system',
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: MessageType;
  timestamp: number;
}
