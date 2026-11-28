import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { config, webhooksEnabled } from './config.js';

/**
 * Webhooks.
 *
 * Every delivery is a POST with a JSON body and these headers:
 *   X-Crafter-Event      event name, for example `app.uninstalled`
 *   X-Crafter-Delivery   delivery id; the same id on every retry, use it to drop duplicates
 *   X-Crafter-Timestamp  unix seconds
 *   X-Crafter-Signature  t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>
 *                        (after a secret rotation there can be several v1 values; accept the request if ANY matches)
 *
 * Answer with a 2xx within 10 seconds. Anything else is retried with exponential backoff (about 12 hours in total).
 */

/** Reject signatures older (or newer) than this. */
export const TOLERANCE_SECONDS = 5 * 60;

/** Parses `t=...,v1=...,v1=...`. */
export function parseSignatureHeader(header) {
  let timestamp = NaN;
  const signatures = [];
  for (const part of String(header ?? '').split(',')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key === 't' && /^\d+$/.test(value)) timestamp = Number(value);
    else if (key === 'v1' && /^[0-9a-f]{64}$/i.test(value)) signatures.push(Buffer.from(value, 'hex'));
  }
  return { timestamp, signatures };
}

/**
 * Verifies the signature over the RAW request body (the exact bytes received, before any JSON parsing).
 * @param {Buffer} rawBody
 * @param {string} header X-Crafter-Signature
 * @param {string[]} secrets the endpoint's signing secret(s)
 */
export function verifySignature(rawBody, header, secrets, nowSeconds = Math.floor(Date.now() / 1000)) {
  const { timestamp, signatures } = parseSignatureHeader(header);
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > TOLERANCE_SECONDS) return false;
  return secrets.some((secret) => {
    const expected = createHmac('sha256', secret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest();
    // timingSafeEqual needs equal lengths; the length is not secret (always 32 bytes)
    return signatures.some((given) => given.length === expected.length && timingSafeEqual(given, expected));
  });
}

/**
 * Makes sure the store has exactly one webhook endpoint of this app pointing at our URL, and that we know its secret.
 *
 * Endpoints belong to the installation and survive an uninstall. A reinstall therefore finds the old endpoint: we keep
 * it when we still have its secret, otherwise we delete it and create a new one (the secret is returned only on create).
 *
 * Note: `app.installed` is queued while the code is exchanged, before the app can create an endpoint, so a first
 * install never delivers it. Treat a successful code exchange as "installed".
 *
 * @param {import('./api.js').CrafterApi} api
 * @param {import('./token-store.js').TokenStore} store
 */
export async function ensureWebhookEndpoint(api, store, websiteId) {
  if (!webhooksEnabled) return { skipped: 'APP_BASE_URL is not https' };
  const scopes = (store.getInstallation(websiteId)?.scope ?? '').split(' ');
  if (!scopes.includes('webhooks:write')) return { skipped: 'webhooks:write was not granted' };

  const known = store.getWebhookEndpoint(websiteId);
  const { data: existing } = await api.listWebhookEndpoints(websiteId);
  let keep = null;
  for (const endpoint of existing) {
    if (!keep && known && endpoint.id === known.id && endpoint.url === config.webhookUrl) keep = endpoint;
    else if (endpoint.url === config.webhookUrl) await api.deleteWebhookEndpoint(websiteId, endpoint.id);
  }
  if (keep) return { endpointId: keep.id, reused: true };

  const created = await api.createWebhookEndpoint(
    websiteId,
    {
      url: config.webhookUrl,
      // Every event must be in the manifest's `events`, and its scope must be granted
      events: ['app.installed', 'app.uninstalled', 'order.paid'].filter(
        (event) => event.startsWith('app.') || scopes.includes('read_orders'),
      ),
      // One endpoint per mode: true = live events only, false = test events only
      livemode: true,
      description: 'Example app endpoint',
    },
    // One key per attempt: a retry of this same request returns the first result instead of a second endpoint
    randomUUID(),
  );
  await store.saveWebhookEndpoint(websiteId, {
    id: created.id,
    secret: created.secret,
    livemode: created.livemode,
  });
  return { endpointId: created.id, reused: false };
}
