import path from 'node:path';
import fs from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { MESSAGES_DIR } from '../constants/storage.js';
import { readJsonFile } from './file-utils.js';
import type { Message } from '../types/message.js';
import { LOCK_INFO_FILENAME, isProcessAlive, forceRemoveLock } from './file-lock.js';

interface SendLockInfo {
  pid: number;
  agentId: string;
  timestamp: number;
}

export function sendLockDir(baseDir: string, conversationId: string): string {
  return path.join(baseDir, MESSAGES_DIR, `${conversationId}.send-lock`);
}

export async function readSendLockInfo(lockDir: string): Promise<SendLockInfo | null> {
  try {
    const content = await fs.readFile(path.join(lockDir, LOCK_INFO_FILENAME), 'utf-8');
    const parsed = JSON.parse(content) as SendLockInfo;
    if (
      typeof parsed.pid === 'number' &&
      typeof parsed.agentId === 'string' &&
      typeof parsed.timestamp === 'number'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export async function tryAcquireSendLock(
  lockDir: string,
  agentId: string,
): Promise<{ acquired: true } | { acquired: false; holderAgentId: string }> {
  try {
    await fs.mkdir(lockDir);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
      const info = await readSendLockInfo(lockDir);
      const holderAgentId = info?.agentId ?? 'unknown';
      console.error(`Send lock contention detected (holder: ${holderAgentId})`);
      return { acquired: false, holderAgentId };
    }
    throw err;
  }

  const info: SendLockInfo = { pid: process.pid, agentId, timestamp: Date.now() };
  await fs.writeFile(path.join(lockDir, LOCK_INFO_FILENAME), JSON.stringify(info), 'utf-8');
  console.error('Send lock acquired for conversation');
  return { acquired: true };
}

export async function waitForSendLockRelease(
  lockDir: string,
  timeoutMs: number = 10_000,
): Promise<{ released: true } | { timedOut: true }> {
  const originalInfo = await readSendLockInfo(lockDir);
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const exists = await fs.stat(lockDir).catch(() => null);
    if (!exists) {
      console.error('Send lock released by holder');
      return { released: true };
    }

    const jitter = 50 + Math.floor(Math.random() * 101);
    await setTimeout(jitter);
  }

  const currentInfo = await readSendLockInfo(lockDir);

  if (currentInfo && originalInfo) {
    const isReacquired =
      currentInfo.pid !== originalInfo.pid ||
      currentInfo.agentId !== originalInfo.agentId ||
      currentInfo.timestamp !== originalInfo.timestamp;

    if (isReacquired) {
      console.error('Send lock timeout reached');
      return { timedOut: true };
    }
  } else if (currentInfo && !originalInfo) {
    const freshThresholdMs = 5000;
    if (Date.now() - currentInfo.timestamp < freshThresholdMs) {
      console.error('Send lock timeout reached');
      return { timedOut: true };
    }
  }

  if (currentInfo) {
    const holderDead = !isProcessAlive(currentInfo.pid);
    if (holderDead) {
      console.error('Stale send lock broken (holder process dead)');
    } else {
      console.error('Send lock broken (timeout exceeded)');
    }
    await forceRemoveLock(lockDir);
    return { released: true };
  }

  console.error('Send lock released by holder');
  return { released: true };
}

export async function getMessagesSince(
  messagesPath: string,
  sinceIndex: number,
): Promise<Message[]> {
  const messages = await readJsonFile<Message[]>(messagesPath);
  if (!messages || messages.length <= sinceIndex) {
    return [];
  }
  return messages.slice(sinceIndex);
}

export async function getMessageCount(messagesPath: string): Promise<number> {
  const messages = await readJsonFile<Message[]>(messagesPath);
  return messages?.length ?? 0;
}

export async function releaseSendLock(lockDir: string): Promise<void> {
  try {
    await fs.unlink(path.join(lockDir, LOCK_INFO_FILENAME));
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }
  try {
    await fs.rmdir(lockDir);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err;
    }
  }
  console.error('Send lock released');
}
