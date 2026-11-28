# Crafter example app (Node.js + Express)

A small app you can copy to start building on the Crafter app store. It runs on your own server and shows how to:

- start the install with OAuth 2.0 + PKCE (`S256`) and exchange the code for tokens in the callback,
- store tokens (in a local JSON file, **example only**) and refresh them before they expire,
- call the public API: `GET /v1/store` and `GET /v1/orders` (with `Retry-After` handling on `429`),
- receive webhooks on the app's **Webhook URL** and verify every delivery: `X-Crafter-Signature` HMAC, 5 minute
  timestamp tolerance, timing-safe compare, de-duplication on `X-Crafter-Delivery`,
- serve an embedded page inside the Crafter panel and verify its session JWT against the JWKS with Node `crypto`,
- delete the store's tokens when `app.uninstalled` arrives.

Developer documentation: [Apps](https://docs.crafter.net.tr/en/developers/apps/overview).

> **Not for production as is.** Tokens are written to `data/tokens.json` in plain text. Use a database and encrypt
> refresh tokens at rest. The local test pages (`/`, `/stores/...`) have no login and answer only on `localhost`.

## Requirements

- Node.js 20.6 or newer (uses the built-in `fetch`, `crypto` and `--env-file`)
- A Crafter account with a store you own on the dev environment
- For webhooks: a public `https` URL that forwards to this app (any HTTPS tunnel works). Crafter does not deliver to
  `localhost` or private addresses.

## Files

| File | What it does |
| --- | --- |
| `src/server.js` | Express routes: install, callback, webhooks, embedded page, local test pages |
| `src/oauth.js` | PKCE, authorize URL, code exchange, refresh (single-flight per store), revoke |
| `src/api.js` | `/v1` client: bearer token, `Crafter-Version`, one refresh on `401`, one wait on `429` |
| `src/webhooks.js` | Webhook signature verification |
| `src/session-token.js` | Embedded page session token (EdDSA JWT) verification with the JWKS |
| `src/token-store.js` | Local JSON file storage (example only) |
| `crafter-app.json` | Sample manifest |

## Environments

| | Dev | Production |
| --- | --- | --- |
| OAuth, JWKS (`CRAFTER_API_URL`) | `https://dev-api.crafter.net.tr` | `https://api.crafter.net.tr` |
| Public API (`CRAFTER_V1_URL`) | `https://dev-api.crafterpayments.com/v1` | `https://api.crafterpayments.com/v1` |
| Panel (`CRAFTER_PANEL_ORIGINS`) | `https://dev-app.crafter.net.tr` | `https://app.crafter.net.tr` |

The `/v1` API is served on its own host. OAuth endpoints and the JWKS are on the Crafter API host.

## Setup against dev

Start a tunnel first if you want webhooks, and use its `https` address as `<base>` below. Without a tunnel use
`http://localhost:3000`; everything except webhooks works.

### 1. Create the app in the panel

In the dev panel (`https://dev-app.crafter.net.tr`), open **Developer > Apps > Create app**:

- **App type**: `Private` while you develop. A private app installs only on the one store you pick, is published
  without review, and may use `http://localhost` URLs. A `Public` app needs `https` URLs and a review before stores
  can install it.
- **App URL**: `<base>/install`
- **Redirect URLs**: `<base>/oauth/callback` (matched exactly, character for character)
- **Panel page URL**: `<base>/embed`
- **Webhook URL**: `<base>/webhooks/crafter` (must be a public `https` URL; leave it empty without a tunnel)

Copy the **client id** (`capp_…`), the **client secret** (`crft_acs_…`) and, if you set a Webhook URL, the **webhook
secret** (`whsec_…`). Secrets are shown only once; rotate them in the panel if you lose them.

### 2. Publish a version with the manifest

Create a version with [`crafter-app.json`](./crafter-app.json) as the manifest (change `id` to your app id) and submit
it. A private app is published right away; a public app goes to review. The install only works once a version is
published, and the app can request only the scopes of the published manifest.

### 3. Configure and run

```bash
cd examples/app-node
cp .env.example .env    # then fill in the client id, client secret, webhook secret and APP_BASE_URL
npm install
npm start
```

### 4. Install

Install the app from the store's **Apps** page in the panel. Crafter sends you to
`<App URL>?store=<websiteId>&lang=<tr|en>`; the app starts OAuth, the panel shows the consent screen, and the browser
comes back to `/oauth/callback`. Open `http://localhost:3000/` to see the installed store, its `/v1/store` and
`/v1/orders` responses, and buttons to refresh or revoke the tokens. The console shows the `app.installed` webhook.

Open the app from the store's Apps page to see the embedded page (the **Panel page URL**).

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `CRAFTER_CLIENT_ID` | yes | | Client id from the panel (`capp_…`) |
| `CRAFTER_CLIENT_SECRET` | yes | | Client secret from the panel (`crft_acs_…`). Keep it out of git and logs. |
| `CRAFTER_WEBHOOK_SECRET` | for webhooks | | Webhook secret of the app (`whsec_…`), the same for every store |
| `CRAFTER_WEBHOOK_SECRET_PREVIOUS` | no | | The old webhook secret during a rotation (Crafter signs with both for 24 hours) |
| `APP_BASE_URL` | no | `http://localhost:3000` | Public base URL of this app. Webhooks need `https`. |
| `PORT` | no | `3000` | Listen port |
| `CRAFTER_API_URL` | no | `https://dev-api.crafter.net.tr` | OAuth and JWKS host |
| `CRAFTER_V1_URL` | no | `https://dev-api.crafterpayments.com/v1` | Public API base URL |
| `CRAFTER_SCOPES` | no | `read_store read_orders` | Scopes to request (subset of the published manifest) |
| `CRAFTER_SESSION_ISSUER` | no | `CRAFTER_API_URL` | Expected `iss` of embedded session tokens |
| `CRAFTER_PANEL_ORIGINS` | no | `https://dev-app.crafter.net.tr` | Origins allowed to frame `/embed` (CSP `frame-ancestors`) |
| `DATA_FILE` | no | `./data/tokens.json` | Token file (example only) |

## How it works

### Install (PKCE)

1. `GET /install?store=…` creates a random `code_verifier`, its `S256` challenge and a `state`, keeps them for
   10 minutes, sets the `state` in an `HttpOnly` cookie and redirects to
   `GET {CRAFTER_API_URL}/apps/oauth/authorize?response_type=code&client_id&redirect_uri&scope&state&code_challenge&code_challenge_method=S256&store`.
2. The store owner approves in the panel. Crafter redirects to `redirect_uri?code=…&state=…`
   (or `?error=access_denied&state=…`).
3. `GET /oauth/callback` checks the `state` against memory and the cookie, then calls
   `POST {CRAFTER_API_URL}/apps/oauth/token` with `grant_type=authorization_code`, `code`, `redirect_uri` and
   `code_verifier`, authenticated with HTTP Basic (`client_id:client_secret`). The code is valid for 120 seconds and
   only once.

Token response:

```json
{
  "access_token": "crft_aat_…",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "crft_art_…",
  "refresh_token_expires_in": 7776000,
  "scope": "read_store read_orders",
  "app_id": "example-orders-viewer",
  "store": { "id": "<websiteId>", "name": "…", "url": "…" }
}
```

### Refresh

The access token lives 1 hour. `src/oauth.js` refreshes it 60 seconds before it expires with
`grant_type=refresh_token`. Every refresh returns a **new** refresh token; the old one stops working. Refreshes are
single-flight per store, because sending an already-used refresh token again (outside a 10 second grace window)
revokes the whole grant. An `invalid_grant` answer means the store has to install the app again, so the example
deletes the tokens.

### API calls

`GET {CRAFTER_V1_URL}/store` and `GET {CRAFTER_V1_URL}/orders?limit=10` with `Authorization: Bearer <access token>`
and `Crafter-Version: 2026-12`. On `401 app_token_invalid` the client refreshes once and retries. On `429` it waits
`Retry-After` seconds once. The limit is 120 requests per minute per installation.

### Webhooks

When a store installs the app, Crafter creates a webhook endpoint for the app's **Webhook URL** on that store. It is
subscribed to the manifest's `events` that the store's granted scopes cover, plus `app.installed` and
`app.uninstalled`, and it receives live and test-mode events alike (the body's `livemode` tells them apart). Every
delivery is signed with the app's webhook secret, the same for every store, so the app needs no per-store setup.

`app.installed` is sent on every install, also the first one. It is queued while the code is exchanged, so it can
arrive before the callback has stored the tokens; the example only logs it.

Each delivery is checked in this order:

1. The signature: `X-Crafter-Signature: t=<unix seconds>,v1=<hex>` where `v1` is
   `HMAC-SHA256(secret, "<t>.<raw body>")`. Compared with `crypto.timingSafeEqual`. The header may hold several `v1`
   values (24 hours after a secret rotation); any match against `CRAFTER_WEBHOOK_SECRET` or
   `CRAFTER_WEBHOOK_SECRET_PREVIOUS` is enough.
2. The timestamp: rejected when more than 5 minutes away from the server clock.
3. `X-Crafter-Delivery`: a delivery that was already handled gets `200` without being handled again (retries reuse
   the id).

`app.uninstalled` deletes the store's tokens (Crafter has already revoked them). After it the store's endpoint is
turned off; a reinstall turns it back on.

Optional: an app with the `webhooks:write` scope can add more endpoints per store with `POST /v1/webhook_endpoints`
(another URL or a subset of events). Each of those has its own secret, returned once on create. The example does not
use them; `src/api.js` has the calls.

### Embedded page

The panel loads `<Panel page URL>?session=<JWT>&store=<websiteId>&lang=<tr|en>` in a sandboxed iframe, with a new
token on every load. `src/session-token.js`:

1. reads the header, requires `alg: EdDSA` and finds the key by `kid` in
   `GET {CRAFTER_API_URL}/apps/.well-known/jwks.json` (cached 5 minutes, refetched for an unknown `kid`),
2. verifies the Ed25519 signature with `crypto.verify`,
3. checks `aud` = your client id, `iss`, `exp` (tokens live 60 seconds), `iat`, and that the signed `store` claim
   equals the `store` query parameter,
4. refuses a `jti` it has already seen.

`sub` is a pseudonymous user id: stable for the same user and app, different for every app. The page then reads the
store and its latest orders with the stored access token of `claims.store`. The `/embed` response sets
`Content-Security-Policy: frame-ancestors <CRAFTER_PANEL_ORIGINS>` so only the panel can frame it.

A real app would verify the token once and then start its own session for the iframe.

## Security checklist

- Secrets only in environment variables; `.env` and `data/` are in `.gitignore`.
- Never log access tokens, refresh tokens, client or webhook secrets, session tokens or customer data.
- Encrypt refresh tokens at rest in production.
- Verify the webhook signature over the raw body before acting on anything in it.
- Ask only for the scopes you use. Personal data scopes (`read_customers`, `read_customers:limited`) need a reason
  in the manifest and get a second reviewer.
