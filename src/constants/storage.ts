import os from 'node:os';
import path from 'node:path';

export const BASE_DIR = path.join(os.homedir(), '.group-chat-mcp');
export const AGENTS_FILE = 'agents.json';
export const CONVERSATIONS_FILE = 'conversations.json';
export const MESSAGES_DIR = 'messages';
export const INBOXES_DIR = 'inboxes';
export const SESSIONS_DIR = 'sessions';
export const INSTALL_META_FILE = 'install-meta.json';
export const VERSION_CHECK_FILE = 'version-check.json';
export const VERSION_CHECK_TTL_MS = 86_400_000;
export const NPM_REGISTRY_TIMEOUT_MS = 3_000;
