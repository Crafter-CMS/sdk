import { createHash, randomBytes } from 'node:crypto';
import { config } from './config.js';

/**
 * OAuth 2.0 authorization code flow with PKCE (S256), against:
 *   GET  {CRAFTER_API_URL}/apps/oauth/authorize   (redirects the owner to the panel consent page)
 *   POST {CRAFTER_API_URL}/apps/oauth/token       (authorization_code / refresh_token)
 *   POST {CRAFTER_API_URL}/apps/oauth/revoke      (RFC 7009)
 *
 * Token lifetimes: authorization code 120 s (one use), access token 1 hour, refresh token 90 days and rotated on every
 * use. Presenting an already-rotated refresh token again (after a short grace window) revokes the whole grant.
 */

export class OAuthError extends Error {
  constructor(status, body) {
    super(`OAuth error ${status}: ${body?.error ?? body?.type ?? 'unknown'}`);
    this.status = status;
    /** RFC 6749 error code: invalid_grant, invalid_client, invalid_request, ... */
    this.error = body?.error ?? null;
    this.description = body?.error_description ?? null;
  }
}

/** Store needs to install the app again (grant revoked, refresh token expired or reused). */
export class ReinstallRequiredError extends Error {
  constructor(websiteId) {
    super(`The app must be installed again on store ${websiteId}`);
    this.websiteId = websiteId;
  }
}

/** RFC 7636: 32 random bytes, base64url (43 characters). */
export function createPkcePair() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/** state: 8-512 unreserved characters; base64url of random bytes fits. */
export function createState() {
  return randomBytes(24).toString('base64url');
}

export function authorizeUrl({ state, codeChallenge, store, lang }) {
  const url = new URL(`${config.apiUrl}/apps/oauth/authorize`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (store) url.searchParams.set('store', store);
  if (lang === 'en' || lang === 'tr') url.searchParams.set('lang', lang);
  return url.toString();
}

function basicAuth() {
  const id = encodeURIComponent(config.clientId);
  const secret = encodeURIComponent(config.clientSecret);
  return `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}`;
}

async function postForm(path, params) {
  const response = await fetch(`${config.apiUrl}${path}`, {
    method: 'POST',
    headers: {
      // client_secret_basic; the secret never goes into the body or a URL
      Authorization: basicAuth(),
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams(params).toString(),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new OAuthError(response.status, body);
  return body;
}

/** Code for tokens. The response also tells which store was installed (`store.id`) and the granted `scope`. */
export function exchangeCode({ code, codeVerifier }) {
  return postForm('/apps/oauth/token', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });
}

export function refreshTokens(refreshToken) {
  return postForm('/apps/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
}

/** A refresh token revokes the whole grant; an access token only itself. Unknown tokens succeed silently. */
export function revokeToken(token) {
  return postForm('/apps/oauth/revoke', { token });
}

/** Refresh this long before the access token expires. */
const REFRESH_SKEW_MS = 60 * 1000;

/**
 * Hands out a valid access token per store and refreshes it when needed. Refreshes are single-flight per store: two
 * parallel requests never send the same refresh token twice (that would look like token theft and revoke the grant).
 */
export class TokenManager {
  constructor(store) {
    this.store = store;
    this.inFlight = new Map();
  }

  async accessToken(websiteId, { forceRefresh = false } = {}) {
    const installation = this.store.getInstallation(websiteId);
    if (!installation) throw new ReinstallRequiredError(websiteId);
    if (!forceRefresh && installation.accessTokenExpiresAt - REFRESH_SKEW_MS > Date.now())
      return installation.accessToken;
    const refreshed = await this.refresh(websiteId);
    return refreshed.accessToken;
  }

  refresh(websiteId) {
    const running = this.inFlight.get(websiteId);
    if (running) return running;
    const task = this.doRefresh(websiteId).finally(() => this.inFlight.delete(websiteId));
    this.inFlight.set(websiteId, task);
    return task;
  }

  async doRefresh(websiteId, attempt = 0) {
    const installation = this.store.getInstallation(websiteId);
    if (!installation || installation.refreshTokenExpiresAt <= Date.now()) {
      await this.store.deleteInstallation(websiteId);
      throw new ReinstallRequiredError(websiteId);
    }
    try {
      const response = await refreshTokens(installation.refreshToken);
      // Save the new pair before using it: the old refresh token is dead from now on
      await this.store.saveTokens(websiteId, response);
      return this.store.getInstallation(websiteId);
    } catch (error) {
      // Another process is rotating the same token right now (only with several app instances): try once more
      if (error instanceof OAuthError && error.description === 'refresh in progress' && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return this.doRefresh(websiteId, attempt + 1);
      }
      if (error instanceof OAuthError && error.error === 'invalid_grant') {
        // Revoked, uninstalled, expired or reused: these tokens will never work again
        await this.store.deleteInstallation(websiteId);
        throw new ReinstallRequiredError(websiteId);
      }
      throw error;
    }
  }
}
