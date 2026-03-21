import os from 'node:os';
import path from 'node:path';

export const BASE_DIR = path.join(os.homedir(), '.group-chat-mcp');
export const AGENTS_FILE = 'agents.json';
export const CONVERSATIONS_FILE = 'conversations.json';
export const MESSAGES_DIR = 'messages';
export const INBOXES_DIR = 'inboxes';
export const SESSIONS_DIR = 'sessions';
