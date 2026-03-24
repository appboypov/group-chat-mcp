import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatUpdateNotice } from '../utils/update-utils.js';
import { parseCommand } from '../gchat.js';
import { IDE } from '../enums/ide.js';
import { Scope } from '../enums/scope.js';

const {
  mockCheckForUpdate,
  mockSelectIDE,
  mockSelectScope,
  mockClose,
  mockInstall,
  mockClaudeCodeScope,
  mockInit,
  mockReapStaleAgents,
  mockRegisterAgent,
  mockGetOrCreateProjectConversation,
  mockJoinConversation,
  mockGetConversation,
  mockWriteSessionAgent,
} = vi.hoisted(() => ({
  mockCheckForUpdate: vi.fn(),
  mockSelectIDE: vi.fn(),
  mockSelectScope: vi.fn(),
  mockClose: vi.fn(),
  mockInstall: vi.fn(),
  mockClaudeCodeScope: vi.fn().mockReturnValue('global'),
  mockInit: vi.fn(),
  mockReapStaleAgents: vi.fn(),
  mockRegisterAgent: vi.fn().mockResolvedValue({ id: 'agent-1', profile: { name: 'test' }, conversations: [] }),
  mockGetOrCreateProjectConversation: vi.fn().mockResolvedValue({ id: 'conv-1', participants: [] }),
  mockJoinConversation: vi.fn(),
  mockGetConversation: vi.fn().mockResolvedValue({ id: 'conv-1', participants: ['agent-1'] }),
  mockWriteSessionAgent: vi.fn(),
}));

vi.mock('../services/version-check-service.js', () => {
  return {
    VersionCheckService: vi.fn(function (this: Record<string, unknown>) {
      this.checkForUpdate = mockCheckForUpdate;
    }),
  };
});

vi.mock('../utils/prompt-utils.js', () => {
  return {
    PromptUtils: vi.fn(function (this: Record<string, unknown>) {
      this.selectIDE = mockSelectIDE;
      this.selectScope = mockSelectScope;
      this.close = mockClose;
    }),
  };
});

vi.mock('../services/installer-service.js', () => {
  return {
    InstallerService: vi.fn(function (this: Record<string, unknown>) {
      this.install = mockInstall;
      this.uninstall = vi.fn();
      this.claudeCodeScope = mockClaudeCodeScope;
      this.resolveSettingsPath = vi.fn().mockReturnValue('/tmp/settings.json');
    }),
  };
});

vi.mock('../services/state-service.js', () => {
  return {
    StateService: vi.fn(function (this: Record<string, unknown>) {
      this.init = mockInit;
      this.reapStaleAgents = mockReapStaleAgents;
      this.registerAgent = mockRegisterAgent;
      this.getOrCreateProjectConversation = mockGetOrCreateProjectConversation;
      this.joinConversation = mockJoinConversation;
      this.getConversation = mockGetConversation;
    }),
  };
});

vi.mock('../services/session-state-service.js', () => {
  return {
    SessionStateService: vi.fn(function (this: Record<string, unknown>) {
      this.writeSessionAgent = mockWriteSessionAgent;
    }),
  };
});

vi.mock('../utils/notification-utils.js', () => {
  return {
    writeNotificationToParticipants: vi.fn(),
    writeProfileSetupNotification: vi.fn(),
  };
});

describe('formatUpdateNotice', () => {
  it('Given ("0.1.6", "0.2.0") When called Then it returns the formatted update notice string', () => {
    const result = formatUpdateNotice('0.1.6', '0.2.0');
    expect(result).toBe('\nUpdate available: 0.1.6 → 0.2.0. Run `gchat update` to install.\n');
  });
});

describe('update notice behavior', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = process.argv;
    process.argv = ['node', 'gchat.js', 'install'];
    mockSelectIDE.mockResolvedValue([IDE.ClaudeCode]);
    mockSelectScope.mockResolvedValue(Scope.Global);
    mockInstall.mockResolvedValue(undefined);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.argv = originalArgv;
    errorSpy.mockRestore();
    logSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('Given VersionCheckService returns null When an interactive command completes Then no notice is printed', async () => {
    mockCheckForUpdate.mockResolvedValue(null);
    const { main } = await import('../gchat.js');
    await main();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('Given VersionCheckService returns updateAvailable: true When an interactive command completes Then the update notice is printed', async () => {
    mockCheckForUpdate.mockResolvedValue({ current: '0.1.6', latest: '0.2.0', updateAvailable: true });
    const { main } = await import('../gchat.js');
    await main();
    expect(errorSpy).toHaveBeenCalledWith(formatUpdateNotice('0.1.6', '0.2.0'));
  });

  it('Given VersionCheckService returns updateAvailable: false When an interactive command completes Then no notice is printed', async () => {
    mockCheckForUpdate.mockResolvedValue({ current: '0.2.0', latest: '0.2.0', updateAvailable: false });
    const { main } = await import('../gchat.js');
    await main();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('Given a hook command (cursor-join) is executed Then the version check is not fired', async () => {
    vi.clearAllMocks();
    process.argv = ['node', 'gchat.js', 'cursor-join', '--project', '/tmp/test', '--server-pid', '1234'];
    const { main } = await import('../gchat.js');
    await main();
    expect(mockCheckForUpdate).not.toHaveBeenCalled();
  });
});
