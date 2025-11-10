// IMPORTS

import { Logger } from './logger.helper.js';

/**
 * Manages the GitHub Search API queueing shared between multiple GitHub Search API clients.
 */
export class GitHubApiQueue {
  /**
   * Creates a GitHub Search API queue shared between multiple GitHub Search API clients.
   * @param {Array[GitHubApiClient]} clients The GitHub Search API clients.
   * @param {Number} maxErrorCountPerRequest The error count limit per request before aborting. Default is 5 errors.
   * @param {Number} maxErrorCountInTotal The total error count limit before stopping the entire queue. Default is maxErrorCountPerRequest * 1000 errors.
   * @param {string} loggingPath The path to the log destination folder. Default is './logs'. The folder is created if it does not already exist.
   */
  constructor(
    clients,
    maxErrorCountPerRequest = 5,
    maxErrorCountInTotal = maxErrorCountPerRequest * 1000,
    loggingPath = './logs',
  ) {
    this._clients = clients;
    this._queries = [];
    this._isStopped = false;
    this._errorCount = 0;
    this._errorUrls = {};
    this._maxErrorCountPerRequest = maxErrorCountPerRequest;
    this._maxErrorCountInTotal = maxErrorCountInTotal;
    this._logger = new Logger(loggingPath);
  }

  /**
   * Returns the clients registered in the queue.
   * @returns The clients.
   */
  getClients() {
    return this._clients;
  }

  /**
   * Returns the number of requests in the queue.
   * @returns The number of requests in the queue.
   */
  getQueueLength() {
    return this._queries.length;
  }

  /**
   * Returns the number of failed requests that have been abandoned.
   * @returns The number of failed requests that have been abandoned.
   */
  getRequestFailCount() {
    return Object.keys(this._errorUrls).reduce(
      (acc, url) =>
        this._errorUrls[url] >= this._maxErrorCountPerRequest ? acc + 1 : acc,
      0,
    );
  }

  /**
   * Pushes one or several requests to the last position of the queue.
   * @param {Array[GitHubApiRequest]} gitHubApiRequest The GitHub Search API request.
   */
  push(...gitHubApiRequest) {
    this._queries.push(...gitHubApiRequest);
  }

  /**
   * Pushes one or several requests to the first position of the queue.
   * @param {Array[GitHubApiRequest]} gitHubApiRequest The GitHub Search API request.
   */
  unshift(...gitHubApiRequest) {
    this._queries.unshift(...gitHubApiRequest);
  }

  /**
   * Starts the queue processing.
   */
  start() {
    this._logger.info('[queue] Start');
    this._process();
  }

  /**
   * Stops the queue processing.
   */
  stop() {
    this._logger.info('[queue] Stop');
    this._isStopped = true;
  }

  /**
   * Processes the queue.
   */
  _process() {
    const queue = () => {
      // Stops the process if the stop flag is enabled.
      if (this._isStopped) return;

      // Stops if the error count is too high.
      if (this._errorCount >= this._maxErrorCountInTotal) {
        this._logger.error('[queue] Error: error count too big');
        return;
      }

      // Filters out the available clients.
      const availableClients = this._clients.filter(
        (client) => client.isAuthorized() && !client.isBusy(),
      );

      // Waits if no client is available or if the queue is empty.
      if (this._queries.length === 0 || availableClients.length === 0) {
        //this.logger.info(`[queue] Waiting 1 sec...`);
        setTimeout(queue, 1000);
        return;
      }

      // Consumes and performs each request from the queue with available clients and returns the result in the callback.
      for (const client of availableClients) {
        if (this._queries.length === 0) break; // Stops if no more requests.

        const request = this._queries.pop();

        client
          .request(request.getUrl(), request.getParams())
          .then((result) => {
            request.runCallback(result);
          })
          .catch((error) => {
            this._logger.error(`[queue] Error: ${error.message}`);

            // Error rates counters.
            this._errorCount++;
            if (!this._errorUrls[request.getUrl()]) {
              this._errorUrls[request.getUrl()] = 1; // Flags the request for error tracking and prevents eventual future idempotent errors.
            } else {
              this._errorUrls[request.getUrl()] += 1; // Increments the request error flag to prevents eventual future idempotent errors.
            }

            // Error rates management.
            if (
              this._errorUrls[request.getUrl()] < this._maxErrorCountPerRequest
            ) {
              this._logger.info(`[queue] Retry: url=${request.getUrl()}`);
              this.unshift(request); // Repushes the request if the request was not flagged too much.
            } else {
              this._logger.error(
                `[queue] Abort: url=${request.getUrl()}`, // Aborts request after maximum number of attempts.
              );
            }
          })
          .finally(() => {
            setTimeout(queue, 0); // Loops.
          });
      }
    };
    queue(); // Queue entry point.
  }
}
