import type { LoggerConfig } from './types';

declare global {
  interface Window {
    activateDevConsole?: (config?: Partial<LoggerConfig>) => Promise<boolean>;
  }
}

export { };