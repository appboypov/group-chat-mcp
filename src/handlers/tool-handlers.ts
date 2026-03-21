import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { GC_AGENT_ID } from '../constants/env.js';
import { BASE_DIR, INBOXES_DIR } from '../constants/storage.js';
import { ConversationType } from '../enums/conversation-type.js';
import { NotificationType } from '../enums/notification-type.js';
import {
  ListConversationsArgsSchema,
  ListParticipantsArgsSchema,
  SendMessageArgsSchema,
  GetConversationArgsSchema,
  UpdateProfileArgsSchema,
  CreateConversationArgsSchema,
  JoinConversationArgsSchema,
  LeaveConversationArgsSchema,
} from '../schemas/tool-schemas.js';
import { StateService } from '../services/state-service.js';
import type { Notification } from '../types/index.js';
import { appendToJsonArray } from '../utils/file-utils.js';
import { withFileLock } from '../utils/file-lock.js';

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
}

async function writeNotificationToParticipants(
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
    const inboxPath = path.join(BASE_DIR, INBOXES_DIR, `${participantId}.json`);
    await withFileLock(inboxPath, async () => {
      await appendToJsonArray(inboxPath, notification);
    });
  }
}

export async function handleToolCall(
  stateService: StateService,
  name: string,
  rawArgs: Record<string, unknown> | undefined,
) {
  switch (name) {
    case 'list_conversations': {
      const args = ListConversationsArgsSchema.parse(rawArgs ?? {});
      const scope = args.scope ?? 'all';
      const agent = await stateService.getAgent(GC_AGENT_ID);
      if (scope === 'project' && !agent) {
        return errorResult('Agent is not registered. Register first before listing project conversations.');
      }
      let conversations;
      if (scope === 'project' && agent?.projectPath) {
        conversations = await stateService.getConversations({ projectPath: agent.projectPath });
      } else {
        conversations = await stateService.getConversations({});
      }
      const active = conversations.filter((c) => c.archivedAt == null);
      if (active.length === 0) {
        return textResult('No conversations found.');
      }
      const lines = active.map(
        (c) =>
          `- [${c.id}] ${c.name ?? '(unnamed)'} | Type: ${c.type} | Topic: ${c.topic ?? 'none'} | Participants: ${c.participants.length}`,
      );
      return textResult(`Conversations (${active.length}):\n${lines.join('\n')}`);
    }

    case 'list_participants': {
      const args = ListParticipantsArgsSchema.parse(rawArgs ?? {});
      const conversationId = args.conversationId;
      if (conversationId) {
        const conversation = await stateService.getConversation(conversationId);
        if (!conversation) {
          return errorResult(`Conversation ${conversationId} not found.`);
        }
        const agents = await stateService.getAgents();
        const participants = agents.filter((a) => conversation.participants.includes(a.id));
        if (participants.length === 0) {
          return textResult('No participants in this conversation.');
        }
        const lines = participants.map(
          (a) =>
            `- [${a.id}] ${a.profile.name ?? '(no name)'} | Role: ${a.profile.role ?? 'none'} | Expertise: ${a.profile.expertise ?? 'none'} | Status: ${a.profile.status ?? 'none'}`,
        );
        return textResult(`Participants in ${conversation.name ?? conversationId} (${participants.length}):\n${lines.join('\n')}`);
      }
      const agents = await stateService.getAgents();
      if (agents.length === 0) {
        return textResult('No agents registered.');
      }
      const lines = agents.map(
        (a) =>
          `- [${a.id}] ${a.profile.name ?? '(no name)'} | Role: ${a.profile.role ?? 'none'} | Project: ${a.projectPath} | Conversations: ${a.conversations.length}`,
      );
      return textResult(`All agents (${agents.length}):\n${lines.join('\n')}`);
    }

    case 'send_message': {
      const args = SendMessageArgsSchema.parse(rawArgs ?? {});
      const { content, conversationId, agentId } = args;

      if (!conversationId && !agentId) {
        return errorResult('Either conversationId or agentId is required.');
      }

      let targetConversationId: string;
      if (conversationId) {
        const conversation = await stateService.getConversation(conversationId);
        if (!conversation) {
          return errorResult(`Conversation ${conversationId} not found.`);
        }
        if (!conversation.participants.includes(GC_AGENT_ID)) {
          return errorResult('You must join this conversation before sending messages.');
        }
        targetConversationId = conversationId;
      } else {
        const dmConversation = await stateService.getOrCreateDmConversation(GC_AGENT_ID, agentId!);
        targetConversationId = dmConversation.id;
      }

      const message = await stateService.addMessage(targetConversationId, GC_AGENT_ID, content, 'message');
      return textResult(`Message sent (${message.id}) to conversation ${targetConversationId}.`);
    }

    case 'get_conversation': {
      const args = GetConversationArgsSchema.parse(rawArgs ?? {});
      const { conversationId } = args;
      const conversation = await stateService.getConversation(conversationId);
      if (!conversation) {
        return errorResult(`Conversation ${conversationId} not found.`);
      }
      const messages = await stateService.getMessages(conversationId);
      const agents = await stateService.getAgents();
      const agentMap = new Map(agents.map((a) => [a.id, a]));

      const header = [
        `Conversation: ${conversation.name ?? '(unnamed)'}`,
        `ID: ${conversation.id}`,
        `Type: ${conversation.type}`,
        `Topic: ${conversation.topic ?? 'none'}`,
        `Participants: ${conversation.participants.length}`,
        `Created: ${new Date(conversation.createdAt).toISOString()}`,
        '',
        '--- Messages ---',
      ];

      const messageLines = messages.map((m) => {
        const sender = agentMap.get(m.senderId);
        const senderName = sender?.profile.name ?? m.senderId;
        const time = new Date(m.timestamp).toISOString();
        if (m.type === 'system') {
          return `[${time}] ** ${m.content} **`;
        }
        return `[${time}] ${senderName}: ${m.content}`;
      });

      return textResult([...header, ...messageLines].join('\n'));
    }

    case 'update_profile': {
      const args = UpdateProfileArgsSchema.parse(rawArgs ?? {});
      const profileUpdate: Record<string, string> = {};
      if (args.name !== undefined) profileUpdate.name = args.name;
      if (args.role !== undefined) profileUpdate.role = args.role;
      if (args.expertise !== undefined) profileUpdate.expertise = args.expertise;
      if (args.status !== undefined) profileUpdate.status = args.status;

      const agent = await stateService.updateProfile(GC_AGENT_ID, profileUpdate);

      const updatedFields = Object.keys(profileUpdate).join(', ');
      for (const conversationId of agent.conversations) {
        await writeNotificationToParticipants(
          stateService,
          conversationId,
          GC_AGENT_ID,
          NotificationType.ProfileUpdate,
          `${agent.profile.name ?? GC_AGENT_ID} updated: ${updatedFields}`,
          GC_AGENT_ID,
        );
      }

      const lines = [
        'Profile updated:',
        `  Name: ${agent.profile.name ?? 'not set'}`,
        `  Role: ${agent.profile.role ?? 'not set'}`,
        `  Expertise: ${agent.profile.expertise ?? 'not set'}`,
        `  Status: ${agent.profile.status ?? 'not set'}`,
      ];
      return textResult(lines.join('\n'));
    }

    case 'create_conversation': {
      const args = CreateConversationArgsSchema.parse(rawArgs ?? {});
      const convName = args.name;
      const topic = args.topic;

      const conversation = await stateService.createConversation({
        type: ConversationType.Group,
        name: convName,
        topic,
        participants: [GC_AGENT_ID],
      });

      return textResult(
        `Conversation created:\n  ID: ${conversation.id}\n  Name: ${conversation.name}\n  Topic: ${conversation.topic ?? 'none'}\n  Type: ${conversation.type}`,
      );
    }

    case 'join_conversation': {
      const args = JoinConversationArgsSchema.parse(rawArgs ?? {});
      const { conversationId } = args;

      await stateService.joinConversation(GC_AGENT_ID, conversationId);

      const agent = await stateService.getAgent(GC_AGENT_ID);
      const agentName = agent?.profile.name ?? GC_AGENT_ID;

      await stateService.addMessage(conversationId, GC_AGENT_ID, `${agentName} joined the conversation.`, 'system');

      await writeNotificationToParticipants(
        stateService,
        conversationId,
        GC_AGENT_ID,
        NotificationType.Join,
        `${agentName} joined the conversation.`,
      );

      return textResult(`Joined conversation ${conversationId}.`);
    }

    case 'leave_conversation': {
      const args = LeaveConversationArgsSchema.parse(rawArgs ?? {});
      const { conversationId } = args;

      const agent = await stateService.getAgent(GC_AGENT_ID);
      const agentName = agent?.profile.name ?? GC_AGENT_ID;

      await stateService.addMessage(conversationId, GC_AGENT_ID, `${agentName} left the conversation.`, 'system');

      await writeNotificationToParticipants(
        stateService,
        conversationId,
        GC_AGENT_ID,
        NotificationType.Leave,
        `${agentName} left the conversation.`,
      );

      await stateService.leaveConversation(GC_AGENT_ID, conversationId);

      return textResult(`Left conversation ${conversationId}.`);
    }

    default:
      return errorResult(`Unknown tool: ${name}`);
  }
}
