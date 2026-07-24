const isDev = process.env.NODE_ENV !== "production";

export const Logger = {
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  error: (...args: unknown[]) => {
    console.error(...args);
    // Forward error to monitoring SDK if configured in environment
    if (typeof window !== "undefined" && (window as any).Sentry) {
      (window as any).Sentry.captureException(args[0]);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
};
