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
  ReadNotificationsArgsSchema,
} from '../schemas/tool-schemas.js';
import { StateService } from '../services/state-service.js';
import { formatNotificationContent, writeNotificationToParticipants, writeProfileSetupNotification } from '../utils/notification-utils.js';

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
}

export async function handleToolCall(
  stateService: StateService,
  name: string,
  agentId: string,
  rawArgs: Record<string, unknown> | undefined,
) {
  switch (name) {
    case 'list_conversations': {
      const args = ListConversationsArgsSchema.parse(rawArgs ?? {});
      const scope = args.scope ?? 'all';
      const agent = await stateService.getAgent(agentId);
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
      const { content, conversationId, agentId: targetAgentId } = args;

      if (!conversationId && !targetAgentId) {
        return errorResult('Either conversationId or agentId is required.');
      }

      let targetConversationId: string;
      if (conversationId) {
        const conversation = await stateService.getConversation(conversationId);
        if (!conversation) {
          return errorResult(`Conversation ${conversationId} not found.`);
        }
        if (!conversation.participants.includes(agentId)) {
          return errorResult('You must join this conversation before sending messages.');
        }
        targetConversationId = conversationId;
      } else {
        const dmConversation = await stateService.getOrCreateDmConversation(agentId, targetAgentId!);
        targetConversationId = dmConversation.id;
        await stateService.setHasAnnounced(agentId, targetConversationId);
        await stateService.setHasAnnounced(targetAgentId!, targetConversationId);
      }

      const message = await stateService.addMessage(targetConversationId, agentId, content, 'message');

      const agent = await stateService.getAgent(agentId);
      const conversation = await stateService.getConversation(targetConversationId);
      let responseText = `Message sent (${message.id}) to conversation ${targetConversationId}.`;
      if ((agent?.profile.name == null) && conversation && conversation.participants.length >= 2) {
        responseText += '\n\nReminder: your profile is not set. Use update_profile to set your name, role, expertise, and status so other participants can identify you.';
      }
      return textResult(responseText);
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

      const agent = await stateService.updateProfile(agentId, {
        name: args.name,
        role: args.role,
        expertise: args.expertise,
        status: args.status,
      });

      for (const convId of agent.conversations) {
        if (!agent.hasAnnounced[convId]) {
          await stateService.addMessage(convId, agentId, `${agent.profile.name} joined the conversation.`, 'system');
          await writeNotificationToParticipants(
            stateService,
            convId,
            agentId,
            NotificationType.Join,
            `${agent.profile.name} joined the conversation.`,
            { agentName: agent.profile.name },
          );
          await stateService.setHasAnnounced(agentId, convId);
        }
      }

      for (const convId of agent.conversations) {
        await writeNotificationToParticipants(
          stateService,
          convId,
          agentId,
          NotificationType.ProfileUpdate,
          `${agent.profile.name ?? agentId} updated: name, role, expertise, status`,
          { excludeAgentId: agentId, agentName: agent.profile.name },
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
        participants: [agentId],
      });
      await stateService.setHasAnnounced(agentId, conversation.id);

      return textResult(
        `Conversation created:\n  ID: ${conversation.id}\n  Name: ${conversation.name}\n  Topic: ${conversation.topic ?? 'none'}\n  Type: ${conversation.type}`,
      );
    }

    case 'join_conversation': {
      const args = JoinConversationArgsSchema.parse(rawArgs ?? {});
      const { conversationId } = args;

      await stateService.joinConversation(agentId, conversationId);

      const conversation = await stateService.getConversation(conversationId);
      if (conversation && conversation.participants.length >= 2) {
        await writeProfileSetupNotification(stateService, conversationId, agentId);
      }

      return textResult(`Joined conversation ${conversationId}.`);
    }

    case 'leave_conversation': {
      const args = LeaveConversationArgsSchema.parse(rawArgs ?? {});
      const { conversationId } = args;

      const agent = await stateService.getAgent(agentId);
      const agentName = agent?.profile.name ?? agentId;

      await stateService.addMessage(conversationId, agentId, `${agentName} left the conversation.`, 'system');

      await writeNotificationToParticipants(
        stateService,
        conversationId,
        agentId,
        NotificationType.Leave,
        `${agentName} left the conversation.`,
        { agentName: agent?.profile.name },
      );

      await stateService.leaveConversation(agentId, conversationId);

      return textResult(`Left conversation ${conversationId}.`);
    }

    case 'read_notifications': {
      ReadNotificationsArgsSchema.parse(rawArgs ?? {});
      const notifications = await stateService.readAndClearInbox(agentId);
      if (notifications.length === 0) {
        return textResult('No new notifications.');
      }
      const lines = notifications.map(formatNotificationContent);
      return textResult(`${notifications.length} notification(s):\n${lines.join('\n')}`);
    }

    default:
      return errorResult(`Unknown tool: ${name}`);
  }
}
