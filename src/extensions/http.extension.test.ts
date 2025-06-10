import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildRequestOptions, parseArgs } from './http.extension';

// Mock the logger
vi.mock('../Logger', () => ({
  logger: {
    dev: vi.fn(),
  },
}));

describe('parseArgs', () => {
  it('should parse URL as first non-flag argument', () => {
    const result = parseArgs(['https://api.example.com']);
    expect(result.url).toBe('https://api.example.com');
    expect(result.params).toEqual({});
    expect(result.headers).toEqual({});
    expect(result.flags.size).toBe(0);
  });

  it('should parse key=value pairs', () => {
    const result = parseArgs(['https://api.example.com', 'name=John', 'age=30']);
    expect(result.url).toBe('https://api.example.com');
    expect(result.params).toEqual({ name: 'John', age: '30' });
  });

  it('should parse headers with -H flag', () => {
    const result = parseArgs(['https://api.example.com', '-H', 'Authorization: Bearer token', '-H', 'Content-Type: application/json']);
    expect(result.url).toBe('https://api.example.com');
    expect(result.headers).toEqual({
      'Authorization': 'Bearer token',
      'Content-Type': 'application/json'
    });
  });

  it('should parse JSON body with -j flag', () => {
    const result = parseArgs(['https://api.example.com', '-j', '{"name":"John","age":30}']);
    expect(result.url).toBe('https://api.example.com');
    expect(result.jsonBody).toEqual({ name: 'John', age: 30 });
    expect(result.flags.has('json')).toBe(true);
  });

  it('should handle invalid JSON with -j flag', () => {
    expect(() => parseArgs(['https://api.example.com', '-j', 'invalid json'])).toThrow('Invalid JSON format');
  });

  it('should set user-headers flag with -u', () => {
    const result = parseArgs(['https://api.example.com', '-u']);
    expect(result.flags.has('user-headers')).toBe(true);
  });

  it('should ignore key=value pairs when -j flag is present', () => {
    const result = parseArgs(['https://api.example.com', '-j', '{"name":"John"}', 'age=30']);
    expect(result.jsonBody).toEqual({ name: 'John' });
    expect(result.params).toEqual({});
    expect(result.flags.has('json')).toBe(true);
  });

  it('should handle URLs with query parameters', () => {
    const result = parseArgs(['https://api.example.com?param=value']);
    expect(result.url).toBe('https://api.example.com?param=value');
  });

  it('should parse multiple flags and parameters together', () => {
    const result = parseArgs([
      'https://api.example.com',
      '-u',
      '-H', 'Authorization: Bearer token',
      '-j', '{"data":"test"}',
      'ignored=value'
    ]);
    
    expect(result.url).toBe('https://api.example.com');
    expect(result.flags.has('user-headers')).toBe(true);
    expect(result.headers).toEqual({ 'Authorization': 'Bearer token' });
    expect(result.jsonBody).toEqual({ data: 'test' });
    expect(result.params).toEqual({});
  });

  it('should handle empty arguments array', () => {
    const result = parseArgs([]);
    expect(result.url).toBeUndefined();
    expect(result.params).toEqual({});
    expect(result.headers).toEqual({});
    expect(result.flags.size).toBe(0);
  });

  it('should handle values with equals signs', () => {
    const result = parseArgs(['https://api.example.com', 'token=abc==def']);
    expect(result.params).toEqual({ token: 'abc==def' });
  });

  it('should handle headers without space after colon', () => {
    const result = parseArgs(['https://api.example.com', '-H', 'Authorization:Bearer token']);
    expect(result.headers).toEqual({ 'Authorization': 'Bearer token' });
  });

  it('should handle complex JSON objects', () => {
    const complexJson = '{"users":[{"id":1,"name":"John"},{"id":2,"name":"Jane"}],"meta":{"total":2}}';
    const result = parseArgs(['https://api.example.com', '-j', complexJson]);
    expect(result.jsonBody).toEqual({
      users: [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' }
      ],
      meta: { total: 2 }
    });
  });

  it('should handle -key value pairs correctly', () => {
    const result = parseArgs(['https://api.example.com', '-name', 'John', '-age', '30']);
    expect(result.params).toEqual({ name: 'John', age: '30' });
  });
});

describe('buildRequestOptions', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  it('should return null if URL is not provided', () => {
    const parsedArgs = {
      url: undefined,
      params: {},
      headers: {},
      flags: new Set<string>(),
    };
    
    const result = buildRequestOptions('GET', parsedArgs);
    expect(result).toBeNull();
  });

  it('should build GET request with query parameters', () => {
    const parsedArgs = {
      url: 'https://api.example.com',
      params: { search: 'test', limit: '10' },
      headers: {},
      flags: new Set<string>(),
    };
    
    const result = buildRequestOptions('GET', parsedArgs);
    expect(result).toEqual({
      method: 'GET',
      url: 'https://api.example.com',
      query: { search: 'test', limit: '10' },
      headers: {},
    });
  });

  it('should build POST request with JSON body when -j flag is present', () => {
    const parsedArgs = {
      url: 'https://api.example.com',
      params: { ignored: 'value' },
      headers: {},
      flags: new Set(['json']),
      jsonBody: { name: 'John', age: 30 },
    };
    
    const result = buildRequestOptions('POST', parsedArgs);
    expect(result).toEqual({
      method: 'POST',
      url: 'https://api.example.com',
      body: { name: 'John', age: 30 },
      headers: {},
    });
  });

  it('should build POST request with key-value body when -j flag is not present', () => {
    const parsedArgs = {
      url: 'https://api.example.com',
      params: { name: 'John', age: '30' },
      headers: {},
      flags: new Set<string>(),
    };
    
    const result = buildRequestOptions('POST', parsedArgs);
    expect(result).toEqual({
      method: 'POST',
      url: 'https://api.example.com',
      body: { name: 'John', age: '30' },
      headers: {},
    });
  });

  it('should include custom headers', () => {
    const parsedArgs = {
      url: 'https://api.example.com',
      params: {},
      headers: { 'Authorization': 'Bearer token' },
      flags: new Set<string>(),
    };
    
    const result = buildRequestOptions('GET', parsedArgs);
    expect(result).toEqual({
      method: 'GET',
      url: 'https://api.example.com',
      query: {},
      headers: { 'Authorization': 'Bearer token' },
    });
  });

  it('should handle GET request with JSON body', () => {
    const parsedArgs = {
      url: 'https://api.example.com',
      params: { query: 'test' },
      headers: {},
      flags: new Set(['json']),
      jsonBody: { filter: 'active' },
    };
    
    const result = buildRequestOptions('GET', parsedArgs);
    expect(result).toEqual({
      method: 'GET',
      url: 'https://api.example.com',
      query: { query: 'test' },
      headers: {},
      body: { filter: 'active' },
    });
  });

  it('should build DELETE request with body support', () => {
    const parsedArgs = {
      url: 'https://api.example.com',
      params: {},
      headers: {},
      flags: new Set(['json']),
      jsonBody: { ids: [1, 2, 3] },
    };
    
    const result = buildRequestOptions('DELETE', parsedArgs);
    expect(result).toEqual({
      method: 'DELETE',
      url: 'https://api.example.com',
      body: { ids: [1, 2, 3] },
      headers: {},
    });
  });

  it('should build PUT request with JSON body', () => {
    const parsedArgs = {
      url: 'https://api.example.com/user/123',
      params: {},
      headers: { 'Content-Type': 'application/json' },
      flags: new Set(['json']),
      jsonBody: { name: 'Updated Name', status: 'active' },
    };
    
    const result = buildRequestOptions('PUT', parsedArgs);
    expect(result).toEqual({
      method: 'PUT',
      url: 'https://api.example.com/user/123',
      body: { name: 'Updated Name', status: 'active' },
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('should handle empty body for non-GET requests', () => {
    const parsedArgs = {
      url: 'https://api.example.com',
      params: {},
      headers: {},
      flags: new Set<string>(),
    };
    
    const result = buildRequestOptions('POST', parsedArgs);
    expect(result).toEqual({
      method: 'POST',
      url: 'https://api.example.com',
      body: {},
      headers: {},
    });
  });

  it('should handle PATCH method correctly', () => {
    const parsedArgs = {
      url: 'https://api.example.com/resource/1',
      params: {},
      headers: {},
      flags: new Set(['json']),
      jsonBody: { field: 'updated' },
    };
    
    const result = buildRequestOptions('PATCH', parsedArgs);
    expect(result).toEqual({
      method: 'PATCH',
      url: 'https://api.example.com/resource/1',
      body: { field: 'updated' },
      headers: {},
    });
  });

  it('should handle custom HTTP methods', () => {
    const parsedArgs = {
      url: 'https://api.example.com',
      params: { action: 'test' },
      headers: {},
      flags: new Set<string>(),
    };
    
    const result = buildRequestOptions('OPTIONS', parsedArgs);
    expect(result).toEqual({
      method: 'OPTIONS',
      url: 'https://api.example.com',
      body: { action: 'test' },
      headers: {},
    });
  });
});