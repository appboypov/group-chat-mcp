import path from 'node:path';
import fs from 'node:fs/promises';

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_STALE_LOCK_AGE_MS = 10_000;
const RETRY_INTERVAL_MS = 50;
const LOCK_INFO_FILENAME = 'lock.info';

interface LockInfo {
  pid: number;
  timestamp: number;
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readLockInfo(lockPath: string): Promise<LockInfo | null> {
  try {
    const content = await fs.readFile(path.join(lockPath, LOCK_INFO_FILENAME), 'utf-8');
    const parsed = JSON.parse(content) as LockInfo;
    if (typeof parsed.pid === 'number' && typeof parsed.timestamp === 'number') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeLockInfo(lockPath: string): Promise<void> {
  const info: LockInfo = { pid: process.pid, timestamp: Date.now() };
  await fs.writeFile(path.join(lockPath, LOCK_INFO_FILENAME), JSON.stringify(info), 'utf-8');
}

async function forceRemoveLock(lockPath: string): Promise<void> {
  try {
    await fs.unlink(path.join(lockPath, LOCK_INFO_FILENAME));
  } catch {
    // lock.info may not exist.
  }
  try {
    await fs.rmdir(lockPath);
  } catch {
    // Lock directory may already be removed.
  }
}

async function tryBreakStaleLock(lockPath: string, staleLockAgeMs: number): Promise<boolean> {
  const info = await readLockInfo(lockPath);
  if (info === null) {
    const stat = await fs.stat(lockPath).catch(() => null);
    if (stat && Date.now() - stat.mtimeMs > staleLockAgeMs) {
      await forceRemoveLock(lockPath);
      return true;
    }
    return false;
  }

  const isStaleByAge = Date.now() - info.timestamp > staleLockAgeMs;
  const isOwnerDead = !isProcessAlive(info.pid);

  if (isStaleByAge || isOwnerDead) {
    await forceRemoveLock(lockPath);
    return true;
  }

  return false;
}

async function acquireLock(
  filePath: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  staleLockAgeMs: number = DEFAULT_STALE_LOCK_AGE_MS,
): Promise<void> {
  const lockPath = `${filePath}.lock`;
  const deadline = Date.now() + timeoutMs;

  while (true) {
    try {
      await fs.mkdir(lockPath);
      await writeLockInfo(lockPath);
      return;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw err;
      }

      const staleBroken = await tryBreakStaleLock(lockPath, staleLockAgeMs);
      if (staleBroken) {
        continue;
      }

      if (Date.now() >= deadline) {
        throw new Error(`Timed out acquiring lock for ${filePath}`);
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS));
    }
  }
}

async function releaseLock(filePath: string): Promise<void> {
  const lockPath = `${filePath}.lock`;
  await forceRemoveLock(lockPath);
}

export async function withFileLock<T>(
  filePath: string,
  fn: () => Promise<T>,
  timeoutMs?: number,
): Promise<T> {
  await acquireLock(filePath, timeoutMs);
  try {
    return await fn();
  } finally {
    await releaseLock(filePath);
  }
}
