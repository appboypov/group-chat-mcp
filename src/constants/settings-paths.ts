import os from 'node:os';
import path from 'node:path';

export const CLAUDE_CODE_GLOBAL = path.join(os.homedir(), '.claude', 'settings.json');
export const CURSOR_GLOBAL = path.join(os.homedir(), '.cursor', 'mcp.json');

export function CLAUDE_CODE_LOCAL(): string {
  return path.join(process.cwd(), '.mcp.json');
}

export function CURSOR_LOCAL(): string {
  return path.join(process.cwd(), '.cursor', 'mcp.json');
}
