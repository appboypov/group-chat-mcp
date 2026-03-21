export type ParsedCommand =
  | { command: 'install' }
  | { command: 'uninstall' }
  | { command: 'cursor-join'; project: string; serverPid: number }
  | { command: 'cursor-leave'; serverPid: number };
