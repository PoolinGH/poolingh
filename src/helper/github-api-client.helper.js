// IMPORTS

import { Logger } from './logger.helper.js';
import axios from 'axios';

/**
 * Manages a GitHub Search API client with a specific token.
 */
export class GitHubApiClient {
  /**
   * Creates a GitHub Search API client with a specific token.
   * @param {String} token The specific token.
   * @param {Number} safetyRemainingRequestCount The safety range of remaining requests to avoid complete freezing of the GitHub account. Default is 5 remaining requests.
   * @param {Number} tokenResumeBufferTime The additional buffer time at token resume datetime to avoid premature resume. Default is 2000ms.
   * @param {string} loggingPath The path to the log destination folder. Default is './logs'. The folder is created if it does not already exist.
   */
  constructor(
    token,
    safetyRemainingRequestCount = 5,
    tokenResumeBufferTime = 2000,
    loggingPath = './logs',
  ) {
    this._token = token;
    this._authorized = true;
    this._busy = false;
    this._remainingRequests = 0;
    this._resetAt = 0;
    this._safetyRemainingRequestCount = safetyRemainingRequestCount;
    this._tokenResumeBufferTime = tokenResumeBufferTime;
    this._logger = new Logger(loggingPath);
  }

  /**
   * Gets a shortened version of the token.
   * @returns {string} The shortened token.
   */
  getToken() {
    return this._token.substring(this._token.length - 5);
  }

  /**
   * Tells whether the client is authorized for processing a request, meaning if it has enough remaining requests.
   * @returns True if the client is authorized; false otherwise.
   */
  isAuthorized() {
    return this._authorized;
  }

  /**
   * Tells whether the client is busy or not
   * @returns True if the client is busy; false otherwise.
   */
  isBusy() {
    return this._busy;
  }

  /**
   * Performs a request to the GitHub Search API with the client.
   * @param {string} url The request URL.
   * @param {Object} params The request parameters.
   * @returns {Promise<any>} The response data.
   */
  request(url, params = {}) {
    // Updates busy status.
    this._busy = true;
    return axios({
      url,
      method: params.method || 'GET',
      headers: {
        Authorization: `token ${this._token}`,
        Accept: 'application/vnd.github.v3+json',
        ...params.headers,
      },
      data: params.body || null,
    })
      .then((response) => {
        // Updates the rate limit after each request to determine whether the client is ready for the next request.
        this._refresh(response?.headers);

        // Updates busy status.
        this._busy = false;

        // Returns the data.
        this._logger.info(`[client-${this.getToken()}] Query: url=${url}`);

        return response;
      })
      .catch((error) => {
        // Updates the rate limit after each request to determine whether the client is ready for the next request.
        this._refresh(error?.response?.headers);

        // Updates busy status.
        this._busy = false;

        // Returns the error.
        this._logger.info(`[client-${this.getToken()}] Query: url=${url}`);
        this._logger.error(
          `[client-${this.getToken()}] Error: ${error.message}`,
        );
        return Promise.reject(error);
      });
  }

  /**
   * Updates the rate limit of the client (based on the token) and changes its availability if necessary.
   * @param {Object} headers The headers of the request.
   * @returns {void}
   */
  _refresh(headers) {
    if (
      headers &&
      headers['x-ratelimit-remaining'] &&
      headers['x-ratelimit-reset']
    ) {
      this._remainingRequests = Number.parseInt(
        headers['x-ratelimit-remaining'],
      );
      this._resetAt = Number.parseInt(headers['x-ratelimit-reset']) * 1000; // * 1000 to convert seconds to milliseconds.
      // Pauses until the reset time if the client has no remaining requests.
      if (this._remainingRequests - this._safetyRemainingRequestCount <= 0) {
        this.pause(this._resetAt);
      }
      this._logger.info(
        `[client-${this.getToken()}] Rate limit: rate_limit=${this._remainingRequests}`,
      );
      this._logger.info(
        `[client-${this.getToken()}] Reset time: reset_time=${new Date(this._resetAt).toISOString()}`,
      );
    } else {
      this.pause(Date.now() + 1000 * 60); // Pauses for 1 minute.
    }
  }

  /**
   * Pauses the client until the reset time. The resuming is automatically defined based on the reset time.
   * @param {Date} resetAt The reset date time at which the client will be authorized again.
   * @returns {void}
   */
  pause(resetAt) {
    // Pauses the client.
    this._authorized = false;
    this._logger.info(
      `[client-${this.getToken()}] Pause: reset_at=${new Date(resetAt).toISOString()}`,
    );
    // Plans the client resume after the reset time.
    setTimeout(
      () => {
        this._resume();
        this._logger.info(`[client-${this.getToken()}] Resume`);
      },
      resetAt - Date.now() + this._tokenResumeBufferTime,
    );
  }

  /**
   * Resumes the client after a pause period.
   */
  _resume() {
    this._authorized = true;
  }
}
