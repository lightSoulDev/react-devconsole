// Core exports
export { logger as DevConsole } from './Logger';
export { LogConsole as DevConsoleUI } from './LogConsole';
export { configureLogger as configureDevConsole } from './Logger';

// Type exports
export type { LogLevel, LogEntry, Command } from './types';

// Extension exports
export { activateHttpExtension } from './extensions/http.extension';
export { activateStorageExtension } from './extensions/storage.extension';

// HTTP extension APIs
export {
  setUserHeaders,
  getUserHeaders,
  clearUserHeaders
} from './extensions/http.extension';

// Convenience re-export for default usage
export { logger } from './Logger';

// Default export for easy importing
import { logger } from './Logger';
export default logger;