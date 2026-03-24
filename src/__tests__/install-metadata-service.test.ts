import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { InstallMetadataService } from '../services/install-metadata-service.js';
import { IDE } from '../enums/ide.js';
import { Scope } from '../enums/scope.js';

let tmpDir: string;
let service: InstallMetadataService;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gchat-meta-test-'));
  service = new InstallMetadataService(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('InstallMetadataService', () => {
  describe('addInstall', () => {
    it('Given no metadata file exists When addInstall is called with (ClaudeCode, Global) Then the file is created with one entry', async () => {
      await service.addInstall(IDE.ClaudeCode, Scope.Global);

      const raw = await fs.readFile(path.join(tmpDir, 'install-meta.json'), 'utf-8');
      const entries = JSON.parse(raw);

      expect(entries).toEqual([{ ide: 'claudeCode', scope: 'global' }]);
    });

    it('Given a metadata file with (ClaudeCode, Global) When addInstall is called with (Cursor, Local) Then the file contains both entries', async () => {
      await service.addInstall(IDE.ClaudeCode, Scope.Global);
      await service.addInstall(IDE.Cursor, Scope.Local);

      const raw = await fs.readFile(path.join(tmpDir, 'install-meta.json'), 'utf-8');
      const entries = JSON.parse(raw);

      expect(entries).toEqual([
        { ide: 'claudeCode', scope: 'global' },
        { ide: 'cursor', scope: 'local' },
      ]);
    });

    it('Given a metadata file with (ClaudeCode, Global) When addInstall is called with (ClaudeCode, Global) again Then the file still contains one entry', async () => {
      await service.addInstall(IDE.ClaudeCode, Scope.Global);
      await service.addInstall(IDE.ClaudeCode, Scope.Global);

      const raw = await fs.readFile(path.join(tmpDir, 'install-meta.json'), 'utf-8');
      const entries = JSON.parse(raw);

      expect(entries).toEqual([{ ide: 'claudeCode', scope: 'global' }]);
    });
  });

  describe('removeInstall', () => {
    it('Given a metadata file with one entry When removeInstall is called for that entry Then the file is deleted', async () => {
      await service.addInstall(IDE.ClaudeCode, Scope.Global);
      await service.removeInstall(IDE.ClaudeCode, Scope.Global);

      const exists = await fs.access(path.join(tmpDir, 'install-meta.json')).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    });

    it('Given a metadata file with two entries When removeInstall is called for one Then the file contains the other entry', async () => {
      await service.addInstall(IDE.ClaudeCode, Scope.Global);
      await service.addInstall(IDE.Cursor, Scope.Local);
      await service.removeInstall(IDE.ClaudeCode, Scope.Global);

      const raw = await fs.readFile(path.join(tmpDir, 'install-meta.json'), 'utf-8');
      const entries = JSON.parse(raw);

      expect(entries).toEqual([{ ide: 'cursor', scope: 'local' }]);
    });

    it('Given no metadata file exists When removeInstall is called Then no error is thrown', async () => {
      await expect(service.removeInstall(IDE.ClaudeCode, Scope.Global)).resolves.toBeUndefined();
    });
  });

  describe('getInstalls', () => {
    it('Given no metadata file exists When getInstalls is called Then an empty array is returned', async () => {
      const installs = await service.getInstalls();
      expect(installs).toEqual([]);
    });

    it('Given a metadata file with malformed entries When getInstalls is called Then only valid entries are returned', async () => {
      const metadataPath = path.join(tmpDir, 'install-meta.json');
      await fs.writeFile(metadataPath, JSON.stringify([42, null, { ide: 123 }, { ide: 'claudeCode', scope: 'global' }]), 'utf-8');

      const result = await service.getInstalls();
      expect(result).toEqual([{ ide: 'claudeCode', scope: 'global' }]);
    });

    it('Given a corrupt metadata file When getInstalls is called Then an empty array is returned', async () => {
      await fs.writeFile(path.join(tmpDir, 'install-meta.json'), '{not valid json!!!', 'utf-8');

      const installs = await service.getInstalls();
      expect(installs).toEqual([]);
    });
  });
});
