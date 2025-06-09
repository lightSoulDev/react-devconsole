/* eslint-disable @typescript-eslint/no-explicit-any */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'dev';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  data?: any;
  source?: {
    file: string;
    line: number;
    column: number;
  };
}

export interface LoggerConfig {
  maxLogs?: number;
  enableConsoleOutput?: boolean;
  enableSourceTracking?: boolean;
}

export const LOG_COLORS: Record<LogLevel, string> = {
  debug: '#AAAAAA',
  info: '#0080FF',
  warn: '#FFA500',
  error: '#FF0000',
  dev: '#be34ff'
};

export interface Command {
  name: string;
  description: string;
  handler: (args: string[]) => void;
}

export interface Variables {
  [key: string]: string | number | boolean;
}