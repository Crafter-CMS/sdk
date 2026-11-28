import { createPublicKey, verify } from 'node:crypto';
import { config } from './config.js';

/**
 * Embedded page session token.
 *
 * When a store owner opens the app inside the Crafter panel, the panel loads the embed URL in an iframe with
 * `?session=<JWT>&store=<websiteId>&lang=<tr|en>`. The JWT is signed with Ed25519 (alg EdDSA) and lives 60 seconds.
 * Verify it with the public keys from `GET {CRAFTER_API_URL}/apps/.well-known/jwks.json`. Node `crypto` only, no JWT
 * library.
 *
 * Claims: iss (Crafter API URL), aud (your client id), sub (pseudonymous user id, stable per user and app), store
 * (websiteId), app (app id), iat, exp, jti.
 */

const JWKS_TTL_MS = 5 * 60 * 1000;
/** An unknown `kid` may trigger a refetch at most this often (key rotation, without hammering the endpoint). */
const JWKS_MIN_REFETCH_MS = 30 * 1000;
const CLOCK_SKEW_SECONDS = 5;

export class SessionTokenError extends Error {}

class JwksCache {
  constructor(url) {
    this.url = url;
    this.keys = new Map();
    this.fetchedAt = 0;
  }

  async refresh() {
    const response = await fetch(this.url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new SessionTokenError(`JWKS request failed with ${response.status}`);
    const { keys } = await response.json();
    const next = new Map();
    for (const jwk of Array.isArray(keys) ? keys : []) {
      if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || typeof jwk.x !== 'string' || typeof jwk.kid !== 'string')
        continue;
      next.set(jwk.kid, createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: jwk.x }, format: 'jwk' }));
    }
    this.keys = next;
    this.fetchedAt = Date.now();
  }

  async get(kid) {
    const age = Date.now() - this.fetchedAt;
    if (age > JWKS_TTL_MS || (!this.keys.has(kid) && age > JWKS_MIN_REFETCH_MS)) await this.refresh();
    return this.keys.get(kid) ?? null;
  }
}

const jwks = new JwksCache(`${config.apiUrl}/apps/.well-known/jwks.json`);

/** jti values already used, until their token expires: a session URL works once. */
const usedJti = new Map();

function decodePart(part) {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  } catch {
    throw new SessionTokenError('malformed token');
  }
}

/**
 * Verifies the token and returns its claims, or throws SessionTokenError.
 * @param {string} token value of the `session` query parameter
 * @param {{ store?: string }} [expected] the `store` query parameter, which must match the signed `store` claim
 */
export async function verifySessionToken(token, expected = {}) {
  if (typeof token !== 'string' || token.length > 4096) throw new SessionTokenError('missing token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new SessionTokenError('malformed token');
  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  const header = decodePart(encodedHeader);
  // Pin the algorithm: never let the token choose how it is checked
  if (header.alg !== 'EdDSA' || typeof header.kid !== 'string') throw new SessionTokenError('unexpected header');
  const key = await jwks.get(header.kid);
  if (!key) throw new SessionTokenError('unknown signing key');

  const valid = verify(
    null,
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
    key,
    Buffer.from(encodedSignature, 'base64url'),
  );
  if (!valid) throw new SessionTokenError('bad signature');

  const claims = decodePart(encodedPayload);
  const now = Math.floor(Date.now() / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(config.clientId)) throw new SessionTokenError('wrong audience');
  if (claims.iss !== config.sessionIssuer) throw new SessionTokenError('wrong issuer');
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_SECONDS < now) throw new SessionTokenError('expired');
  if (typeof claims.iat !== 'number' || claims.iat - CLOCK_SKEW_SECONDS > now)
    throw new SessionTokenError('issued in the future');
  if (typeof claims.store !== 'string' || !claims.store) throw new SessionTokenError('no store');
  if (expected.store !== undefined && expected.store !== claims.store) throw new SessionTokenError('store mismatch');

  if (typeof claims.jti === 'string') {
    for (const [jti, exp] of usedJti) if (exp + CLOCK_SKEW_SECONDS < now) usedJti.delete(jti);
    if (usedJti.has(claims.jti)) throw new SessionTokenError('token already used');
    usedJti.set(claims.jti, claims.exp);
  }
  return claims;
}
