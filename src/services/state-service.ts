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
import { ConversationType } from '../enums/conversation-type.js';
import { MessageType } from '../enums/message-type.js';
import { NotificationType } from '../enums/notification-type.js';
import type {
  Agent,
  ProfileUpdate,
  Conversation,
  CreateConversationParams,
  Message,
  Notification,
} from '../types/index.js';
import { readJsonFile, writeJsonFile, appendToJsonArray } from '../utils/file-utils.js';
import { isProcessAlive, withFileLock } from '../utils/file-lock.js';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUuid(id: string): void {
  if (!UUID_V4_REGEX.test(id)) {
    throw new Error(`Invalid UUID: ${id}`);
  }
}

export class StateService {
  private readonly storagePath: string;

  constructor(storagePath: string = BASE_DIR) {
    this.storagePath = storagePath;
  }

  get baseDir(): string {
    return this.storagePath;
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

  private stateLockPath(): string {
    return path.join(this.storagePath, 'state.lock');
  }

  private messagesPath(conversationId: string): string {
    validateUuid(conversationId);
    return path.join(this.storagePath, MESSAGES_DIR, `${conversationId}.json`);
  }

  private inboxPath(agentId: string): string {
    validateUuid(agentId);
    return path.join(this.storagePath, INBOXES_DIR, `${agentId}.json`);
  }

  private withStateLock<T>(fn: () => Promise<T>): Promise<T> {
    return withFileLock(this.stateLockPath(), fn);
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
        pid: process.pid,
      };
      const agents = await this.getAgents();
      agents.push(agent);
      await writeJsonFile(this.agentsPath(), agents);
      return agent;
    });
  }

  async reapStaleAgents(): Promise<string[]> {
    return this.withStateLock(async () => {
      const agents = await this.getAgents();
      const staleIds: string[] = [];
      const alive: Agent[] = [];
      for (const agent of agents) {
        if (agent.pid && !isProcessAlive(agent.pid)) {
          staleIds.push(agent.id);
        } else {
          alive.push(agent);
        }
      }
      if (staleIds.length > 0) {
        await writeJsonFile(this.agentsPath(), alive);

        const conversations = await this.readConversations();
        let conversationsChanged = false;
        for (const conversation of conversations) {
          const before = conversation.participants.length;
          conversation.participants = conversation.participants.filter(
            (p) => !staleIds.includes(p),
          );
          if (conversation.participants.length !== before) {
            conversationsChanged = true;
            if (conversation.participants.length === 0 && !conversation.archivedAt) {
              conversation.archivedAt = Date.now();
            }
          }
        }
        if (conversationsChanged) {
          await writeJsonFile(this.conversationsPath(), conversations);
        }
      }
      return staleIds;
    });
  }

  async unregisterAgent(agentId: string): Promise<void> {
    await this.withStateLock(async () => {
      const agents = await this.getAgents();
      const agent = agents.find((a) => a.id === agentId);
      if (!agent) return;

      for (const conversationId of [...agent.conversations]) {
        const conversations = await this.readConversations();
        const conversation = conversations.find((c) => c.id === conversationId);
        if (!conversation) continue;

        conversation.participants = conversation.participants.filter((p) => p !== agentId);
        if (conversation.participants.length === 0) {
          conversation.archivedAt = Date.now();
        }
        await writeJsonFile(this.conversationsPath(), conversations);

        agent.conversations = agent.conversations.filter((c) => c !== conversationId);
      }

      const freshAgents = await this.getAgents();
      const filtered = freshAgents.filter((a) => a.id !== agentId);
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
    return this.withStateLock(async () => {
      const conversation = this.buildConversation(params);

      const conversations = await this.readConversations();
      conversations.push(conversation);
      await writeJsonFile(this.conversationsPath(), conversations);

      if (params.participants.length > 0) {
        const agents = await this.getAgents();
        for (const participantId of params.participants) {
          const agent = agents.find((a) => a.id === participantId);
          if (agent && !agent.conversations.includes(conversation.id)) {
            agent.conversations.push(conversation.id);
          }
        }
        await writeJsonFile(this.agentsPath(), agents);
      }

      return conversation;
    });
  }

  async getOrCreateProjectConversation(projectPath: string): Promise<Conversation> {
    return this.withStateLock(async () => {
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
    return this.withStateLock(async () => {
      const conversations = await this.readConversations();
      const existing = conversations.find(
        (c) =>
          c.type === ConversationType.Dm &&
          c.archivedAt == null &&
          c.participants.length === 2 &&
          c.participants.includes(agentId1) &&
          c.participants.includes(agentId2),
      );
      if (existing) return existing;

      const conversation = this.buildConversation({
        type: ConversationType.Dm,
        participants: [agentId1, agentId2],
      });
      conversations.push(conversation);
      await writeJsonFile(this.conversationsPath(), conversations);

      const agents = await this.getAgents();
      for (const participantId of conversation.participants) {
        const agent = agents.find((a) => a.id === participantId);
        if (agent && !agent.conversations.includes(conversation.id)) {
          agent.conversations.push(conversation.id);
        }
      }
      await writeJsonFile(this.agentsPath(), agents);

      return conversation;
    });
  }

  async joinConversation(agentId: string, conversationId: string): Promise<void> {
    await this.withStateLock(async () => {
      const conversations = await this.readConversations();
      const conversation = conversations.find((c) => c.id === conversationId);
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      if (!conversation.participants.includes(agentId)) {
        conversation.participants.push(agentId);
      }
      await writeJsonFile(this.conversationsPath(), conversations);

      const agents = await this.getAgents();
      const agent = agents.find((a) => a.id === agentId);
      if (agent && !agent.conversations.includes(conversationId)) {
        agent.conversations.push(conversationId);
      }
      await writeJsonFile(this.agentsPath(), agents);
    });
  }

  async leaveConversation(agentId: string, conversationId: string): Promise<void> {
    await this.withStateLock(async () => {
      const conversations = await this.readConversations();
      const conversation = conversations.find((c) => c.id === conversationId);
      if (!conversation) return;

      conversation.participants = conversation.participants.filter((p) => p !== agentId);
      if (conversation.participants.length === 0) {
        conversation.archivedAt = Date.now();
      }
      await writeJsonFile(this.conversationsPath(), conversations);

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
    const conversation = await withFileLock(this.conversationsPath(), async () => {
      return this.getConversation(conversationId);
    });
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

  async readAndClearInbox(agentId: string): Promise<Notification[]> {
    return await withFileLock(this.inboxPath(agentId), async () => {
      const notifications = (await readJsonFile<Notification[]>(this.inboxPath(agentId))) ?? [];
      if (notifications.length > 0) {
        await writeJsonFile(this.inboxPath(agentId), []);
      }
      return notifications;
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
