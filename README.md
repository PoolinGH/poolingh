# PoolinGH

## 📣 Description

<p>
  <img src="img/icon.png" alt="PoolinGH" width="150px" style="float: left; margin-right: 10px;"/>
  <br/>
  PoolinGH is a lightweight, easy-to-use open-source library designed to accelerate and ensure efficient mining of the <a href="https://docs.github.com/en/rest/about-the-rest-api/about-the-rest-api?apiVersion=2022-11-28">GitHub Search API</a> while taking full advantage of its potential. It enables automatic pooling of multiple tokens, parallelizes queries, optimizes queues, regulates network and API usage while respecting GitHub's limits and best practices, manages error recovery or pruning in case of deadlocks, maximizes search coverage, and monitors the progress of the process.
</p>

<p>
  ℹ️ Token pooling is a common practice in research or industry. During a joint project, team members share their tokens in order to pool their query capacity while respecting API limits and best practices.
</p>
<p>
  ℹ️ In case you're wondering, the library also works with a single token if multiple tokens are not available. This means that users always benefit from queue optimization, API and network usage regulation in line with GitHub limits and best practices, error recovery or pruning in case of deadlocks, and process progress monitoring.
</p>
<p>
  ⚠️ DISCLAIMER: This library is primarily designed to be useful. It is essential to follow certain rules, particularly regarding the GitHub Search API rate limits, authentication, and responsible token management. Adhering to these constraints ensures compliance with GitHub's policies and prevents disruptions in data collection. The authors of this library have taken all necessary measures to ensure compliance with the rules regarding API rate limits and authentication management, particularly in the case of pooling and parallelization, to name but a few. However, users of the library remain solely responsible for any consequences. The authors disclaim all responsibility in the event of misuse, abuse, circumvention, sanctions, non-compliance, or any other violation.
</p>

## 📝 How to cite?

TODO

## ▶️ Getting started

### Prerequisites

1. Node.js installation:

- [Install Node.js](https://nodejs.org/fr/download).

2. PoolinGH installation:

```shell
  npm install poolingh
```

3. GitHub Search API tokens creation:

- Generate and collect GitHub tokens from one or more active GitHub accounts. [GitHub](https://github.com/) > [Settings](https://github.com/settings/profile) > [Developer Settings](https://github.com/settings/apps) > [Personal access tokens](https://github.com/settings/personal-access-tokens) > [Generate new token](https://github.com/settings/personal-access-tokens/new) > Enter a "Token name" > Define an "Expiration" date > Select "Public Repositories (read-only)" > Click on "Generate token".

⚠️ Keep the tokens secret in any case!

⚠️ Use fine-grained personal access tokens instead of personal access tokens (classic) whenever possible.

⚠️ Use tokens from real active GitHub accounts. DO NOT CREATE FAKE ACCOUNTS!

More information: [Managing your personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

## ⭐ Usage

### Import

```js
import { GitHubApiRequest, GitHubApiClient, GitHubApiQueue } from 'poolingh';
```

### Create clients

A GitHub Search API client is associated with one GitHub access token. It allows querying the GitHub Search API as an authenticated user. Create as many clients as you have tokens.

```js
let client1 = new GitHubApiClient(YOUR_TOKEN_1);
let client2 = new GitHubApiClient(YOUR_TOKEN_2);
let client3 = new GitHubApiClient(YOUR_TOKEN_3);
// ...
```

### Create a queue

A GitHub Search API queue is a process that handles requests to the GitHub Search API while parallelizing and distributing the work across available GitHub API clients, respecting GitHub Search API's limits and best practices, and facilitating error handling and process monitoring.

```js
let queue = new GitHubApiQueue([client1, client2, client3, ...]);
```

### Create a request

A request corresponds to an HTTP call to the GitHub Search API. It contains a URL, options, and a callback function.

```js
let request = new GitHubApiRequest(
  'https://api.github.com/search/repositories?q=stars:>=10000', // YOUR URL
  {}, // YOUR OPTIONS
  (result) => {
    console.log(result);
  }, // YOUR CALLBACK FUNCTION
);
```

### Queue a request

Inserts a request at the end of the queue.

```js
queue.push(request);
```

An alternative is to insert a request at the beginning of the queue.

```js
queue.unshift(request);
```

Each method accepts one or more requests at a time.

### Start the queue

Starts the queue and invites clients to process requests one by one.

```js
queue.start();
```

Requests are processed according to the LIFO (last in, first out) strategy. When a request fails, it is sent back to the front of the queue. This prevents a request from reaching the "maximum failures per request" threshold in the event of a network problem. Except in this case, a request that reaches this threshold is aborted and removed from the queue.

### Stop the queue

Stops the queue.

```js
queue.stop();
```

### Advanced features

#### Configure a delay in a client

Depending on the current conditions, you may experience difficulties with the network or the API reactivity in case of overloading. To smooth the load, you can use the `pause(resetAt)` method to pause or delay the clients on startup or later. By default, all the clients start together. It can create a delay relative to other clients.

In this example, we space each client startup by one minute:

```js
for (let i = 1; i < queue.getClients().length; i++) {
  queue.getClients()[i].pause(Date.now() + 1000 * 60 * i);
}
```

#### Configuring the safety margin for the number of remaining requests in a client

Depending on the current conditions, it may happen that the mining script is faster than the API at updating the remaining request counter of a client. To avoid the overflow of requests sent and the risk of being flagged, you can adapt the safety margin for the number of remaining requests via the `safetyRemainingRequestCount` parameter in the constructor of the client. The default value is 5 remaining requests. This value can be increased or decreased.

In this example, we increase the value to 10.

```js
let client1 = new GitHubApiClient(YOUR_TOKEN_1, 10);
```

#### Configuring the safety margin for the resume time in a client

Depending on the current conditions, it may happen that the mining script is faster than the API at updating the resume time of a client. To avoid a premature resume of a client and the risk of being flagged, you can adapt the safety margin for the resume time via the `tokenResumeBufferTime` parameter in the constructor of the client. The default value is 2000ms. This value can be increased or decreased.

In this example, we set the `tokenResumeBufferTime` to 5s instead of the default 2s.

```js
let client1 = new GitHubApiClient(YOUR_TOKEN_1, 10, 5000);
```

#### Configuring the safety margin for the number of errors per request in the queue

Depending on the current conditions, it may happen that some requests fail in series. To save requests "credits" and avoid the risk of being flagged, you can adapt the safety margin for the number of errors per request via the `maxErrorCountPerRequest` parameter in the constructor of the queue. The default value is 5 requests. This value can be increased or decreased.

In this example, we set the `maxErrorCountPerRequest` to 10 instead of the default 5.

```js
let queue = new GitHubApiQueue([client1, client2, client3, ...], 10);
```

#### Configuring the safety margin for the total number of errors in the queue

Depending on the current conditions, it may happen that a long queuing process accumulates a large amount of failures. To save requests "credits" and avoid the risk of being flagged, you can adapt the safety margin for the number of errors per request via the `maxErrorCountInTotal` parameter in the constructor of the queue. The default value is 1000 times the `maxErrorCountPerRequest` parameter. This value can be increased or decreased.

In this example, we set the `maxErrorCountInTotal` to 20,000 instead of the default 10,000.

```js
let queue = new GitHubApiQueue([client1, client2, client3, ...], 10, 20000);
```

#### Monitoring the process through logs

The clients and the queue are decorated by an integrated logger logging the progress of the process. By default, the logs are registered in the `./logs` directory. You can change this destination via the `loggingPath` parameter in the constructor of the client and the queue. If the folder does not already exist, it will be created automatically. Four files are created: `combined.log`, `error.log`, `info.log`, and `warn.log`. A log line generally includes the timestamp and the short version of the token. Then, it prints some details depending on the operation logged. For instance, it logs when a queue starts and stops, the URL with the current rate limit of a request when it is consumed, when a client is paused or resumed with the resuming time. It also logs all the errors like when a queue hits the maximum amount of failed requests, when a request fails and when it is retried or aborted.

In this example, we set the logs folder destination to `./mining/logs`.

```js
let client1 = new GitHubApiClient(YOUR_TOKEN_1, 10, 5000, './mining/logs');
// ...
let queue = new GitHubApiQueue([client1, client2, client3, ...], 10, 20000, './mining/logs');
```

### Examples

A few examples, basic and advanced, are available [here](https://github.com/PoolinGH/poolingh-examples).

## 👩‍💻 Development details

### Structure of this repository

- `README.md`: This file.
- `LICENSE.txt`: The license.
- `/src`: The implementation.
  - `/helper`: The implementation of the helpers used for the GitHub Search API mining.
  - `/model`: The implementation of the models used for the GitHub Search API mining.
- `/tests`: The unit tests.
  - `/helper`: The unit tests of the helpers.
  - `/model`: The unit tests of the models.
- `package.json`: Metadata and dependencies definition.

### Build

Launch the build step with the following command.

```bash
npm run build
```

The build step will create the `dist` folder with the sources.

Launch the pack step with the following command.

```bash
npm pack
```

The pack step will create the archive `.tgz` with the sources.

### Unit tests

Unit test suites are set up thanks to the [Vitest](https://www.npmjs.com/package/vitest) framework.

The tests are specified in the `/tests` directory and are named following the `*.test.js` pattern.

#### Launching the tests

Launch the unit tests with the following command.

```bash
npm run test
```

## 🪛 Technical details

### Technologies

- JavaScript
- NodeJS v18.12.1

### Libraries

- [dotenv](https://www.npmjs.com/package/dotenv) is the package for environment variables.
- [winston](https://www.npmjs.com/package/winston) is the package for logging.
- [axios](https://www.npmjs.com/package/axios) is the package for HTTP calls.
- [vitest](https://www.npmjs.com/package/vitest) is the package for unit tests.

# Further reading

- [About the REST API](https://docs.github.com/en/rest/about-the-rest-api/about-the-rest-api?apiVersion=2022-11-28)
- [About search](https://docs.github.com/en/rest/search/search?apiVersion=2022-11-28#about-search)
- [Getting started with the REST API](https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api?apiVersion=2022-11-28)
- [Authenticating to the REST API](https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api?apiVersion=2022-11-28)
- [Keeping your API credentials secure](https://docs.github.com/en/rest/authentication/keeping-your-api-credentials-secure?apiVersion=2022-11-28)
- [Rate limits for the REST API](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28)
- [Using pagination in the REST API](https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api?apiVersion=2022-11-28)
- [Troubleshooting the REST API](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api?apiVersion=2022-11-28)
- [Best practices for using the REST API](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?apiVersion=2022-11-28)
- [Limitations on query length](https://docs.github.com/en/rest/search/search?apiVersion=2022-11-28#limitations-on-query-length)
