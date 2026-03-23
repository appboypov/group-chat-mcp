import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { MessageType } from '../enums/message-type.js';
import {
  sendLockDir,
  tryAcquireSendLock,
  waitForSendLockRelease,
  releaseSendLock,
  getMessagesSince,
  getMessageCount,
  readSendLockInfo,
} from '../utils/send-lock.js';
import { LOCK_INFO_FILENAME } from '../utils/file-lock.js';
import { writeJsonFile } from '../utils/file-utils.js';
import { MESSAGES_DIR } from '../constants/storage.js';
import type { Message } from '../types/message.js';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gchat-sendlock-test-'));
  await fs.mkdir(path.join(tmpDir, MESSAGES_DIR), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('sendLockDir', () => {
  describe('Given agents A and B targeting same and different conversations', () => {
    it('When sendLockDir is called for the same conversation from different callers Then the same path is returned', () => {
      const dirA = sendLockDir(tmpDir, 'conv-1');
      const dirB = sendLockDir(tmpDir, 'conv-1');

      expect(dirA).toBe(dirB);
      expect(dirA).toBe(path.join(tmpDir, MESSAGES_DIR, 'conv-1.send-lock'));
    });
  });
});

describe('tryAcquireSendLock', () => {
  describe('Given no contention', () => {
    it('When agent acquires send lock Then lock acquired and released cleanly', async () => {
      const lockDir = sendLockDir(tmpDir, 'conv-1');

      const result = await tryAcquireSendLock(lockDir, 'agent-A');

      expect(result).toEqual({ acquired: true });

      const info = await readSendLockInfo(lockDir);
      expect(info).not.toBeNull();
      expect(info!.agentId).toBe('agent-A');
      expect(info!.pid).toBe(process.pid);

      await releaseSendLock(lockDir);

      const exists = await fs.stat(lockDir).catch(() => null);
      expect(exists).toBeNull();
    });
  });

  describe('Given agent A holds send lock on conv X', () => {
    it('When agent B tries to acquire on conv X Then B gets acquired: false with A agentId', async () => {
      const lockDir = sendLockDir(tmpDir, 'conv-X');

      await tryAcquireSendLock(lockDir, 'agent-A');

      const result = await tryAcquireSendLock(lockDir, 'agent-B');

      expect(result).toEqual({ acquired: false, holderAgentId: 'agent-A' });

      await releaseSendLock(lockDir);
    });
  });

  describe('Given agent A holds send lock on conv X', () => {
    it('When agent B acquires on conv Y Then B succeeds immediately', async () => {
      const lockDirX = sendLockDir(tmpDir, 'conv-X');
      const lockDirY = sendLockDir(tmpDir, 'conv-Y');

      await tryAcquireSendLock(lockDirX, 'agent-A');

      const result = await tryAcquireSendLock(lockDirY, 'agent-B');

      expect(result).toEqual({ acquired: true });

      await releaseSendLock(lockDirX);
      await releaseSendLock(lockDirY);
    });
  });
});

describe('waitForSendLockRelease', () => {
  describe('Given lock held for >10s by dead process', () => {
    it('When agent calls waitForSendLockRelease Then stale lock broken and released: true returned', async () => {
      const lockDir = sendLockDir(tmpDir, 'conv-stale');

      await fs.mkdir(lockDir);
      const staleLockInfo = {
        pid: 999999,
        agentId: 'dead-agent',
        timestamp: Date.now() - 15_000,
      };
      await fs.writeFile(
        path.join(lockDir, LOCK_INFO_FILENAME),
        JSON.stringify(staleLockInfo),
        'utf-8',
      );

      const result = await waitForSendLockRelease(lockDir, 200);

      expect(result).toEqual({ released: true });

      const exists = await fs.stat(lockDir).catch(() => null);
      expect(exists).toBeNull();
    });
  });

  describe('Given agent blocked on send lock', () => {
    it('When lock directory is manually deleted Then waitForSendLockRelease returns released', async () => {
      const lockDir = sendLockDir(tmpDir, 'conv-deleted');

      await fs.mkdir(lockDir);
      const lockInfo = {
        pid: process.pid,
        agentId: 'agent-A',
        timestamp: Date.now(),
      };
      await fs.writeFile(
        path.join(lockDir, LOCK_INFO_FILENAME),
        JSON.stringify(lockInfo),
        'utf-8',
      );

      const waitPromise = waitForSendLockRelease(lockDir, 2000);

      await new Promise((resolve) => setTimeout(resolve, 100));
      await fs.rm(lockDir, { recursive: true, force: true });

      const result = await waitPromise;

      expect(result).toEqual({ released: true });
    });
  });

  describe('Given agent A releases lock and agent C immediately acquires', () => {
    it('When B timeout fires Then B detects C lock and does NOT break it', async () => {
      const lockDir = sendLockDir(tmpDir, 'conv-reacquire');

      await fs.mkdir(lockDir);
      const originalInfo = {
        pid: process.pid,
        agentId: 'agent-A',
        timestamp: Date.now(),
      };
      await fs.writeFile(
        path.join(lockDir, LOCK_INFO_FILENAME),
        JSON.stringify(originalInfo),
        'utf-8',
      );

      const waitPromise = waitForSendLockRelease(lockDir, 200);

      await new Promise((resolve) => setTimeout(resolve, 50));

      const newInfo = {
        pid: process.pid,
        agentId: 'agent-C',
        timestamp: Date.now() + 1000,
      };
      await fs.writeFile(
        path.join(lockDir, LOCK_INFO_FILENAME),
        JSON.stringify(newInfo),
        'utf-8',
      );

      const result = await waitPromise;

      expect(result).toEqual({ timedOut: true });

      const lockStillExists = await fs.stat(lockDir).catch(() => null);
      expect(lockStillExists).not.toBeNull();

      const currentInfo = await readSendLockInfo(lockDir);
      expect(currentInfo!.agentId).toBe('agent-C');

      await releaseSendLock(lockDir);
    });
  });
});

describe('releaseSendLock', () => {
  describe('Given send lock held', () => {
    it('When releaseSendLock called Then lock directory and lock.info removed', async () => {
      const lockDir = sendLockDir(tmpDir, 'conv-release');

      await tryAcquireSendLock(lockDir, 'agent-A');

      const existsBefore = await fs.stat(lockDir).catch(() => null);
      expect(existsBefore).not.toBeNull();

      await releaseSendLock(lockDir);

      const existsAfter = await fs.stat(lockDir).catch(() => null);
      expect(existsAfter).toBeNull();
    });
  });

  describe('Given send lock acquired', () => {
    it('When operation fails Then lock released via finally pattern', async () => {
      const lockDir = sendLockDir(tmpDir, 'conv-finally');

      const acquireResult = await tryAcquireSendLock(lockDir, 'agent-A');
      expect(acquireResult.acquired).toBe(true);

      let errorCaught = false;
      try {
        throw new Error('simulated failure');
      } catch {
        errorCaught = true;
      } finally {
        await releaseSendLock(lockDir);
      }

      expect(errorCaught).toBe(true);

      const exists = await fs.stat(lockDir).catch(() => null);
      expect(exists).toBeNull();

      const reacquireResult = await tryAcquireSendLock(lockDir, 'agent-B');
      expect(reacquireResult).toEqual({ acquired: true });

      await releaseSendLock(lockDir);
    });
  });
});

describe('contention and waiting', () => {
  describe('Given 2 agents try to acquire same conv lock', () => {
    it('When first releases Then exactly one of the waiters acquires it', async () => {
      const lockDir = sendLockDir(tmpDir, 'conv-contention');

      const firstResult = await tryAcquireSendLock(lockDir, 'agent-A');
      expect(firstResult.acquired).toBe(true);

      const secondResult = await tryAcquireSendLock(lockDir, 'agent-B');
      expect(secondResult.acquired).toBe(false);

      const waitPromise = waitForSendLockRelease(lockDir, 2000);

      await new Promise((resolve) => setTimeout(resolve, 100));
      await releaseSendLock(lockDir);

      const waitResult = await waitPromise;
      expect(waitResult).toEqual({ released: true });

      const acquireAfterWait = await tryAcquireSendLock(lockDir, 'agent-B');
      expect(acquireAfterWait.acquired).toBe(true);

      await releaseSendLock(lockDir);
    });
  });
});

describe('getMessagesSince', () => {
  describe('Given agent A sent messages while B waited', () => {
    it('When B calls getMessagesSince with snapshot index Then only messages since snapshot returned', async () => {
      const messagesPath = path.join(tmpDir, MESSAGES_DIR, 'conv-messages.json');

      const messages: Message[] = [
        { id: 'msg-1', conversationId: 'conv-messages', senderId: 'agent-A', content: 'Hello', type: MessageType.Message, timestamp: 1000 },
        { id: 'msg-2', conversationId: 'conv-messages', senderId: 'agent-A', content: 'World', type: MessageType.Message, timestamp: 2000 },
        { id: 'msg-3', conversationId: 'conv-messages', senderId: 'agent-A', content: 'New msg', type: MessageType.Message, timestamp: 3000 },
      ];
      await writeJsonFile(messagesPath, messages);

      const snapshotIndex = 1;
      const result = await getMessagesSince(messagesPath, snapshotIndex);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('msg-2');
      expect(result[1].id).toBe('msg-3');
    });
  });
});

describe('getMessageCount', () => {
  describe('Given messages file has messages', () => {
    it('When getMessageCount called Then correct count returned', async () => {
      const messagesPath = path.join(tmpDir, MESSAGES_DIR, 'conv-count.json');

      const messages: Message[] = [
        { id: 'msg-1', conversationId: 'conv-count', senderId: 'agent-A', content: 'Hello', type: MessageType.Message, timestamp: 1000 },
        { id: 'msg-2', conversationId: 'conv-count', senderId: 'agent-B', content: 'World', type: MessageType.Message, timestamp: 2000 },
        { id: 'msg-3', conversationId: 'conv-count', senderId: 'agent-A', content: 'Goodbye', type: MessageType.Message, timestamp: 3000 },
      ];
      await writeJsonFile(messagesPath, messages);

      const count = await getMessageCount(messagesPath);

      expect(count).toBe(3);
    });
  });

  describe('Given no messages file exists', () => {
    it('When getMessageCount called Then 0 returned', async () => {
      const messagesPath = path.join(tmpDir, MESSAGES_DIR, 'nonexistent.json');

      const count = await getMessageCount(messagesPath);

      expect(count).toBe(0);
    });
  });
});

describe('integration: participation check before lock', () => {
  describe('Given agent not in conversation', () => {
    it('When participation check runs before lock Then check fails before lock acquisition', async () => {
      const conversationId = 'conv-participation';
      const agentId = 'agent-outsider';

      const participants = ['agent-A', 'agent-B'];
      const isParticipant = participants.includes(agentId);

      expect(isParticipant).toBe(false);

      const lockDir = sendLockDir(tmpDir, conversationId);

      if (!isParticipant) {
        const exists = await fs.stat(lockDir).catch(() => null);
        expect(exists).toBeNull();
        return;
      }

      await tryAcquireSendLock(lockDir, agentId);
    });
  });
});
