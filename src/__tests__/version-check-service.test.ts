import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { VersionCheckService } from '../services/version-check-service.js';
import { VERSION_CHECK_FILE } from '../constants/storage.js';

let tmpDir: string;
let service: VersionCheckService;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gchat-version-check-test-'));
  service = new VersionCheckService(tmpDir);
  vi.spyOn(VersionCheckService.prototype, 'getLocalVersion').mockReturnValue('0.1.6');
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('VersionCheckService', () => {
  describe('getLocalVersion', () => {
    it('Given the package.json exists When getLocalVersion is called Then it returns a valid semver string', () => {
      vi.restoreAllMocks();
      const svc = new VersionCheckService(tmpDir);
      const version = svc.getLocalVersion();

      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('checkForUpdate', () => {
    it('Given a fresh cache with latest "0.2.0" and local version "0.1.6" When checkForUpdate is called Then it returns updateAvailable true without hitting the registry', async () => {
      const cachePath = path.join(tmpDir, VERSION_CHECK_FILE);
      await fs.writeFile(cachePath, JSON.stringify({ latest: '0.2.0', checkedAt: Date.now() }), 'utf-8');
      const fetchSpy = vi.spyOn(service as any, 'fetchLatestVersion');

      const result = await service.checkForUpdate();

      expect(result).toEqual({
        current: '0.1.6',
        latest: '0.2.0',
        updateAvailable: true,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('Given a fresh cache with latest "0.1.6" and local version "0.1.6" When checkForUpdate is called Then it returns updateAvailable false', async () => {
      const cachePath = path.join(tmpDir, VERSION_CHECK_FILE);
      await fs.writeFile(cachePath, JSON.stringify({ latest: '0.1.6', checkedAt: Date.now() }), 'utf-8');

      const result = await service.checkForUpdate();

      expect(result).toEqual({
        current: '0.1.6',
        latest: '0.1.6',
        updateAvailable: false,
      });
    });

    it('Given an expired cache When checkForUpdate is called Then it queries the registry and writes a new cache', async () => {
      const cachePath = path.join(tmpDir, VERSION_CHECK_FILE);
      const expiredTime = Date.now() - 86_400_000 - 1;
      await fs.writeFile(cachePath, JSON.stringify({ latest: '0.1.5', checkedAt: expiredTime }), 'utf-8');
      vi.spyOn(service as any, 'fetchLatestVersion').mockResolvedValue('0.2.0');

      const result = await service.checkForUpdate();

      expect(result).toEqual({
        current: '0.1.6',
        latest: '0.2.0',
        updateAvailable: true,
      });
      const raw = await fs.readFile(cachePath, 'utf-8');
      const cached = JSON.parse(raw);
      expect(cached.latest).toBe('0.2.0');
    });

    it('Given no cache file When checkForUpdate is called Then it queries the registry and writes a new cache', async () => {
      vi.spyOn(service as any, 'fetchLatestVersion').mockResolvedValue('0.2.0');

      const result = await service.checkForUpdate();

      expect(result).toEqual({
        current: '0.1.6',
        latest: '0.2.0',
        updateAvailable: true,
      });
      const cachePath = path.join(tmpDir, VERSION_CHECK_FILE);
      const raw = await fs.readFile(cachePath, 'utf-8');
      const cached = JSON.parse(raw);
      expect(cached.latest).toBe('0.2.0');
    });

    it('Given the npm registry is unreachable and no cache exists When checkForUpdate is called Then it returns null', async () => {
      vi.spyOn(service as any, 'fetchLatestVersion').mockResolvedValue(null);

      const result = await service.checkForUpdate();

      expect(result).toBeNull();
    });

    it('Given a corrupt cache file When checkForUpdate is called Then it queries the registry', async () => {
      const cachePath = path.join(tmpDir, VERSION_CHECK_FILE);
      await fs.writeFile(cachePath, 'not-json!!!', 'utf-8');
      vi.spyOn(service as any, 'fetchLatestVersion').mockResolvedValue('0.2.0');

      const result = await service.checkForUpdate();

      expect(result).toEqual({
        current: '0.1.6',
        latest: '0.2.0',
        updateAvailable: true,
      });
    });

    it('Given getLocalVersion throws When checkForUpdate is called Then it returns null', async () => {
      vi.spyOn(VersionCheckService.prototype, 'getLocalVersion').mockImplementation(() => {
        throw new Error('cannot read package.json');
      });

      const result = await service.checkForUpdate();

      expect(result).toBeNull();
    });
  });
});
