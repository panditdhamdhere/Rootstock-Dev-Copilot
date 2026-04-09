export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type Logger = {
  log: (level: LogLevel, event: string, data?: Record<string, unknown>) => void;
};

export function createLogger(service: string): Logger {
  return {
    log(level, event, data = {}) {
      const line = {
        ts: new Date().toISOString(),
        level,
        service,
        event,
        ...data
      };
      const serialized = JSON.stringify(line);
      if (level === 'error') {
        console.error(serialized);
        return;
      }
      console.log(serialized);
    }
  };
}
