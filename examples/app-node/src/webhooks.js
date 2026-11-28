import { createHmac, timingSafeEqual } from 'node:crypto';

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
 * Where they come from: the Webhook URL of the app in the panel. On every install Crafter creates an endpoint for that
 * URL on the store, subscribed to the manifest's events that the store granted plus app.installed / app.uninstalled,
 * and signs every delivery with the app's webhook secret (the same secret for every store). Live and test-mode events
 * both arrive there; the body's `livemode` tells them apart.
 *
 * Extra endpoints (another URL, a subset of events) can be created with `POST /v1/webhook_endpoints` and the
 * `webhooks:write` scope; each of those has its own secret. This example does not need any.
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
 * @param {string[]} secrets the app's webhook secret (and the previous one during a rotation)
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
