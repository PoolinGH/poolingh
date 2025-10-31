import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import axios from 'axios';
import { GitHubApiClient } from '../../src/helper/github-api-client.helper.js';

// Mocks

vi.mock('axios', () => {
  const axiosMock = vi.fn((config) => axiosMock.request(config));
  axiosMock.request = vi.fn();
  return {
    default: axiosMock,
    request: axiosMock.request,
  };
});

vi.mock('../../src/helper/logger.helper.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('GitHub Search API client', () => {
  let client;
  const mockToken = 'github-token-12345';

  beforeEach(() => {
    client = new GitHubApiClient(mockToken);
    vi.clearAllMocks();
  });

  afterEach(() => {
    try {
      vi.useRealTimers();
    } catch {}
  });

  it('sets busy while request is running, refreshes headers, and sets available after success', async () => {
    // Arrange
    const mockResponse = {
      data: { items: [] },
      headers: {
        'x-ratelimit-remaining': '10',
        'x-ratelimit-reset': (Date.now() / 1000 + 3600).toString(),
      },
    };
    let resolveRequest;
    axios.request.mockImplementation(
      () =>
        new Promise((res) => {
          resolveRequest = res;
        }),
    );
    const refreshSpy = vi.spyOn(client, '_refresh');

    // Act
    const requestPromise = client.request(
      'https://api.github.com/search/repositories?q=stars:>=1000',
    );

    // Assert
    expect(client.isBusy()).toBe(true);
    expect(client.isAuthorized()).toBe(true);

    // Act
    resolveRequest(mockResponse);
    await requestPromise;

    // Assert
    expect(client.isBusy()).toBe(false);
    expect(client.isAuthorized()).toBe(true);
    expect(refreshSpy).toHaveBeenCalledWith(mockResponse.headers);
    expect(client._logger.info).toHaveBeenCalled();
  });

  it('pauses and becomes unauthorized when remaining requests are 0', async () => {
    //Arrange
    const mockResponse = {
      data: { items: [] },
      headers: {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': (Date.now() / 1000 + 3600).toString(),
      },
    };
    axios.request.mockResolvedValueOnce(mockResponse);
    const refreshSpy = vi.spyOn(client, '_refresh');

    // Act
    await client.request(
      'https://api.github.com/search/repositories?q=stars:>=1000',
    );

    // Assert
    expect(refreshSpy).toHaveBeenCalledWith(mockResponse.headers);
    expect(client.isAuthorized()).toBe(false);
    expect(client.isBusy()).toBe(false);
    expect(client._logger.info).toHaveBeenCalled();
  });

  it('can be resumed after pause and becomes authorized again', () => {
    // Arrange
    vi.useFakeTimers();
    const future = Date.now() + 1000;
    const resumeSpy = vi.spyOn(client, '_resume');

    // Act
    client.pause(future);

    // Assert
    expect(client.isAuthorized()).toBe(false);

    // Act
    vi.advanceTimersByTime(5000);
    expect(client.isAuthorized()).toBe(true);
    expect(resumeSpy).toHaveBeenCalled();
    expect(client._logger.info).toHaveBeenCalled();

    // Cleanup
    vi.useRealTimers();
  });

  it('handles axios error when null request, sets available and becomes authorized again', async () => {
    // Arrange
    const mockError = {
      message: 'Some network error',
      response: {
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': (Date.now() / 1000 + 3600).toString(),
        },
      },
    };
    axios.request.mockRejectedValueOnce(mockError);

    // Act
    await expect(client.request(null)).rejects.toEqual(mockError);

    // Assert
    expect(client.isBusy()).toBe(false);
    expect(client._logger.error).toHaveBeenCalled();
    expect(client.isAuthorized()).toBe(false);
  });
});
