import { describe, it, expect, beforeAll } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HookResponse } from '../types/hook-response.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOOK_PATH = path.resolve(__dirname, '../../dist/hooks/cursor-hook.js');
const TEST_TIMEOUT = 15000;

beforeAll(() => {
  execFileSync('npm', ['run', 'build'], {
    cwd: path.resolve(__dirname, '../..'),
    encoding: 'utf-8',
    timeout: 30000,
  });
});

function runHook(input: string): HookResponse {
  const result = spawnSync('node', [HOOK_PATH], {
    input,
    encoding: 'utf-8',
    timeout: 10000,
  });
  if (result.error) {
    throw result.error;
  }
  return JSON.parse(result.stdout.trim()) as HookResponse;
}

describe('cursor-hook', () => {
  describe('Given stdin JSON with hook_event_name beforeMCPExecution and server group-chat-mcp', () => {
    it('Then stdout contains permission allow', () => {
      const response = runHook(JSON.stringify({
        hook_event_name: 'beforeMCPExecution',
        server: 'group-chat-mcp',
      }));

      expect(response.permission).toBe('allow');
    }, TEST_TIMEOUT);
  });

  describe('Given stdin JSON with hook_event_name beforeMCPExecution and server some-other-mcp', () => {
    it('Then stdout contains permission ask', () => {
      const response = runHook(JSON.stringify({
        hook_event_name: 'beforeMCPExecution',
        server: 'some-other-mcp',
      }));

      expect(response.permission).toBe('ask');
    }, TEST_TIMEOUT);
  });

  describe('Given invalid JSON on stdin', () => {
    it('When the hook script runs Then it outputs permission allow', () => {
      const response = runHook('not-valid-json{{{');

      expect(response.permission).toBe('allow');
    }, TEST_TIMEOUT);
  });

  describe('Given unknown hook_event_name', () => {
    it('When the hook script runs Then it outputs permission allow', () => {
      const response = runHook(JSON.stringify({
        hook_event_name: 'unknownEvent',
      }));

      expect(response.permission).toBe('allow');
    }, TEST_TIMEOUT);
  });

  describe('Given stdin JSON with hook_event_name sessionEnd', () => {
    it('Then stdout contains permission allow', () => {
      const response = runHook(JSON.stringify({
        hook_event_name: 'sessionEnd',
      }));

      expect(response.permission).toBe('allow');
    }, TEST_TIMEOUT);
  });

  describe('Given stdin JSON with hook_event_name sessionStart and workspace_roots', () => {
    it('Then it registers an agent and stdout contains permission allow with agent_message', () => {
      const response = runHook(JSON.stringify({
        hook_event_name: 'sessionStart',
        workspace_roots: ['/tmp/test-project-hook'],
      }));

      expect(response.permission).toBe('allow');
      expect(response.agent_message).toBeDefined();
      expect(response.agent_message!.length).toBeGreaterThan(0);
    }, TEST_TIMEOUT);
  });
});
