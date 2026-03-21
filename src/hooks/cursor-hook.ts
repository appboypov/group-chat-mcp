#!/usr/bin/env node
import { handleCursorJoin, handleCursorLeave } from '../gchat.js';
import { SessionStateService } from '../services/session-state-service.js';
import { StateService } from '../services/state-service.js';
import type { HookInput } from '../types/hook-input.js';
import type { HookResponse } from '../types/hook-response.js';

const STDIN_TIMEOUT_MS = 5000;

function writeResponse(response: HookResponse): void {
  process.stdout.write(JSON.stringify(response) + '\n');
}

function readStdin(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];

    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      process.stdin.off('data', onData);
      process.stdin.off('end', onEnd);
      process.stdin.off('error', onError);
    };

    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks).toString('utf-8'));
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('stdin read timed out'));
    }, STDIN_TIMEOUT_MS);

    (timeout as NodeJS.Timeout).unref?.();

    process.stdin.on('data', onData);
    process.stdin.on('end', onEnd);
    process.stdin.on('error', onError);
  });
}

async function handleSessionStart(input: HookInput): Promise<void> {
  const projectPath = input.workspace_roots?.[0];
  if (!projectPath) {
    writeResponse({ permission: 'allow', agent_message: 'No workspace root provided.' });
    return;
  }

  const serverPid = process.ppid;
  const stateService = new StateService();
  await stateService.init();
  const sessionStateService = new SessionStateService();

  const result = await handleCursorJoin(projectPath, serverPid, { stateService, sessionStateService });

  writeResponse({
    permission: 'allow',
    agent_message: `Agent ${result.agentId} joined project conversation ${result.conversationId}.`,
  });
}

async function handleSessionEnd(): Promise<void> {
  const serverPid = process.ppid;
  const stateService = new StateService();
  await stateService.init();
  const sessionStateService = new SessionStateService();

  await handleCursorLeave(serverPid, { stateService, sessionStateService });

  writeResponse({ permission: 'allow' });
}

function handleBeforeMCPExecution(input: HookInput): void {
  if (input.server === 'group-chat-mcp') {
    writeResponse({ permission: 'allow' });
  } else {
    writeResponse({ permission: 'ask' });
  }
}

async function main(): Promise<void> {
  const raw = await readStdin();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    writeResponse({ permission: 'allow', agent_message: 'Failed to parse hook input.' });
    return;
  }

  const input = parsed as HookInput;

  if (typeof input.hook_event_name !== 'string' || input.hook_event_name.length === 0) {
    writeResponse({ permission: 'allow', agent_message: 'Missing or empty hook_event_name.' });
    return;
  }

  switch (input.hook_event_name) {
    case 'sessionStart':
      await handleSessionStart(input);
      break;
    case 'sessionEnd':
      await handleSessionEnd();
      break;
    case 'beforeMCPExecution':
      handleBeforeMCPExecution(input);
      break;
    default:
      writeResponse({ permission: 'allow' });
      break;
  }
}

main().catch((err: unknown) => {
  console.error('cursor-hook error:', err);
  writeResponse({ permission: 'allow' });
  process.exit(0);
});
