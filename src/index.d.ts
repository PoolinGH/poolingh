export declare class GitHubApiRequest {
  constructor(
    url: string,
    params?: Record<string, any>,
    callback?: (results: any) => any,
  );

  getUrl(): string;
  getParams(): Record<string, any>;
  getCallback(): (results: any) => any;
  runCallback(results: any): any;
}

export declare class GitHubApiClient {
  constructor(
    token: string,
    safetyRemainingRequestCount?: number,
    tokenResumeBufferTime?: number,
    loggingPath?: string,
  );

  getToken(): string;
  isAuthorized(): boolean;
  isBusy(): boolean;
  request(url: string, params?: Record<string, any>): Promise<any>;
  pause(resetAt: Date | number): void;
}

export declare class GitHubApiQueue {
  constructor(
    clients: GitHubApiClient[],
    maxErrorCountPerRequest?: number,
    maxErrorCountInTotal?: number,
    loggingPath?: string,
  );

  getClients(): GitHubApiClient[];
  getQueueLength(): number;
  getRequestFailCount(): number;
  push(...gitHubApiRequest: GitHubApiRequest[]): void;
  unshift(...gitHubApiRequest: GitHubApiRequest[]): void;
  start(): void;
  stop(): void;
}
