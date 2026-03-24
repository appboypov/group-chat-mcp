export function formatUpdateNotice(current: string, latest: string): string {
  return `\nUpdate available: ${current} → ${latest}. Run \`gchat update\` to install.\n`;
}
