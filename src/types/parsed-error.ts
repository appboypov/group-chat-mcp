export interface ParsedError {
  error: 'no-command' | 'unknown-command' | 'missing-required-arg';
  message?: string;
}
