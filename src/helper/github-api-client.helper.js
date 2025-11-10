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
    this._resumeTimer = null;
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
   * Performs a request to the GitHub API with the client.
   * Automatically handles rate limiting and pauses the client when necessary.
   * Handles 403 and 429 rate limit errors explicitly using Retry-After header or stored reset time.
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
        Authorization: `Bearer ${this._token}`,
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

        if (error?.response?.status === 403 || error?.response?.status === 429) {
          const retryAfter = error?.response?.headers['retry-after'];
          if (retryAfter) {
            // If Retry-After header is present, use it
            const resetTime = Date.now() + parseInt(retryAfter) * 1000;
            this._logger.warn(
              `[client-${this.getToken()}] Rate limit exceeded (${error.response.status}), pausing until ${new Date(resetTime).toISOString()}`,
            );
            this.pause(resetTime);
          } else if (this._resetAt > 0) {
            this._logger.warn(
              `[client-${this.getToken()}] Rate limit exceeded (${error.response.status}), using stored reset time`,
            );
            this.pause(this._resetAt);
          }
        }

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
   * Only pauses the client when rate limit headers indicate exhaustion.
   * Missing headers will only trigger a warning, not an automatic pause.
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
        `[client-${this.getToken()}] Rate limit: rate_limit=${this._remainingRequests}, reset_time=${new Date(this._resetAt).toISOString()}`,
      );
    } else {
      this._logger.warn(
        `[client-${this.getToken()}] Rate limit headers not found in response`,
      );
    }
  }

  /**
   * Pauses the client until the reset time. The resuming is automatically defined based on the reset time.
   * If the reset time is in the past, the client resumes immediately.
   * Clears any existing resume timer to prevent memory leaks and race conditions.
   * @param {number} resetAt The reset timestamp (in milliseconds) at which the client will be authorized again.
   * @returns {void}
   */
  pause(resetAt) {
    // Pauses the client.
    this._authorized = false;

    if (this._resumeTimer !== null) {
      clearTimeout(this._resumeTimer);
      this._resumeTimer = null;
    }

    const delay = resetAt - Date.now() + this._tokenResumeBufferTime;

    if (delay <= 0) {
      this._logger.info(
        `[client-${this.getToken()}] Reset time is in the past, resuming immediately`,
      );
      this._resume();
      this._logger.info(`[client-${this.getToken()}] Resume`);
      return;
    }

    const delaySeconds = Math.floor(delay / 1000);
    const minutes = Math.floor(delaySeconds / 60);
    const seconds = delaySeconds % 60;
    const timeUntilReset = minutes > 0
      ? `${minutes}m ${seconds}s`
      : `${seconds}s`;

    this._logger.info(
      `[client-${this.getToken()}] Pause: reset_at=${new Date(resetAt).toISOString()}, reset_in=${timeUntilReset}`,
    );

    this._resumeTimer = setTimeout(
      () => {
        this._resume();
        this._logger.info(`[client-${this.getToken()}] Resume`);
      },
      delay,
    );
  }

  /**
   * Resumes the client after a pause period.
   * Clears the resume timer reference to free up memory.
   * @returns {void}
   */
  _resume() {
    this._authorized = true;
    this._resumeTimer = null; 
  }
}
