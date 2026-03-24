export type ParsedCommand =
  | { command: 'install' }
  | { command: 'uninstall' }
  | { command: 'update' }
  | { command: 'update-post-install' }
  | { command: 'cursor-join'; project: string; serverPid: number }
  | { command: 'cursor-leave'; serverPid: number };
