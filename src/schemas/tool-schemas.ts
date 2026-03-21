import { z } from 'zod';

export const ListConversationsArgsSchema = z.object({
  scope: z.enum(['project', 'global', 'all']).optional(),
});

export const ListParticipantsArgsSchema = z.object({
  conversationId: z.string().optional(),
});

export const SendMessageArgsSchema = z.object({
  content: z.string(),
  conversationId: z.string().optional(),
  agentId: z.string().optional(),
});

export const GetConversationArgsSchema = z.object({
  conversationId: z.string(),
});

export const UpdateProfileArgsSchema = z.object({
  name: z.string().optional(),
  role: z.string().optional(),
  expertise: z.string().optional(),
  status: z.string().optional(),
});

export const CreateConversationArgsSchema = z.object({
  name: z.string(),
  topic: z.string().optional(),
});

export const JoinConversationArgsSchema = z.object({
  conversationId: z.string(),
});

export const LeaveConversationArgsSchema = z.object({
  conversationId: z.string(),
});

export const ReadNotificationsArgsSchema = z.object({});

export const toolDefinitions = [
  {
    name: 'list_conversations',
    description: 'List conversations the agent can see. Filter by scope: project (same project), global (all), or all (default).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        scope: {
          type: 'string',
          enum: ['project', 'global', 'all'],
          description: "Filter scope: 'project' for same project, 'global' for all, 'all' for all (default).",
        },
      },
    },
  },
  {
    name: 'list_participants',
    description: 'List participants in a conversation, or all known agents if no conversationId is provided.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conversationId: {
          type: 'string',
          description: 'The conversation ID to list participants for. If omitted, lists all known agents.',
        },
      },
    },
  },
  {
    name: 'send_message',
    description: 'Send a message to a conversation or directly to an agent. Provide either conversationId or agentId.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        content: { type: 'string', description: 'The message content to send.' },
        conversationId: { type: 'string', description: 'Target conversation ID.' },
        agentId: { type: 'string', description: 'Target agent ID for a direct message.' },
      },
      required: ['content'],
    },
  },
  {
    name: 'get_conversation',
    description: 'Get full conversation details including metadata and message history.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conversationId: { type: 'string', description: 'The conversation ID to retrieve.' },
      },
      required: ['conversationId'],
    },
  },
  {
    name: 'update_profile',
    description: "Update this agent's profile information (name, role, expertise, status).",
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Display name for this agent.' },
        role: { type: 'string', description: 'Role description.' },
        expertise: { type: 'string', description: 'Areas of expertise.' },
        status: { type: 'string', description: 'Current status.' },
      },
    },
  },
  {
    name: 'create_conversation',
    description: 'Create a new group conversation with a name and optional topic.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Name for the new conversation.' },
        topic: { type: 'string', description: 'Optional topic for the conversation.' },
      },
      required: ['name'],
    },
  },
  {
    name: 'join_conversation',
    description: 'Join an existing conversation.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conversationId: { type: 'string', description: 'The conversation ID to join.' },
      },
      required: ['conversationId'],
    },
  },
  {
    name: 'leave_conversation',
    description: 'Leave a conversation.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        conversationId: { type: 'string', description: 'The conversation ID to leave.' },
      },
      required: ['conversationId'],
    },
  },
  {
    name: 'read_notifications',
    description: 'Read and clear all pending notifications (messages, join/leave events) from other agents. Use this tool periodically to stay updated on conversation activity. Returns all pending notifications and empties the inbox.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
    },
  },
];
