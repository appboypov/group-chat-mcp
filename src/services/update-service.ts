import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDE } from '../enums/ide.js';
import { Scope } from '../enums/scope.js';
import { InstallMetadataService } from './install-metadata-service.js';
import { InstallerService } from './installer-service.js';
import { VersionCheckService } from './version-check-service.js';

const ideDisplayNames: Record<IDE, string> = {
  [IDE.ClaudeCode]: 'Claude Code',
  [IDE.Cursor]: 'Cursor',
};

export class UpdateService {
  private readonly versionCheck: VersionCheckService;
  private readonly installMetadata: InstallMetadataService;
  private readonly installer: InstallerService;

  constructor(
    versionCheck?: VersionCheckService,
    installMetadata?: InstallMetadataService,
    installer?: InstallerService,
  ) {
    this.versionCheck = versionCheck ?? new VersionCheckService();
    this.installMetadata = installMetadata ?? new InstallMetadataService();
    this.installer = installer ?? new InstallerService();
  }

  async performUpdate(): Promise<void> {
    const result = await this.versionCheck.checkForUpdate(true);
    if (!result) {
      throw new Error('Failed to check for updates. Please try again later.');
    }

    if (!result.updateAvailable) {
      console.log(`Already up to date (${result.current})`);
      return;
    }

    console.log(`Updating group-chat-mcp ${result.current} → ${result.latest}...`);

    try {
      execFileSync('npm', ['install', '-g', 'group-chat-mcp@latest'], { stdio: 'inherit' });
    } catch {
      throw new Error('Failed to install the latest version. Please try running: npm install -g group-chat-mcp@latest');
    }

    try {
      const gchatPath = this.resolveGchatPath();
      execFileSync(gchatPath, ['update', '--post-install'], { stdio: 'inherit' });
    } catch {
      console.error('Update installed but config refresh failed. Run `gchat install` to refresh your IDE configurations.');
    }
  }

  async performPostInstall(): Promise<void> {
    const installs = await this.installMetadata.getInstalls();
    if (installs.length === 0) {
      console.log('No install metadata found. Run `gchat install` to configure your IDE.');
      return;
    }

    for (const entry of installs) {
      const ideName = ideDisplayNames[entry.ide];
      const scopeName = entry.scope === Scope.Global ? 'global' : 'local';
      try {
        await this.installer.install({ ide: entry.ide, scope: entry.scope });
        console.log(`  ✓ Refreshed ${ideName} (${scopeName})`);
      } catch (err) {
        console.error(`  ✗ Failed to refresh ${ideName} (${scopeName}): ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const version = this.versionCheck.getLocalVersion();
    console.log(`Updated group-chat-mcp to ${version}`);
  }

  private resolveGchatPath(): string {
    try {
      return execFileSync('which', ['gchat'], { encoding: 'utf-8' }).trim();
    } catch {
      const currentFile = fileURLToPath(import.meta.url);
      return path.resolve(path.dirname(currentFile), '..', 'gchat.js');
    }
  }
}
