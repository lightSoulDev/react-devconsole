/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LogEntry, LoggerConfig, Command } from './types';

/**
 * No-operation logger that implements the same API as the real Logger
 * but does nothing. Used in production when DEV_CONSOLE is disabled.
 */
export class NoOpLogger {
  private static instance: NoOpLogger;

  private constructor() { }

  static getInstance(): NoOpLogger {
    if (!NoOpLogger.instance) {
      NoOpLogger.instance = new NoOpLogger();
    }
    return NoOpLogger.instance;
  }

  configure(_config: Partial<LoggerConfig>): void {
    // No-op
  }

  debug(_message: string, _data?: any): void {
    // No-op
  }

  info(_message: string, _data?: any): void {
    // No-op
  }

  warn(_message: string, _data?: any): void {
    // No-op
  }

  error(_message: string, _data?: any): void {
    // No-op
  }

  dev(_message: string, _data?: any): void {
    // No-op
  }

  getLogs(): LogEntry[] {
    return [];
  }

  getConfig(): Required<LoggerConfig> {
    return {
      maxLogs: 0,
      enableConsoleOutput: false,
      enableSourceTracking: false,
    };
  }

  clear(): void {
    // No-op
  }

  subscribe(_listener: (logs: LogEntry[]) => void): () => void {
    // Return a no-op unsubscribe function
    return () => { };
  }

  registerCommand(_command: Command): boolean {
    return false;
  }

  unregisterCommand(_name: string): boolean {
    return false;
  }

  getCommand(_name: string): Command | undefined {
    return undefined;
  }

  getCommands(): Map<string, Command> {
    return new Map();
  }

  setVariable(_name: string, _value: string | number | boolean): void {
    // No-op
  }

  getVariable(_name: string): string | number | boolean | undefined {
    return undefined;
  }

  deleteVariable(_name: string): boolean {
    return false;
  }

  getVariables(): Record<string, string | number | boolean> {
    return {};
  }

  resolveVariables(input: string): { resolved: string; unresolved: string[] } {
    return { resolved: input, unresolved: [] };
  }
}

export const noOpLogger = NoOpLogger.getInstance();

// No-op configuration function
export const configureNoOpLogger = (_config: Partial<LoggerConfig>): void => {
  // No-op
};