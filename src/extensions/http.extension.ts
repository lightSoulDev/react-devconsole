/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '../Logger';

interface HttpRequestOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}

// Store for user-defined headers
let userHeaders: Record<string, string> = {};

const makeRequest = async (options: HttpRequestOptions) => {
  try {
    // Add query parameters to URL if provided
    let url = options.url;
    if (options.query) {
      const params = new URLSearchParams(options.query);
      url += (url.includes('?') ? '&' : '?') + params.toString();
    }

    // Base headers that should always be included
    const baseHeaders: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const requestInit: RequestInit = {
      method: options.method,
      headers: {
        ...baseHeaders,
        ...options.headers
      }
    };

    // Add body for non-GET requests
    if (options.body && options.method !== 'GET') {
      requestInit.body = JSON.stringify(options.body);
    }

    logger.dev(`HTTP ${options.method} ${url}`, {
      request: {
        method: options.method,
        url,
        headers: requestInit.headers,
        body: options.body
      }
    });

    const response = await fetch(url, requestInit);
    const contentType = response.headers.get('content-type');
    let data: any;

    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    logger.dev(`HTTP Response [${response.status}]`, {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data
    });

    return data;
  } catch (error) {
    logger.dev('HTTP Request Failed', error);
    throw error;
  }
};

interface ParsedArgs {
  url?: string;
  params: Record<string, string>;
  headers: Record<string, string>;
  flags: Set<string>;
  jsonBody?: any;
}

export const parseArgs = (args: string[]): ParsedArgs => {
  const result: ParsedArgs = {
    params: {},
    headers: {},
    flags: new Set()
  };
  

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // URL is the first non-flag argument (URLs can contain = for query params)
    if (!arg.startsWith('-') && !result.url) {
      result.url = arg;
    }
    // Parse JSON body flag: -j {...}
    else if ((arg === '-j' || arg === '--json') && i + 1 < args.length) {
      result.flags.add('json');
      try {
        result.jsonBody = JSON.parse(args[++i]);
      } catch (e) {
        logger.dev('Invalid JSON provided with -j flag', e);
        throw new Error('Invalid JSON format');
      }
    }
    // Parse header flags: -H "Key: Value" or --header "Key: Value"
    else if ((arg === '-H' || arg === '--header') && i + 1 < args.length) {
      const headerString = args[++i];
      const colonIndex = headerString.indexOf(':');
      if (colonIndex > 0) {
        const key = headerString.substring(0, colonIndex).trim();
        const value = headerString.substring(colonIndex + 1).trim();
        result.headers[key] = value;
      }
    }
    // Parse boolean flags
    else if (arg === '-u' || arg === '--user-headers') {
      result.flags.add('user-headers');
    }
    // Parse key=value pairs (body/query params) - skip if it's the URL or if JSON flag is present
    else if (arg.includes('=') && !arg.startsWith('-') && arg !== result.url && !result.flags.has('json')) {
      const [key, ...valueParts] = arg.split('=');
      result.params[key] = valueParts.join('=');
    }
    // Parse -key value pairs (skip already handled -H, -u, and -j)
    else if (arg.startsWith('-') && i + 1 < args.length && arg !== '-H' && arg !== '--header' && arg !== '-u' && arg !== '--user-headers' && arg !== '-j' && arg !== '--json') {
      const key = arg.substring(1);
      result.params[key] = args[++i];
    }
  }

  return result;
};

// Build request options from parsed arguments
export const buildRequestOptions = (method: string, parsedArgs: ParsedArgs): HttpRequestOptions | null => {
  const { url, params, headers, flags, jsonBody } = parsedArgs;

  if (!url) {
    return null;
  }

  // Merge headers: base headers + user headers (if -u flag) + command headers
  const finalHeaders = flags.has('user-headers') 
    ? { ...userHeaders, ...headers }
    : headers;

  // Determine body based on -j flag presence
  const body = flags.has('json') ? jsonBody : params;

  // For GET requests, params should be query parameters regardless of -j flag
  if (method === 'GET') {
    return {
      method,
      url,
      query: params,
      headers: finalHeaders,
      ...(jsonBody && { body: jsonBody }) // Still allow body for GET if explicitly provided with -j
    };
  }

  return {
    method,
    url,
    body,
    headers: finalHeaders
  };
};

// Public API to set user headers
export const setUserHeaders = (headers: Record<string, string>) => {
  userHeaders = { ...headers };
};

// Public API to get current user headers
export const getUserHeaders = () => ({ ...userHeaders });

// Public API to clear user headers
export const clearUserHeaders = () => {
  userHeaders = {};
  logger.dev('User headers cleared');
};

export const activateHttpExtension = () => {
  // GET request
  logger.registerCommand({
    name: 'http.get',
    description: 'Make a GET request (usage: /http.get <url> [-u] [-H "Key: Value"] [-j {...}] [key=value...])',
    handler: async (args) => {
      const parsedArgs = parseArgs(args);
      const requestOptions = buildRequestOptions('GET', parsedArgs);

      if (!requestOptions) {
        logger.dev('Usage: /http.get <url> [-u] [-H "Key: Value"] [-j {...}] [key=value...]');
        return;
      }

      await makeRequest(requestOptions);
    }
  });

  // POST request
  logger.registerCommand({
    name: 'http.post',
    description: 'Make a POST request (usage: /http.post <url> [-u] [-H "Key: Value"] [-j {...}] [key=value...])',
    handler: async (args) => {
      const parsedArgs = parseArgs(args);
      const requestOptions = buildRequestOptions('POST', parsedArgs);

      if (!requestOptions) {
        logger.dev('Usage: /http.post <url> [-u] [-H "Key: Value"] [-j {...}] [key=value...]');
        return;
      }

      await makeRequest(requestOptions);
    }
  });

  // PUT request
  logger.registerCommand({
    name: 'http.put',
    description: 'Make a PUT request (usage: /http.put <url> [-u] [-H "Key: Value"] [-j {...}] [key=value...])',
    handler: async (args) => {
      const parsedArgs = parseArgs(args);
      const requestOptions = buildRequestOptions('PUT', parsedArgs);

      if (!requestOptions) {
        logger.dev('Usage: /http.put <url> [-u] [-H "Key: Value"] [-j {...}] [key=value...]');
        return;
      }

      await makeRequest(requestOptions);
    }
  });

  // DELETE request
  logger.registerCommand({
    name: 'http.delete',
    description: 'Make a DELETE request (usage: /http.delete <url> [-u] [-H "Key: Value"] [-j {...}] [key=value...])',
    handler: async (args) => {
      const parsedArgs = parseArgs(args);
      const requestOptions = buildRequestOptions('DELETE', parsedArgs);

      if (!requestOptions) {
        logger.dev('Usage: /http.delete <url> [-u] [-H "Key: Value"] [-j {...}] [key=value...]');
        return;
      }

      await makeRequest(requestOptions);
    }
  });

  // Generic request with custom method
  logger.registerCommand({
    name: 'http.request',
    description: 'Make a custom HTTP request (usage: /http.request <method> <url> [-u] [-H "Key: Value"] [-j {...}] [key=value...])',
    handler: async (args) => {
      if (args.length < 2) {
        logger.dev('Usage: /http.request <method> <url> [-u] [-H "Key: Value"] [-j {...}] [key=value...]');
        return;
      }

      const method = args[0].toUpperCase();
      const parsedArgs = parseArgs(args.slice(1));
      const requestOptions = buildRequestOptions(method, parsedArgs);

      if (!requestOptions) {
        logger.dev('URL is required');
        return;
      }

      await makeRequest(requestOptions);
    }
  });

  // Command to manage user headers
  logger.registerCommand({
    name: 'http.headers',
    description: 'Manage user headers (usage: /http.headers [show|clear|set <key> <value>])',
    handler: (args) => {
      if (args.length === 0 || args[0] === 'show') {
        logger.dev('Current user headers', userHeaders);
      } else if (args[0] === 'clear') {
        clearUserHeaders();
      } else if (args[0] === 'set' && args.length >= 3) {
        const key = args[1];
        const value = args.slice(2).join(' ');
        userHeaders[key] = value;
        logger.dev(`Header set: ${key}`, value);
      } else {
        logger.dev('Usage: /http.headers [show|clear|set <key> <value>]');
      }
    }
  });
};