/* eslint-disable @typescript-eslint/no-explicit-any */
import type { LogEntry, LogLevel, LoggerConfig, Command, Variables } from './types';

export class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private listeners: ((logs: LogEntry[]) => void)[] = [];
  private commandRegistry = new Map<string, Command>();
  private variables: Variables = {};
  private builtInCommands = ['clear', 'export', 'help', 'var'];
  private config: Required<LoggerConfig> = {
    maxLogs: 1000,
    enableConsoleOutput: true,
    enableSourceTracking: true,
  };

  private constructor() { }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  configure(config: Partial<LoggerConfig>): void {
    if (config.maxLogs !== undefined) {
      this.config.maxLogs = config.maxLogs;
    }
    if (config.enableConsoleOutput !== undefined) {
      this.config.enableConsoleOutput = config.enableConsoleOutput;
    }
    if (config.enableSourceTracking !== undefined) {
      this.config.enableSourceTracking = config.enableSourceTracking;
    }
  }

  private getSourceInfo(): LogEntry['source'] | undefined {
    if (!this.config.enableSourceTracking) return undefined;

    const error = new Error();
    const stack = error.stack?.split('\n');

    if (!stack) return undefined;

    // Find the first stack frame that's not from the Logger itself
    for (let i = 1; i < stack.length; i++) {
      const line = stack[i];
      if (!line.includes('/Logger.ts') && !line.includes('\\Logger.ts')) {
        const match = line.match(/at\s+(?:.*?\s+\()?(.+):(\d+):(\d+)\)?$/);
        if (match) {
          const [, file, lineNum, column] = match;
          return {
            file: typeof window !== 'undefined' && window.location ? file.replace(window.location.origin, '') : file,
            line: parseInt(lineNum, 10),
            column: parseInt(column, 10),
          };
        }
      }
    }

    return undefined;
  }

  private generateId(): string {
    // Use crypto.randomUUID if available, otherwise fallback to timestamp + random
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private log(level: LogLevel, message: string, data?: any): void {
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level,
      message,
      data,
      source: this.getSourceInfo(),
    };

    this.logs.push(entry);

    if (this.logs.length > this.config.maxLogs) {
      this.logs.shift();
    }

    if (this.config.enableConsoleOutput) {
      const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
      console[consoleMethod](`[${level.toUpperCase()}]`, message, data ?? '');
    }

    this.notifyListeners();
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  dev(message: string, data?: any): void {
    this.log('dev', message, data);
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  getConfig(): Required<LoggerConfig> {
    return { ...this.config };
  }

  clear(): void {
    this.logs = [];
    this.notifyListeners();
  }

  subscribe(listener: (logs: LogEntry[]) => void): () => void {
    this.listeners.push(listener);
    listener(this.getLogs());

    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    const logs = this.getLogs();
    this.listeners.forEach(listener => listener(logs));
  }

  registerCommand(command: Command): boolean {
    const cmdName = command.name.toLowerCase();

    // Check if command name is reserved
    if (this.builtInCommands.includes(cmdName)) {
      console.warn(`Cannot register command "${command.name}": name is reserved for built-in command`);
      return false;
    }

    this.commandRegistry.set(cmdName, command);
    return true;
  }

  unregisterCommand(name: string): boolean {
    const cmdName = name.toLowerCase();
    if (this.builtInCommands.includes(cmdName)) {
      console.warn(`Cannot unregister built-in command "${name}"`);
      return false;
    }
    return this.commandRegistry.delete(cmdName);
  }

  getCommand(name: string): Command | undefined {
    return this.commandRegistry.get(name.toLowerCase());
  }

  getCommands(): Map<string, Command> {
    return new Map(this.commandRegistry);
  }

  setVariable(name: string, value: string | number | boolean): void {
    this.variables[name] = value;
  }

  getVariable(name: string): string | number | boolean | undefined {
    return this.variables[name];
  }

  deleteVariable(name: string): boolean {
    if (name in this.variables) {
      delete this.variables[name];
      return true;
    }
    return false;
  }

  getVariables(): Variables {
    return { ...this.variables };
  }

  // Resolve variables in a string
  resolveVariables(input: string): { resolved: string; unresolved: string[] } {
    const unresolved: string[] = [];
    const variableRegex = /\$\{([^}]+)\}/g;

    const resolved = input.replace(variableRegex, (match, varName) => {
      const value = this.variables[varName];
      if (value === undefined) {
        unresolved.push(varName);
        return match; // Keep the original ${var} syntax
      }
      return String(value);
    });

    return { resolved, unresolved };
  }
}

export const logger = Logger.getInstance();

export const configureLogger = (config: Partial<LoggerConfig>): void => {
  logger.configure(config);
};