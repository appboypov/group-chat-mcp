const agentId = process.env.GC_AGENT_ID;
if (!agentId) {
  console.error('ERROR: GC_AGENT_ID environment variable is required');
  process.exit(1);
}

export const GC_AGENT_ID: string = agentId;

const parsedPollInterval = process.env.GC_POLL_INTERVAL_MS
  ? parseInt(process.env.GC_POLL_INTERVAL_MS, 10)
  : 2000;

export const GC_POLL_INTERVAL_MS: number = isNaN(parsedPollInterval) ? 2000 : parsedPollInterval;
