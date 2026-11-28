import express from 'express';
import { config, webhooksEnabled } from './config.js';
import { TokenStore } from './token-store.js';
import {
  OAuthError,
  ReinstallRequiredError,
  TokenManager,
  authorizeUrl,
  createPkcePair,
  createState,
  exchangeCode,
  revokeToken,
} from './oauth.js';
import { CrafterApi, CrafterApiError } from './api.js';
import { ensureWebhookEndpoint, verifySignature } from './webhooks.js';
import { SessionTokenError, verifySessionToken } from './session-token.js';
import { html, ordersTable, page, raw } from './html.js';

/**
 * Example Crafter app.
 *
 *   GET  /install?store=<websiteId>   app URL: Crafter sends the store owner here to start the install
 *   GET  /oauth/callback              redirect URI: exchanges the code (PKCE) for tokens
 *   POST /webhooks/crafter            webhook endpoint: verifies, de-duplicates and handles events
 *   GET  /embed?session=&store=       embed URL: the page shown inside the Crafter panel
 *   GET  /                            local test pages (localhost only): installed stores, /v1 calls, refresh, revoke
 *
 * Never log tokens, secrets, session tokens or customer data. This file logs only ids and event names.
 */

const store = new TokenStore(config.dataFile);
await store.load();
const tokens = new TokenManager(store);
const api = new CrafterApi(tokens);

const app = express();
app.disable('x-powered-by');

/** Pending installs: state -> PKCE verifier. In memory, 10 minutes (the code itself lives 120 seconds). */
const pendingAuth = new Map();
const PENDING_TTL_MS = 10 * 60 * 1000;
const STATE_COOKIE = 'crafter_oauth_state';
const secureCookies = config.appBaseUrl.startsWith('https://');

function readCookie(req, name) {
  for (const part of String(req.headers.cookie ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0 && part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
  }
  return null;
}

/** Our own pages must not be framed by anyone; only /embed allows the Crafter panel. */
app.use((req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.path !== '/embed')
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
  next();
});

/**
 * The test pages show store data and have no login of their own, so they answer only on localhost. A real app puts
 * its own authentication here.
 */
function localOnly(req, res, next) {
  if (['localhost', '127.0.0.1', '::1'].includes(req.hostname)) return next();
  res.status(404).end();
}

// ─── Install: PKCE start ─────────────────────────────────────────────────────

app.get('/install', (req, res) => {
  const now = Date.now();
  for (const [key, value] of pendingAuth) if (value.expiresAt < now) pendingAuth.delete(key);

  const { verifier, challenge } = createPkcePair();
  const state = createState();
  pendingAuth.set(state, { verifier, expiresAt: now + PENDING_TTL_MS });
  // Bind the state to this browser too, so a callback started elsewhere is refused
  res.cookie(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: secureCookies,
    path: '/oauth',
    maxAge: PENDING_TTL_MS,
  });

  const storeId = typeof req.query.store === 'string' ? req.query.store : undefined;
  const lang = typeof req.query.lang === 'string' ? req.query.lang : undefined;
  res.redirect(302, authorizeUrl({ state, codeChallenge: challenge, store: storeId, lang }));
});

// ─── Install: callback and code exchange ─────────────────────────────────────

app.get('/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const cookieState = readCookie(req, STATE_COOKIE);
  res.clearCookie(STATE_COOKIE, { path: '/oauth' });

  const pending = typeof state === 'string' ? pendingAuth.get(state) : undefined;
  if (typeof state === 'string') pendingAuth.delete(state);
  if (!pending || pending.expiresAt < Date.now() || cookieState !== state) {
    res.status(400).send(page('Install failed', html`<h1>Install failed</h1><p class="error">Unknown or expired state. Start the install again from the Crafter panel.</p>`));
    return;
  }
  if (typeof error === 'string') {
    // access_denied: the store owner declined on the consent screen
    res.status(400).send(page('Install cancelled', html`<h1>Install cancelled</h1><p>Crafter returned <code>${error}</code>.</p>`));
    return;
  }
  if (typeof code !== 'string') {
    res.status(400).send(page('Install failed', html`<h1>Install failed</h1><p class="error">No authorization code.</p>`));
    return;
  }

  try {
    const response = await exchangeCode({ code, codeVerifier: pending.verifier });
    const websiteId = response.store.id;
    await store.saveTokens(websiteId, response);
    console.log(`Installed on store ${websiteId} (app ${response.app_id}, scopes: ${response.scope})`);

    try {
      const result = await ensureWebhookEndpoint(api, store, websiteId);
      if (result.skipped) console.log(`Webhook endpoint not created: ${result.skipped}`);
      else console.log(`Webhook endpoint ${result.endpointId} ${result.reused ? 'kept' : 'created'} for ${websiteId}`);
    } catch (endpointError) {
      // The install itself worked; webhooks can be set up again on the next install
      console.warn(`Webhook endpoint setup failed for ${websiteId}: ${endpointError.message}`);
    }

    res.send(page('Installed', html`<h1>Installed</h1>
<p>The app is installed on <strong>${response.store.name}</strong>.</p>
<p>Open it from the store's Apps page in the Crafter panel, or see the local test page at <code>${config.appBaseUrl}/</code> (localhost only).</p>`));
  } catch (exchangeError) {
    const reason = exchangeError instanceof OAuthError ? exchangeError.error : 'request_failed';
    console.warn(`Code exchange failed: ${reason}`);
    res.status(400).send(page('Install failed', html`<h1>Install failed</h1><p class="error">Token exchange failed (<code>${reason}</code>). Start the install again.</p>`));
  }
});

// ─── Webhooks ────────────────────────────────────────────────────────────────

const processing = new Set();

// Raw body: the signature is computed over the exact bytes Crafter sent
app.post('/webhooks/crafter', express.raw({ type: '*/*', limit: '1mb' }), async (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    res.status(400).json({ error: 'invalid_json' });
    return;
  }

  // Pick the secret of the endpoint we created for this store; nothing in the body is trusted before the check
  const websiteId = typeof event?.data?.websiteId === 'string' ? event.data.websiteId : null;
  const endpoint = websiteId ? store.getWebhookEndpoint(websiteId) : null;
  const signature = req.get('X-Crafter-Signature');
  if (!endpoint || !verifySignature(rawBody, signature, [endpoint.secret])) {
    res.status(400).json({ error: 'invalid_signature' });
    return;
  }

  // The same delivery id comes back on every retry: handle it once
  const deliveryId = req.get('X-Crafter-Delivery') || event.id;
  if (typeof deliveryId !== 'string' || !deliveryId) {
    res.status(400).json({ error: 'missing_delivery_id' });
    return;
  }
  if (store.hasDelivery(deliveryId) || processing.has(deliveryId)) {
    res.status(200).json({ received: true, duplicate: true });
    return;
  }
  processing.add(deliveryId);
  try {
    await handleEvent(event, websiteId);
    await store.rememberDelivery(deliveryId);
    res.status(200).json({ received: true });
  } catch (handlerError) {
    console.error(`Webhook ${deliveryId} (${event.event}) failed: ${handlerError.message}`);
    // Non-2xx: Crafter retries later with the same delivery id
    res.status(500).json({ error: 'handler_failed' });
  } finally {
    processing.delete(deliveryId);
  }
});

async function handleEvent(event, websiteId) {
  switch (event.event) {
    case 'app.uninstalled': {
      // The tokens are already revoked on Crafter's side; forget them. The endpoint record (id + secret) stays so a
      // reinstall can verify deliveries to the same endpoint.
      const deleted = await store.deleteInstallation(websiteId);
      console.log(`Uninstalled from store ${websiteId}${deleted ? '; tokens deleted' : ''}`);
      break;
    }
    case 'app.installed':
      // Reaches only endpoints that already exist (a reinstall); the first install is the code exchange
      console.log(`app.installed for store ${websiteId}`);
      break;
    case 'order.paid':
      // Customer name and email are null unless the app holds read_customers; do not log them either way
      console.log(`order.paid ${event.data?.orderId} on store ${websiteId} (livemode: ${event.livemode})`);
      break;
    default:
      console.log(`Ignoring ${event.event}`);
  }
}

// ─── Embedded page ───────────────────────────────────────────────────────────

app.get('/embed', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  // Only the Crafter panel may frame this page
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors ${config.panelOrigins.join(' ')}`,
  );

  let claims;
  try {
    claims = await verifySessionToken(req.query.session, {
      store: typeof req.query.store === 'string' ? req.query.store : '',
    });
  } catch (error) {
    const reason = error instanceof SessionTokenError ? error.message : 'verification failed';
    res.status(401).send(page('Session expired', html`<h1>Session expired</h1><p class="error">${reason}. Reload the page in the Crafter panel.</p>`));
    return;
  }

  // claims.sub is a pseudonymous user id (stable for this user and this app); claims.store is the store
  try {
    const [storeInfo, orders] = await Promise.all([
      api.retrieveStore(claims.store),
      api.listOrders(claims.store, { limit: 5 }),
    ]);
    const lang = req.query.lang === 'tr' ? 'tr' : 'en';
    res.send(page('Orders', html`<h1>${lang === 'tr' ? 'Son siparişler' : 'Latest orders'}</h1>
<p class="muted">${storeInfo.name} · ${storeInfo.currency}</p>
${raw(ordersTable(orders.data))}`));
  } catch (error) {
    if (error instanceof ReinstallRequiredError) {
      res.status(409).send(page('Reinstall', html`<h1>Install the app again</h1><p>This store has no valid tokens. Remove the app and install it again.</p>`));
      return;
    }
    const message = error instanceof CrafterApiError ? `${error.type} (request ${error.requestId})` : 'request failed';
    res.status(502).send(page('Error', html`<h1>Crafter API error</h1><p class="error">${message}</p>`));
  }
});

// ─── Local test pages (localhost only) ───────────────────────────────────────

app.get('/', localOnly, (req, res) => {
  const items = store.listInstallations();
  res.send(page('Example app', html`<h1>Example Crafter app</h1>
<p class="muted">Webhooks: ${webhooksEnabled ? config.webhookUrl : 'off (APP_BASE_URL is not https)'}</p>
${items.length
    ? raw(html`<ul>${items.map((item) => raw(html`<li><a href="/stores/${encodeURIComponent(item.websiteId)}">${item.store.name}</a> <span class="muted">${item.websiteId}</span></li>`))}</ul>`)
    : raw(html`<p>No store has installed the app yet. Install it from the Crafter panel.</p>`)}`));
});

app.get('/stores/:websiteId', localOnly, async (req, res) => {
  const { websiteId } = req.params;
  try {
    const storeInfo = await api.retrieveStore(websiteId);
    const orders = await api.listOrders(websiteId, { limit: 10 });
    const installation = store.getInstallation(websiteId);
    res.send(page(storeInfo.name, html`<h1>${storeInfo.name}</h1>
<p class="muted">${storeInfo.url ?? ''} · ${storeInfo.currency} · scopes: ${installation?.scope}</p>
<p>Access token expires at ${new Date(installation?.accessTokenExpiresAt ?? 0).toISOString()}</p>
<form method="post" action="/stores/${encodeURIComponent(websiteId)}/refresh"><button>Refresh tokens now</button></form>
<form method="post" action="/stores/${encodeURIComponent(websiteId)}/revoke"><button>Revoke tokens</button></form>
<h2>GET /v1/orders</h2>
${raw(ordersTable(orders.data))}
<h2>GET /v1/store</h2>
<pre>${JSON.stringify(storeInfo, null, 2)}</pre>`));
  } catch (error) {
    const message =
      error instanceof ReinstallRequiredError
        ? 'No valid tokens for this store. Install the app again.'
        : error instanceof CrafterApiError
          ? `${error.status} ${error.type} (request ${error.requestId})`
          : error.message;
    res.status(error instanceof ReinstallRequiredError ? 409 : 502).send(page('Error', html`<p class="error">${message}</p>`));
  }
});

app.post('/stores/:websiteId/refresh', localOnly, async (req, res) => {
  try {
    await tokens.accessToken(req.params.websiteId, { forceRefresh: true });
    res.redirect(303, `/stores/${encodeURIComponent(req.params.websiteId)}`);
  } catch (error) {
    res.status(409).send(page('Refresh failed', html`<p class="error">${error.message}</p>`));
  }
});

/** Revoking the refresh token ends the whole grant. The app stays installed in the panel but has no access. */
app.post('/stores/:websiteId/revoke', localOnly, async (req, res) => {
  const installation = store.getInstallation(req.params.websiteId);
  if (installation) {
    await revokeToken(installation.refreshToken).catch((error) => console.warn(`Revoke failed: ${error.message}`));
    await store.deleteInstallation(req.params.websiteId);
  }
  res.redirect(303, '/');
});

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.listen(config.port, () => {
  console.log(`Example app on ${config.appBaseUrl} (port ${config.port})`);
  console.log(`Redirect URI: ${config.redirectUri}`);
  if (!webhooksEnabled) console.log('Webhooks are off: set APP_BASE_URL to a public https URL to receive them.');
});
