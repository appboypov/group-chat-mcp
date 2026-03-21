import fs from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import {
  BASE_DIR,
  AGENTS_FILE,
  CONVERSATIONS_FILE,
  MESSAGES_DIR,
  INBOXES_DIR,
} from '../constants/storage.js';
import {
  Agent,
  ProfileUpdate,
  Conversation,
  ConversationType,
  CreateConversationParams,
  Message,
  MessageType,
  Notification,
  NotificationType,
} from '../types/index.js';
import { readJsonFile, writeJsonFile, appendToJsonArray } from '../utils/file-utils.js';
import { withFileLock } from '../utils/file-lock.js';

export class StateService {
  private readonly storagePath: string;

  constructor(storagePath: string = BASE_DIR) {
    this.storagePath = storagePath;
  }

  async init(): Promise<void> {
    await this.ensureStorageDir();
  }

  // --- Paths ---

  private agentsPath(): string {
    return path.join(this.storagePath, AGENTS_FILE);
  }

  private conversationsPath(): string {
    return path.join(this.storagePath, CONVERSATIONS_FILE);
  }

  private messagesPath(conversationId: string): string {
    return path.join(this.storagePath, MESSAGES_DIR, `${conversationId}.json`);
  }

  private inboxPath(agentId: string): string {
    return path.join(this.storagePath, INBOXES_DIR, `${agentId}.json`);
  }

  // --- Public Getters ---

  async getAgent(agentId: string): Promise<Agent | null> {
    const agents = await this.getAgents();
    return agents.find((a) => a.id === agentId) ?? null;
  }

  async getAgents(): Promise<Agent[]> {
    return (await readJsonFile<Agent[]>(this.agentsPath())) ?? [];
  }

  async getAgentsByProject(projectPath: string): Promise<Agent[]> {
    const agents = await this.getAgents();
    return agents.filter((a) => a.projectPath === projectPath);
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    const conversations = await this.readConversations();
    return conversations.find((c) => c.id === conversationId) ?? null;
  }

  async getConversations(scope: { projectPath?: string }): Promise<Conversation[]> {
    const conversations = await this.readConversations();
    if (scope.projectPath) {
      return conversations.filter((c) => c.projectPath === scope.projectPath);
    }
    return conversations;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    return (await readJsonFile<Message[]>(this.messagesPath(conversationId))) ?? [];
  }

  async getInbox(agentId: string): Promise<Notification[]> {
    return (await readJsonFile<Notification[]>(this.inboxPath(agentId))) ?? [];
  }

  // --- Public Mutators ---

  async registerAgent(projectPath: string): Promise<Agent> {
    return withFileLock(this.agentsPath(), async () => {
      const agent: Agent = {
        id: uuidv4(),
        projectPath,
        profile: {},
        joinedAt: Date.now(),
        conversations: [],
      };
      const agents = await this.getAgents();
      agents.push(agent);
      await writeJsonFile(this.agentsPath(), agents);
      return agent;
    });
  }

  async unregisterAgent(agentId: string): Promise<void> {
    const agent = await this.getAgent(agentId);
    if (!agent) return;

    for (const conversationId of [...agent.conversations]) {
      await this.leaveConversation(agentId, conversationId);
    }

    await withFileLock(this.agentsPath(), async () => {
      const agents = await this.getAgents();
      const filtered = agents.filter((a) => a.id !== agentId);
      await writeJsonFile(this.agentsPath(), filtered);
    });
  }

  async updateProfile(agentId: string, profile: ProfileUpdate): Promise<Agent> {
    return withFileLock(this.agentsPath(), async () => {
      const agents = await this.getAgents();
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      agent.profile = { ...agent.profile, ...profile };
      await writeJsonFile(this.agentsPath(), agents);
      return agent;
    });
  }

  async createConversation(params: CreateConversationParams): Promise<Conversation> {
    const conversation = this.buildConversation(params);

    await withFileLock(this.conversationsPath(), async () => {
      const conversations = await this.readConversations();
      conversations.push(conversation);
      await writeJsonFile(this.conversationsPath(), conversations);
    });

    if (params.participants.length > 0) {
      await withFileLock(this.agentsPath(), async () => {
        const agents = await this.getAgents();
        for (const participantId of params.participants) {
          const agent = agents.find((a) => a.id === participantId);
          if (agent && !agent.conversations.includes(conversation.id)) {
            agent.conversations.push(conversation.id);
          }
        }
        await writeJsonFile(this.agentsPath(), agents);
      });
    }

    return conversation;
  }

  async getOrCreateProjectConversation(projectPath: string): Promise<Conversation> {
    return withFileLock(this.conversationsPath(), async () => {
      const conversations = await this.readConversations();
      const active = conversations.find(
        (c) =>
          c.type === ConversationType.Project &&
          c.projectPath === projectPath &&
          c.archivedAt == null,
      );
      if (active) return active;

      const conversation = this.buildConversation({
        type: ConversationType.Project,
        projectPath,
        participants: [],
      });
      conversations.push(conversation);
      await writeJsonFile(this.conversationsPath(), conversations);
      return conversation;
    });
  }

  async getOrCreateDmConversation(agentId1: string, agentId2: string): Promise<Conversation> {
    let conversation: Conversation | undefined;
    let created = false;

    await withFileLock(this.conversationsPath(), async () => {
      const conversations = await this.readConversations();
      const existing = conversations.find(
        (c) =>
          c.type === ConversationType.Dm &&
          c.archivedAt == null &&
          c.participants.length === 2 &&
          c.participants.includes(agentId1) &&
          c.participants.includes(agentId2),
      );
      if (existing) {
        conversation = existing;
        return;
      }

      conversation = this.buildConversation({
        type: ConversationType.Dm,
        participants: [agentId1, agentId2],
      });
      conversations.push(conversation);
      await writeJsonFile(this.conversationsPath(), conversations);
      created = true;
    });

    if (created) {
      await withFileLock(this.agentsPath(), async () => {
        const agents = await this.getAgents();
        for (const participantId of conversation!.participants) {
          const agent = agents.find((a) => a.id === participantId);
          if (agent && !agent.conversations.includes(conversation!.id)) {
            agent.conversations.push(conversation!.id);
          }
        }
        await writeJsonFile(this.agentsPath(), agents);
      });
    }

    return conversation!;
  }

  async joinConversation(agentId: string, conversationId: string): Promise<void> {
    await withFileLock(this.conversationsPath(), async () => {
      const conversations = await this.readConversations();
      const conversation = conversations.find((c) => c.id === conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      if (!conversation.participants.includes(agentId)) {
        conversation.participants.push(agentId);
      }
      await writeJsonFile(this.conversationsPath(), conversations);
    });

    await withFileLock(this.agentsPath(), async () => {
      const agents = await this.getAgents();
      const agent = agents.find((a) => a.id === agentId);
      if (agent && !agent.conversations.includes(conversationId)) {
        agent.conversations.push(conversationId);
      }
      await writeJsonFile(this.agentsPath(), agents);
    });
  }

  async leaveConversation(agentId: string, conversationId: string): Promise<void> {
    await withFileLock(this.conversationsPath(), async () => {
      const conversations = await this.readConversations();
      const conversation = conversations.find((c) => c.id === conversationId);
      if (!conversation) return;

      conversation.participants = conversation.participants.filter((p) => p !== agentId);
      if (conversation.participants.length === 0) {
        conversation.archivedAt = Date.now();
      }
      await writeJsonFile(this.conversationsPath(), conversations);
    });

    await withFileLock(this.agentsPath(), async () => {
      const agents = await this.getAgents();
      const agent = agents.find((a) => a.id === agentId);
      if (agent) {
        agent.conversations = agent.conversations.filter((c) => c !== conversationId);
        await writeJsonFile(this.agentsPath(), agents);
      }
    });
  }

  async updateConversation(
    conversationId: string,
    updates: { name?: string; topic?: string },
  ): Promise<Conversation> {
    return withFileLock(this.conversationsPath(), async () => {
      const conversations = await this.readConversations();
      const conversation = conversations.find((c) => c.id === conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      if (updates.name !== undefined) conversation.name = updates.name;
      if (updates.topic !== undefined) conversation.topic = updates.topic;
      await writeJsonFile(this.conversationsPath(), conversations);
      return conversation;
    });
  }

  async addMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: 'message' | 'system',
  ): Promise<Message> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    const message: Message = {
      id: uuidv4(),
      conversationId,
      senderId,
      content,
      type: type === 'message' ? MessageType.Message : MessageType.System,
      timestamp: Date.now(),
    };

    await withFileLock(this.messagesPath(conversationId), async () => {
      await appendToJsonArray(this.messagesPath(conversationId), message);
    });

    if (type === 'message') {
      const notification: Omit<Notification, 'id' | 'timestamp'> = {
        type: NotificationType.Message,
        conversationId,
        agentId: senderId,
        content,
      };

      for (const participantId of conversation.participants) {
        if (participantId === senderId) continue;
        await withFileLock(this.inboxPath(participantId), async () => {
          await appendToJsonArray(this.inboxPath(participantId), {
            id: uuidv4(),
            ...notification,
            timestamp: Date.now(),
          } satisfies Notification);
        });
      }
    }

    return message;
  }

  async clearInbox(agentId: string): Promise<void> {
    await withFileLock(this.inboxPath(agentId), async () => {
      await writeJsonFile(this.inboxPath(agentId), []);
    });
  }

  async ensureStorageDir(): Promise<void> {
    await fs.mkdir(this.storagePath, { recursive: true });
    await fs.mkdir(path.join(this.storagePath, MESSAGES_DIR), { recursive: true });
    await fs.mkdir(path.join(this.storagePath, INBOXES_DIR), { recursive: true });
  }

  // --- Private Helpers ---

  private buildConversation(params: CreateConversationParams): Conversation {
    return {
      id: uuidv4(),
      type: params.type,
      projectPath: params.projectPath,
      name: params.name,
      topic: params.topic,
      participants: params.participants,
      createdAt: Date.now(),
    };
  }

  private async readConversations(): Promise<Conversation[]> {
    return (await readJsonFile<Conversation[]>(this.conversationsPath())) ?? [];
  }
}
