import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { readJsonFile, writeJsonFile } from '../../src/utils/file-utils.js';

describe('FileUtils', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(os.tmpdir(), `file-utils-test-${uuidv4()}`);
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('Given a file does not exist When readJsonFile is called Then null is returned', async () => {
    const filePath = path.join(tempDir, 'nonexistent.json');

    const result = await readJsonFile(filePath);

    expect(result).toBeNull();
  });

  it('Given data When writeJsonFile is called Then the file contains the JSON and no .tmp file remains', async () => {
    const filePath = path.join(tempDir, 'data.json');
    const data = { key: 'value', nested: { a: 1 } };

    await writeJsonFile(filePath, data);

    const written = await readJsonFile(filePath);
    expect(written).toEqual(data);

    const tmpExists = await fs.access(filePath + '.tmp').then(() => true).catch(() => false);
    expect(tmpExists).toBe(false);
  });

  it('Given an existing file When writeJsonFile is called with new data Then the file contains only the new data', async () => {
    const filePath = path.join(tempDir, 'overwrite.json');
    const oldData = { old: 'data' };
    const newData = { new: 'data' };

    await writeJsonFile(filePath, oldData);
    await writeJsonFile(filePath, newData);

    const result = await readJsonFile(filePath);
    expect(result).toEqual(newData);
  });
});
