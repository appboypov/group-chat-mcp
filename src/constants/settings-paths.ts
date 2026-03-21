import os from 'node:os';
import path from 'node:path';

export const CURSOR_GLOBAL = path.join(os.homedir(), '.cursor', 'mcp.json');

export function CURSOR_LOCAL(): string {
  return path.join(process.cwd(), '.cursor', 'mcp.json');
}
