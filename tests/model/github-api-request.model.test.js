import { describe, it, expect, beforeEach } from 'vitest';
import { GitHubApiRequest } from '../../src/model/github-api-request.model.js';

describe('GitHubApiRequest', () => {
  let request;
  const url = 'https://api.github.com/search/repositories?q=stars:>=1000';
  const params = {};
  const callback = (results) => ({ results });

  beforeEach(() => {
    request = new GitHubApiRequest(url, params, callback);
  });

  it('should be initialized with provided values', () => {
    expect(request.getUrl()).toBe(url);
    expect(request.getParams()).toEqual(params);
    expect(request.getCallback()).toBe(callback);
  });

  it('should be initialized with default values when not provided', () => {
    const defaultRequest = new GitHubApiRequest(url);
    expect(defaultRequest.getUrl()).toBe(url);
    expect(defaultRequest.getParams()).toEqual({});
    expect(typeof defaultRequest.getCallback()).toBe('function');
  });

  it('should return its URL', () => {
    expect(request.getUrl()).toBe(url);
  });

  it('should return its params', () => {
    expect(request.getParams()).toEqual(params);
  });

  it('should return its callback', () => {
    expect(request.getCallback()).toBe(callback);
  });

  it('should execute and return the callback result', () => {
    const payload = { data: 'value' };
    const result = request.runCallback(payload);
    expect(result).toEqual({ results: payload });
  });

  it('should return undefined when default callback invoked', () => {
    const defaultRequest = new GitHubApiRequest(url);
    expect(defaultRequest.runCallback({})).toBeUndefined();
  });
});
