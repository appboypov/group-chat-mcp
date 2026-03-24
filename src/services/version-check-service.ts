import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASE_DIR,
  VERSION_CHECK_FILE,
  VERSION_CHECK_TTL_MS,
  NPM_REGISTRY_TIMEOUT_MS,
} from '../constants/storage.js';
import { VersionCheckResult } from '../types/version-check-result.js';

interface VersionCheckCache {
  latest: string;
  checkedAt: number;
}

export class VersionCheckService {
  private readonly cachePath: string;

  constructor(basePath: string = BASE_DIR) {
    this.cachePath = path.join(basePath, VERSION_CHECK_FILE);
  }

  getLocalVersion(): string {
    const currentFile = fileURLToPath(import.meta.url);
    const packageJsonPath = path.resolve(path.dirname(currentFile), '..', '..', 'package.json');
    const raw = readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(raw);
    return pkg.version;
  }

  async checkForUpdate(forceRefresh = false): Promise<VersionCheckResult | null> {
    try {
      const current = this.getLocalVersion();
      const cached = forceRefresh ? null : await this.readCache();
      if (cached) {
        return {
          current,
          latest: cached.latest,
          updateAvailable: this.semverGt(cached.latest, current),
        };
      }

      const latest = await this.fetchLatestVersion();
      if (!latest) return null;

      await this.writeCache(latest);
      return {
        current,
        latest,
        updateAvailable: this.semverGt(latest, current),
      };
    } catch {
      return null;
    }
  }

  private semverGt(a: string, b: string): boolean {
    const parse = (v: string): [number, number, number] => {
      const parts = v.split('.').map(Number);
      return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
    };
    const [aMajor, aMinor, aPatch] = parse(a);
    const [bMajor, bMinor, bPatch] = parse(b);
    if (aMajor !== bMajor) return aMajor > bMajor;
    if (aMinor !== bMinor) return aMinor > bMinor;
    return aPatch > bPatch;
  }

  private async fetchLatestVersion(): Promise<string | null> {
    return new Promise((resolve) => {
      const req = https.get(
        'https://registry.npmjs.org/group-chat-mcp/latest',
        { timeout: NPM_REGISTRY_TIMEOUT_MS },
        (res) => {
          let data = '';
          res.on('data', (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(typeof parsed.version === 'string' ? parsed.version : null);
            } catch {
              resolve(null);
            }
          });
        },
      );
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  private async readCache(): Promise<VersionCheckCache | null> {
    try {
      const raw = await fs.readFile(this.cachePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (
        typeof parsed.latest !== 'string' ||
        typeof parsed.checkedAt !== 'number'
      ) {
        return null;
      }
      if (Date.now() - parsed.checkedAt > VERSION_CHECK_TTL_MS) {
        return null;
      }
      return parsed as VersionCheckCache;
    } catch {
      return null;
    }
  }

  private async writeCache(latest: string): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.cachePath), { recursive: true });
      const data: VersionCheckCache = { latest, checkedAt: Date.now() };
      const tmpPath = this.cachePath + '.tmp';
      await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
      await fs.rename(tmpPath, this.cachePath);
    } catch { }
  }
}
