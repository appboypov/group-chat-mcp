import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { parseCommand } from '../gchat.js';
import { UpdateService } from '../services/update-service.js';
import { VersionCheckService } from '../services/version-check-service.js';
import { InstallMetadataService } from '../services/install-metadata-service.js';
import { InstallerService } from '../services/installer-service.js';
import { IDE } from '../enums/ide.js';
import { Scope } from '../enums/scope.js';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

describe('parseCommand', () => {
  it('Given args ["update"] When parseCommand is called Then it returns { command: "update" }', () => {
    const result = parseCommand(['update']);
    expect(result).toEqual({ command: 'update' });
  });

  it('Given args ["update", "--post-install"] When parseCommand is called Then it returns { command: "update-post-install" }', () => {
    const result = parseCommand(['update', '--post-install']);
    expect(result).toEqual({ command: 'update-post-install' });
  });
});

describe('UpdateService', () => {
  let mockVersionCheck: VersionCheckService;
  let mockInstallMetadata: InstallMetadataService;
  let mockInstaller: InstallerService;
  let updateService: UpdateService;

  beforeEach(() => {
    mockVersionCheck = {
      checkForUpdate: vi.fn(),
      getLocalVersion: vi.fn().mockReturnValue('0.2.0'),
    } as unknown as VersionCheckService;

    mockInstallMetadata = {
      getInstalls: vi.fn(),
    } as unknown as InstallMetadataService;

    mockInstaller = {
      install: vi.fn(),
    } as unknown as InstallerService;

    updateService = new UpdateService(mockVersionCheck, mockInstallMetadata, mockInstaller);
  });

  describe('performUpdate', () => {
    it('Given checkForUpdate returns updateAvailable: false When performUpdate is called Then it prints "Already up to date" and does not run npm install', async () => {
      (mockVersionCheck.checkForUpdate as any).mockResolvedValue({
        current: '0.2.0', latest: '0.2.0', updateAvailable: false,
      });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await updateService.performUpdate();
      expect(logSpy).toHaveBeenCalledWith('Already up to date (0.2.0)');
      logSpy.mockRestore();
    });

    it('Given checkForUpdate returns updateAvailable: true When performUpdate is called Then it runs npm install and re-execs gchat', async () => {
      (mockVersionCheck.checkForUpdate as any).mockResolvedValue({
        current: '0.1.6', latest: '0.2.0', updateAvailable: true,
      });
      const mockedExecFileSync = vi.mocked(execFileSync);
      mockedExecFileSync.mockImplementation((file, args) => {
        if (file === 'which') return '/usr/local/bin/gchat' as any;
        return '' as any;
      });
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await updateService.performUpdate();

      expect(logSpy).toHaveBeenCalledWith('Updating group-chat-mcp 0.1.6 → 0.2.0...');
      expect(mockedExecFileSync).toHaveBeenCalledWith('npm', ['install', '-g', 'group-chat-mcp@latest'], { stdio: 'inherit' });
      expect(mockedExecFileSync).toHaveBeenCalledWith('/usr/local/bin/gchat', ['update', '--post-install'], { stdio: 'inherit' });

      logSpy.mockRestore();
    });

    it('Given checkForUpdate returns null When performUpdate is called Then it throws an error', async () => {
      (mockVersionCheck.checkForUpdate as any).mockResolvedValue(null);
      await expect(updateService.performUpdate()).rejects.toThrow('Failed to check for updates. Please try again later.');
    });
  });

  describe('performPostInstall', () => {
    it('Given install metadata has entries When performPostInstall is called Then it calls InstallerService.install for each entry', async () => {
      (mockInstallMetadata.getInstalls as any).mockResolvedValue([
        { ide: IDE.ClaudeCode, scope: Scope.Global },
        { ide: IDE.Cursor, scope: Scope.Local },
      ]);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await updateService.performPostInstall();
      expect(mockInstaller.install).toHaveBeenCalledTimes(2);
      expect(mockInstaller.install).toHaveBeenCalledWith({ ide: IDE.ClaudeCode, scope: Scope.Global });
      expect(mockInstaller.install).toHaveBeenCalledWith({ ide: IDE.Cursor, scope: Scope.Local });
      logSpy.mockRestore();
    });

    it('Given install metadata is empty When performPostInstall is called Then it prints "No install metadata found" and does not call InstallerService.install', async () => {
      (mockInstallMetadata.getInstalls as any).mockResolvedValue([]);
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await updateService.performPostInstall();
      expect(logSpy).toHaveBeenCalledWith('No install metadata found. Run `gchat install` to configure your IDE.');
      expect(mockInstaller.install).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });
});
