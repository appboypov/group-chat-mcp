import fs from 'node:fs/promises';
import path from 'node:path';
import { BASE_DIR, INSTALL_META_FILE } from '../constants/storage.js';
import { IDE } from '../enums/ide.js';
import { Scope } from '../enums/scope.js';

interface InstallEntry {
  ide: string;
  scope: string;
}

export class InstallMetadataService {
  private readonly metadataPath: string;

  constructor(basePath: string = BASE_DIR) {
    this.metadataPath = path.join(basePath, INSTALL_META_FILE);
  }

  async addInstall(ide: IDE, scope: Scope): Promise<void> {
    const entries = await this.readEntries();
    const exists = entries.some((e) => e.ide === ide && e.scope === scope);
    if (exists) return;
    entries.push({ ide, scope });
    await this.writeEntries(entries);
  }

  async removeInstall(ide: IDE, scope: Scope): Promise<void> {
    const entries = await this.readEntries();
    const filtered = entries.filter((e) => !(e.ide === ide && e.scope === scope));
    if (filtered.length === entries.length) return;
    if (filtered.length === 0) {
      await fs.unlink(this.metadataPath).catch(() => {});
      return;
    }
    await this.writeEntries(filtered);
  }

  async getInstalls(): Promise<Array<{ ide: IDE; scope: Scope }>> {
    const entries = await this.readEntries();
    const validIdes = Object.values(IDE) as string[];
    const validScopes = Object.values(Scope) as string[];
    return entries
      .filter((e) => validIdes.includes(e.ide) && validScopes.includes(e.scope))
      .map((e) => ({ ide: e.ide as IDE, scope: e.scope as Scope }));
  }

  private async readEntries(): Promise<InstallEntry[]> {
    try {
      const raw = await fs.readFile(this.metadataPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (e: unknown): e is InstallEntry =>
          typeof e === 'object' && e !== null &&
          typeof (e as Record<string, unknown>).ide === 'string' &&
          typeof (e as Record<string, unknown>).scope === 'string',
      );
    } catch {
      return [];
    }
  }

  private async writeEntries(entries: InstallEntry[]): Promise<void> {
    await fs.mkdir(path.dirname(this.metadataPath), { recursive: true });
    const tmpPath = this.metadataPath + '.tmp';
    await fs.writeFile(tmpPath, JSON.stringify(entries, null, 2), 'utf-8');
    await fs.rename(tmpPath, this.metadataPath);
  }
}
