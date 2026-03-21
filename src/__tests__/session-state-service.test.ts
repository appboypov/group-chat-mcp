import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SessionStateService } from '../services/session-state-service.js';

let tmpDir: string;
let service: SessionStateService;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gchat-session-test-'));
  service = new SessionStateService(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('SessionStateService', () => {
  describe('Given empty sessions directory', () => {
    it('When writeSessionAgent(1234, "abc", "/project") is called Then sessions/1234.json contains the correct data', async () => {
      await service.writeSessionAgent(1234, 'abc', '/project');

      const filePath = path.join(tmpDir, 'sessions', '1234.json');
      const raw = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(raw);

      expect(data.pid).toBe(1234);
      expect(data.agentId).toBe('abc');
      expect(data.projectPath).toBe('/project');
      expect(data.updatedAt).toBeTypeOf('number');
    });
  });

  describe('Given session file for PID 1234', () => {
    it('When readSessionAgent(1234) is called Then it returns { agentId, projectPath }', async () => {
      await service.writeSessionAgent(1234, 'abc', '/project');

      const result = await service.readSessionAgent(1234);

      expect(result).toEqual({ agentId: 'abc', projectPath: '/project' });
    });
  });

  describe('Given no session file for PID 9999', () => {
    it('When readSessionAgent(9999) is called Then it returns null', async () => {
      const result = await service.readSessionAgent(9999);

      expect(result).toBeNull();
    });
  });

  describe('Given session file for PID 1234', () => {
    it('When clearSessionAgent(1234) is called Then the file no longer exists', async () => {
      await service.writeSessionAgent(1234, 'abc', '/project');

      await service.clearSessionAgent(1234);

      const filePath = path.join(tmpDir, 'sessions', '1234.json');
      await expect(fs.access(filePath)).rejects.toThrow();
    });
  });

  describe('Given session files for dead and alive PIDs', () => {
    it('When reapStaleSessions() is called Then dead PID files are deleted and alive PID files remain', async () => {
      const alivePid = process.pid;
      const deadPid = 99999999;

      await service.writeSessionAgent(alivePid, 'alive-agent', '/alive-project');
      await service.writeSessionAgent(deadPid, 'dead-agent', '/dead-project');

      const reaped = await service.reapStaleSessions();

      expect(reaped).toContain(String(deadPid));
      expect(reaped).not.toContain(String(alivePid));

      const aliveFilePath = path.join(tmpDir, 'sessions', `${alivePid}.json`);
      await expect(fs.access(aliveFilePath)).resolves.toBeUndefined();

      const deadFilePath = path.join(tmpDir, 'sessions', `${deadPid}.json`);
      await expect(fs.access(deadFilePath)).rejects.toThrow();
    });
  });
});
