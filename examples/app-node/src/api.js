import { randomUUID } from 'node:crypto';
import { config } from './config.js';

/**
 * Client for the public REST API (/v1). The store is always the one the token was issued for; you never pass a store
 * id. Errors come as `{ error: { type, message, param, details, requestId } }`.
 *
 * Rate limits: 120 requests per minute per installation (and a per-app total). A 429 carries `Retry-After` in seconds.
 */

export class CrafterApiError extends Error {
  constructor(status, body, headers) {
    const error = body?.error ?? {};
    super(`${status} ${error.type ?? 'api_error'}: ${error.message ?? 'Request failed'}`);
    this.status = status;
    this.type = error.type ?? null;
    this.param = error.param ?? null;
    this.details = error.details ?? null;
    this.requestId = error.requestId ?? headers?.get('x-request-id') ?? null;
  }
}

/** Longest Retry-After the example waits for inline; anything longer is returned to the caller. */
const MAX_INLINE_WAIT_SECONDS = 30;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class CrafterApi {
  /** @param {import('./oauth.js').TokenManager} tokens */
  constructor(tokens) {
    this.tokens = tokens;
  }

  /**
   * One request for one store. Refreshes the access token once on 401 and waits once on 429 (Retry-After).
   * @param {string} websiteId store the token belongs to
   * @param {string} path for example `/store` or `/orders?limit=5`
   */
  async request(websiteId, path, { method = 'GET', body, idempotencyKey } = {}) {
    let refreshed = false;
    let waited = false;
    for (;;) {
      const token = await this.tokens.accessToken(websiteId, { forceRefresh: refreshed });
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Crafter-Version': config.apiVersion,
      };
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      // Every POST needs an Idempotency-Key; reuse the same key when you retry the same request
      if (method === 'POST') headers['Idempotency-Key'] = idempotencyKey ?? randomUUID();

      const response = await fetch(`${config.v1Url}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await response.json().catch(() => null);
      if (response.ok) return json;

      const error = new CrafterApiError(response.status, json, response.headers);
      // Expired between our check and the call, or revoked: one refresh. A suspended or uninstalled app stays 401.
      if (response.status === 401 && error.type === 'app_token_invalid' && !refreshed) {
        refreshed = true;
        continue;
      }
      if (response.status === 429 && !waited) {
        const retryAfter = Number(response.headers.get('retry-after'));
        if (Number.isFinite(retryAfter) && retryAfter <= MAX_INLINE_WAIT_SECONDS) {
          waited = true;
          await sleep(Math.max(1, retryAfter) * 1000);
          continue;
        }
      }
      throw error;
    }
  }

  retrieveStore(websiteId) {
    return this.request(websiteId, '/store');
  }

  /** Newest first. `starting_after` = id of the last order of the previous page. */
  listOrders(websiteId, { limit = 10, startingAfter, status } = {}) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (startingAfter) query.set('starting_after', startingAfter);
    if (status) query.set('status', status);
    return this.request(websiteId, `/orders?${query}`);
  }

  // Optional: extra webhook endpoints next to the app-level one (scope webhooks:write). Not used by this example.

  listWebhookEndpoints(websiteId) {
    return this.request(websiteId, '/webhook_endpoints');
  }

  /** The response is the only time the signing secret is returned. */
  createWebhookEndpoint(websiteId, input, idempotencyKey) {
    return this.request(websiteId, '/webhook_endpoints', { method: 'POST', body: input, idempotencyKey });
  }

  deleteWebhookEndpoint(websiteId, id) {
    return this.request(websiteId, `/webhook_endpoints/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}
