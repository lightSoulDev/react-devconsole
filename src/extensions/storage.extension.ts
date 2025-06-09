/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '../Logger';

interface StorageData {
  localStorage: Record<string, any>;
  sessionStorage: Record<string, any>;
  cookies: Record<string, string>;
}

// Helper to parse storage values
const parseStorageValue = (value: string): any => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

// Helper to get all localStorage items
const getLocalStorageItems = (): Record<string, any> => {
  const items: Record<string, any> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      items[key] = parseStorageValue(localStorage.getItem(key) || '');
    }
  }
  return items;
};

// Helper to get all sessionStorage items
const getSessionStorageItems = (): Record<string, any> => {
  const items: Record<string, any> = {};
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key) {
      items[key] = parseStorageValue(sessionStorage.getItem(key) || '');
    }
  }
  return items;
};

// Helper to get all cookies
const getCookies = (): Record<string, string> => {
  const cookies: Record<string, string> = {};
  document.cookie.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name) {
      cookies[name] = decodeURIComponent(value || '');
    }
  });
  return cookies;
};

// Helper to clear cookies
const clearCookies = (domain?: string) => {
  const cookies = getCookies();
  const paths = ['/', window.location.pathname];
  const domains = domain ? [domain] : [window.location.hostname, `.${window.location.hostname}`, ''];

  Object.keys(cookies).forEach(name => {
    domains.forEach(d => {
      paths.forEach(p => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${p}${d ? `; domain=${d}` : ''}`;
      });
    });
  });
};

export const activateStorageExtension = () => {
  // localStorage commands
  logger.registerCommand({
    name: 'storage.ls',
    description: 'List/get localStorage items',
    handler: (args) => {
      const key = args[0];

      if (key) {
        // Get specific item
        const value = localStorage.getItem(key);
        if (value !== null) {
          logger.dev(`localStorage['${key}']`, parseStorageValue(value));
        } else {
          logger.dev(`localStorage['${key}'] is not defined`);
        }
      } else {
        // List all items
        const items = getLocalStorageItems();
        const count = Object.keys(items).length;

        if (count === 0) {
          logger.dev('localStorage is empty');
        } else {
          logger.dev(`localStorage (${count} items)`, items);
        }
      }
    }
  });

  // sessionStorage commands
  logger.registerCommand({
    name: 'storage.ss',
    description: 'List/get sessionStorage items',
    handler: (args) => {
      const key = args[0];

      if (key) {
        // Get specific item
        const value = sessionStorage.getItem(key);
        if (value !== null) {
          logger.dev(`sessionStorage['${key}']`, parseStorageValue(value));
        } else {
          logger.dev(`sessionStorage['${key}'] is not defined`);
        }
      } else {
        // List all items
        const items = getSessionStorageItems();
        const count = Object.keys(items).length;

        if (count === 0) {
          logger.dev('sessionStorage is empty');
        } else {
          logger.dev(`sessionStorage (${count} items)`, items);
        }
      }
    }
  });

  // Set storage value
  logger.registerCommand({
    name: 'storage.set',
    description: 'Set storage value (usage: /storage.set <ls|ss> <key> <value>)',
    handler: (args) => {
      if (args.length < 3) {
        logger.dev('Usage: /storage.set <ls|ss> <key> <value>');
        return;
      }

      const [type, key, ...valueParts] = args;
      const value = valueParts.join(' ');

      if (type !== 'ls' && type !== 'ss') {
        logger.dev('Storage type must be "ls" (localStorage) or "ss" (sessionStorage)');
        return;
      }

      try {
        // Try to store as JSON if it's valid JSON
        let storedValue = value;
        try {
          JSON.parse(value);
          storedValue = value;
        } catch {
          // If not valid JSON, store as string
          storedValue = value;
        }

        if (type === 'ls') {
          localStorage.setItem(key, storedValue);
          logger.dev(`Set localStorage['${key}'] = ${storedValue}`);
        } else {
          sessionStorage.setItem(key, storedValue);
          logger.dev(`Set sessionStorage['${key}'] = ${storedValue}`);
        }
      } catch (error) {
        logger.error('Failed to set storage value', error);
      }
    }
  });

  // Clear storage
  logger.registerCommand({
    name: 'storage.clear',
    description: 'Clear storage (usage: /storage.clear <ls|ss|all>)',
    handler: (args) => {
      const type = args[0] || 'all';

      switch (type) {
        case 'ls':
          localStorage.clear();
          logger.dev('Cleared localStorage');
          break;
        case 'ss':
          sessionStorage.clear();
          logger.dev('Cleared sessionStorage');
          break;
        case 'all':
          localStorage.clear();
          sessionStorage.clear();
          logger.dev('Cleared all storage (localStorage and sessionStorage)');
          break;
        default:
          logger.dev('Usage: /storage.clear <ls|ss|all>');
      }
    }
  });

  // Export all storage
  logger.registerCommand({
    name: 'storage.export',
    description: 'Export all storage as JSON',
    handler: () => {
      const data: StorageData = {
        localStorage: getLocalStorageItems(),
        sessionStorage: getSessionStorageItems(),
        cookies: getCookies()
      };

      const exportData = {
        exportDate: new Date().toISOString(),
        url: window.location.href,
        data
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `storage-export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      logger.dev('Exported all storage data to file');
    }
  });

  // List cookies
  logger.registerCommand({
    name: 'cookies.list',
    description: 'Show all cookies',
    handler: () => {
      const cookies = getCookies();
      const count = Object.keys(cookies).length;

      if (count === 0) {
        logger.dev('No cookies found');
      } else {
        logger.dev(`Cookies (${count})`, cookies);
      }
    }
  });

  // Clear cookies
  logger.registerCommand({
    name: 'cookies.clear',
    description: 'Clear cookies (usage: /cookies.clear [domain])',
    handler: (args) => {
      const domain = args[0];
      const beforeCount = Object.keys(getCookies()).length;

      clearCookies(domain);

      const afterCount = Object.keys(getCookies()).length;
      const cleared = beforeCount - afterCount;

      if (domain) {
        logger.dev(`Cleared ${cleared} cookies for domain: ${domain}`);
      } else {
        logger.dev(`Cleared ${cleared} cookies`);
      }

      if (afterCount > 0) {
        logger.dev(`Note: ${afterCount} cookies could not be cleared (may be HttpOnly or from different domain)`);
      }
    }
  });
};