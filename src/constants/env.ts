export const GC_PROJECT_PATH: string | undefined = process.env.GC_PROJECT_PATH;

export const GC_CLIENT_TYPE: string | undefined = process.env.GC_CLIENT_TYPE;

const parsedPollInterval = process.env.GC_POLL_INTERVAL_MS
  ? parseInt(process.env.GC_POLL_INTERVAL_MS, 10)
  : 2000;

export const GC_POLL_INTERVAL_MS: number = isNaN(parsedPollInterval) ? 2000 : parsedPollInterval;
