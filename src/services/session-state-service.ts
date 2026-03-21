import fs from 'node:fs/promises';
import path from 'node:path';
import { BASE_DIR, SESSIONS_DIR } from '../constants/storage.js';
import type { SessionState } from '../types/session-state.js';
import { readJsonFile, writeJsonFile } from '../utils/file-utils.js';
import { isProcessAlive } from '../utils/file-lock.js';

export class SessionStateService {
  private readonly storagePath: string;
  private cache: Map<number, { agentId: string; projectPath: string }> = new Map();

  constructor(storagePath: string = BASE_DIR) {
    this.storagePath = storagePath;
  }

  private sessionsDir(): string {
    return path.join(this.storagePath, SESSIONS_DIR);
  }

  private sessionPath(pid: number): string {
    return path.join(this.sessionsDir(), `${pid}.json`);
  }

  private async ensureSessionsDir(): Promise<void> {
    await fs.mkdir(this.sessionsDir(), { recursive: true });
  }

  async writeSessionAgent(pid: number, agentId: string, projectPath: string): Promise<void> {
    if (pid <= 0) throw new Error('PID must be positive');
    await this.ensureSessionsDir();
    const state: SessionState = {
      pid,
      agentId,
      projectPath,
      updatedAt: Date.now(),
    };
    await writeJsonFile(this.sessionPath(pid), state);
    this.cache.set(pid, { agentId, projectPath });
  }

  async readSessionAgent(pid: number): Promise<{ agentId: string; projectPath: string } | null> {
    if (pid <= 0) throw new Error('PID must be positive');
    const cached = this.cache.get(pid);
    if (cached) return cached;
    const state = await readJsonFile<SessionState>(this.sessionPath(pid));
    if (!state) return null;
    const result = { agentId: state.agentId, projectPath: state.projectPath };
    this.cache.set(pid, result);
    return result;
  }

  async clearSessionAgent(pid: number): Promise<void> {
    if (pid <= 0) throw new Error('PID must be positive');
    this.cache.delete(pid);
    try {
      await fs.unlink(this.sessionPath(pid));
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async reapStaleSessions(): Promise<string[]> {
    await this.ensureSessionsDir();
    const reaped: string[] = [];

    let entries: string[];
    try {
      entries = await fs.readdir(this.sessionsDir());
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return reaped;
      }
      throw err;
    }

    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const pidStr = entry.replace('.json', '');
      const pid = Number(pidStr);
      if (Number.isNaN(pid)) continue;

      if (!isProcessAlive(pid)) {
        this.cache.delete(pid);
        try {
          await fs.unlink(path.join(this.sessionsDir(), entry));
        } catch (err: unknown) {
          if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw err;
          }
        }
        reaped.push(pidStr);
      }
    }

    return reaped;
  }
}
