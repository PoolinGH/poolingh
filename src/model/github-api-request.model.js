/**
 * Represents a GitHub search API request.
 */
export class GitHubApiRequest {
  constructor(url, params = {}, callback = () => {}) {
    this._url = url;
    this._params = params;
    this._callback = callback;
  }

  /**
   * Gives the URL of the request.
   * @returns The URL of the request.
   */
  getUrl() {
    return this._url;
  }

  /**
   * Gives the parameters of the request.
   * @returns The parameters of the request.
   */
  getParams() {
    return this._params;
  }

  /**
   * Gives the callback function to execute on given results.
   * @returns The callback function to execute on results.
   */
  getCallback() {
    return this._callback;
  }

  /**
   * Runs the callback function to execute on given results.
   * @returns The callback function to execute on results.
   */
  runCallback(results) {
    return this._callback(results);
  }
}
