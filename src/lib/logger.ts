type LogData = Record<string, unknown>;

interface LogEntry {
  level: "info" | "warn" | "error";
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function fmt(level: LogEntry["level"], message: string, data?: LogData): LogEntry {
  return { level, message, timestamp: new Date().toISOString(), ...data };
}

export const log = {
  info(message: string, data?: LogData): void {
    console.log(JSON.stringify(fmt("info", message, data)));
  },
  warn(message: string, data?: LogData): void {
    console.warn(JSON.stringify(fmt("warn", message, data)));
  },
  error(message: string, data?: LogData): void {
    console.error(JSON.stringify(fmt("error", message, data)));
  },
};
