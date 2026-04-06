const isProd = process.env.NODE_ENV === 'production';

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => {
    console.log(isProd ? JSON.stringify({ level: 'info', msg, ...meta }) : `[INFO] ${msg}`, meta ?? '');
  },
  warn: (msg: string, meta?: Record<string, unknown>) => {
    console.warn(isProd ? JSON.stringify({ level: 'warn', msg, ...meta }) : `[WARN] ${msg}`, meta ?? '');
  },
  error: (msg: string, err?: unknown, meta?: Record<string, unknown>) => {
    const payload: Record<string, unknown> = { level: 'error', msg, ...meta };
    if (err instanceof Error && !isProd) payload.stack = err.stack;
    console.error(isProd ? JSON.stringify(payload) : `[ERROR] ${msg}`, err ?? '', meta ?? '');
  },
  debug: (msg: string, meta?: Record<string, unknown>) => {
    if (!isProd) console.debug(`[DEBUG] ${msg}`, meta ?? '');
  },
};
