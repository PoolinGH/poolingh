import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import { GitHubApiQueue } from '../../src/helper/github-api-queue.helper.js';
import { GitHubApiRequest } from '../../src/model/github-api-request.model.js';

// Mocks

vi.mock('../../src/helper/logger.helper.js', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('GitHub Search API Queue', () => {
  let queue;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    try {
      vi.useRealTimers();
    } catch (error) {
      // this is for the linter to ignore
    }
  });

  it('Returns clients', () => {
    // Arrange
    queue = new GitHubApiQueue([{}, {}, {}]);

    // Act & Assert
    expect(queue.getClients().length).toBe(3);
  });

  it('Pushes one request', () => {
    // Arrange
    queue = new GitHubApiQueue([]);
    const request = new GitHubApiRequest(
      'https://api.github.com/search/repositories?q=stars:>=1000',
    );

    // Act
    queue.push(request);

    // Assert
    expect(queue.getQueueLength()).toBe(1);
  });

  it('Pushes multiple requests', () => {
    // Arrange
    queue = new GitHubApiQueue([]);
    const request1 = new GitHubApiRequest(
      'https://api.github.com/search/repositories?q=stars:>=1000',
    );
    const request2 = new GitHubApiRequest(
      'https://api.github.com/search/repositories?q=stars:<1000',
    );

    // Act
    queue.push(request1, request2);

    // Assert
    expect(queue.getQueueLength()).toBe(2);
  });

  it('Unshifts one request', () => {
    // Arrange
    queue = new GitHubApiQueue([]);
    const request1 = new GitHubApiRequest(
      'https://api.github.com/search/repositories?q=stars:>=1000',
    );
    const request2 = new GitHubApiRequest(
      'https://api.github.com/search/repositories?q=stars:<1000',
    );
    const request3 = new GitHubApiRequest(
      'https://api.github.com/search/repositories?q=stars:1',
    );

    // Act
    queue.push(request1, request2);
    queue.unshift(request3);

    // Assert
    expect(queue.getQueueLength()).toBe(3);
    expect(queue._queries[0]).toBe(request3);
  });

  it('Unshifts several requests', () => {
    // Arrange
    queue = new GitHubApiQueue([]);
    const request1 = new GitHubApiRequest(
      'https://api.github.com/search/repositories?q=stars:>=1000',
    );
    const request2 = new GitHubApiRequest(
      'https://api.github.com/search/repositories?q=stars:<1000',
    );
    const request3 = new GitHubApiRequest(
      'https://api.github.com/search/repositories?q=stars:1',
    );
    const request4 = new GitHubApiRequest(
      'https://api.github.com/search/repositories?q=stars:2',
    );

    // Act
    queue.push(request1, request2);
    queue.unshift(request3, request4);

    // Assert
    expect(queue.getQueueLength()).toBe(4);
    expect(queue._queries[0]).toBe(request3);
    expect(queue._queries[1]).toBe(request4);
    expect(queue._queries[2]).toBe(request1);
    expect(queue._queries[3]).toBe(request2);
  });

  it('Starts a queue', () => {
    // Arrange
    queue = new GitHubApiQueue([]);

    // Act
    queue.start();

    // Assert
    expect(queue._logger.info).toHaveBeenCalledWith('[queue] Start');
    queue.stop();
  });

  it('Stops a queue', () => {
    // Arrange
    queue = new GitHubApiQueue([]);

    // Act
    queue.stop();

    // Assert
    expect(queue._logger.info).toHaveBeenCalledWith('[queue] Stop');
    expect(queue._isStopped).toBe(true);
  });

  it('Stops a queue when the total error count is too big', () => {
    // Arrange
    queue = new GitHubApiQueue([]);
    queue._errorCount = 1000;
    queue._maxErrorCountInTotal = 1000;

    // Act
    queue.start();

    // Assert
    expect(queue._logger.error).toHaveBeenCalledWith(
      '[queue] Error: error count too big',
    );
    queue.stop();
  });

  it('Pauses the queue when there are no clients', async () => {
    // Arrange
    vi.useFakeTimers();
    queue = new GitHubApiQueue([]);
    const request = new GitHubApiRequest(
      'https://api.github.com/search/repositories?q=stars:>=1000',
    );
    queue.push(request);

    // Act
    queue.start();

    // Assert
    expect(queue.getQueueLength()).toBe(1);

    // Act
    vi.advanceTimersByTime(2500);

    // Assert
    expect(queue.getQueueLength()).toBe(1);

    // Cleanup
    queue.stop();
    vi.useRealTimers();
  });

  it('Pauses the queue when all the clients are busy', async () => {
    // Arrange
    vi.useFakeTimers();
    const client = {
      isAuthorized: () => true,
      isBusy: () => true,
      request: vi.fn(() => Promise.resolve('result')),
    };
    queue = new GitHubApiQueue([client]);
    const request1 = new GitHubApiRequest(
      'https://api.github.com/search/repositories?q=stars:>=1000',
    );
    queue.push(request1);

    // Act
    queue.start();

    // Assert
    expect(queue.getQueueLength()).toBe(1);

    // Act
    vi.advanceTimersByTime(2500);

    // Assert
    expect(queue.getQueueLength()).toBe(1);

    // Cleanup
    queue.stop();
    vi.useRealTimers();
  });

  it('Pauses the queue when all the clients are not authorized', async () => {
    // Arrange
    vi.useFakeTimers();
    const client = {
      isAuthorized: () => false,
      isBusy: () => false,
      request: vi.fn(() => Promise.resolve('result')),
    };
    queue = new GitHubApiQueue([client]);
    const request1 = new GitHubApiRequest(
      'https://api.github.com/search/repositories?q=stars:>=1000',
    );
    queue.push(request1);

    // Act
    queue.start();

    // Assert
    expect(queue.getQueueLength()).toBe(1);

    // Act
    vi.advanceTimersByTime(2500);
    await Promise.resolve();

    // Assert
    expect(queue.getQueueLength()).toBe(1);

    // Cleanup
    queue.stop();
    vi.useRealTimers();
  });

  it('Unshifts a request by a client and processes it', async () => {
    // Arrange
    vi.useFakeTimers();
    const client = {
      isAuthorized: () => true,
      isBusy: () => false,
      request: vi.fn(() => Promise.resolve('result')),
    };
    queue = new GitHubApiQueue([client]);
    const request1 = new GitHubApiRequest(
      'https://api.github.com/search/repositories?q=stars:>=1000',
    );
    queue.push(request1);

    // Act
    queue.start();
    vi.advanceTimersByTime(2500);
    await Promise.resolve();

    // Assert
    expect(client.request).toHaveBeenCalledTimes(1);
    expect(queue.getQueueLength()).toBe(0);

    // Cleanup
    queue.stop();
    vi.useRealTimers();
  });

  it('Encounters an error, increments the count, and repushes the request', async () => {
    // Arrange
    vi.useFakeTimers();
    const client = {
      isAuthorized: () => true,
      isBusy: () => false,
      request: vi.fn(() => Promise.reject(new Error('Error'))),
    };
    queue = new GitHubApiQueue([client], 5);
    const request1 = new GitHubApiRequest('https://api.github.com/search/404');
    queue.push(request1);

    // Act
    queue.start();
    vi.advanceTimersByTime(2500);
    await Promise.resolve();
    vi.advanceTimersByTime(2500);
    await Promise.resolve();
    vi.advanceTimersByTime(2500);
    await Promise.resolve();
    vi.advanceTimersByTime(2500);
    await Promise.resolve();

    // Assert
    expect(queue._errorCount).toBe(1);
    expect(queue.getQueueLength()).toBe(1);
    expect(queue._logger.info).toHaveBeenCalledWith(
      '[queue] Retry: url=https://api.github.com/search/404',
    );

    // Cleanup
    queue.stop();
    vi.useRealTimers();
  });

  it('Encounters a recurring error and eventually abandon the request', async () => {
    // Arrange
    vi.useFakeTimers();
    const client = {
      isAuthorized: () => true,
      isBusy: () => false,
      request: vi.fn(() => Promise.reject(new Error('Error'))),
    };
    queue = new GitHubApiQueue([client], 2);
    const request1 = new GitHubApiRequest('https://api.github.com/search/404');
    queue.push(request1);

    // Act
    queue.start();
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(2500);
      await Promise.resolve();
      await Promise.resolve();
    }

    // Assert
    expect(
      queue._errorUrls['https://api.github.com/search/404'],
    ).toBeGreaterThanOrEqual(2);
    expect(queue.getRequestFailCount()).toBe(1);
    expect(queue.getQueueLength()).toBe(0);
    expect(queue._logger.error).toHaveBeenCalledWith(
      '[queue] Abort: url=https://api.github.com/search/404',
    );

    // Cleanup
    queue.stop();
    vi.useRealTimers();
  });

  it('Returns the length of the queue', () => {
    // Arrange
    queue = new GitHubApiQueue([]);
    queue.push(
      new GitHubApiRequest(
        'https://api.github.com/search/repositories?q=stars:>=1000',
      ),
      new GitHubApiRequest(
        'https://api.github.com/search/repositories?q=stars:<1000',
      ),
    );

    // Act & Assert
    expect(queue.getQueueLength()).toBe(2);
  });

  it('Returns the total number of failed requests', () => {
    // Arrange
    queue = new GitHubApiQueue([], 2);
    queue._errorUrls = {
      'https://api.github.com/search/repositories?q=stars:1': 1, // OK
      'https://api.github.com/search/repositories?q=stars:2': 2, // FAIL
      'https://api.github.com/search/repositories?q=stars:3': 3, // FAIL
    };

    // Act & Assert
    expect(queue.getRequestFailCount()).toBe(2);
  });
});
