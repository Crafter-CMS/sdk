/**
 * Configuration from environment variables. Secrets come only from the environment (.env), never from code.
 */

function required(name) {
  const value = (process.env[name] ?? '').trim();
  if (!value) {
    console.error(`Missing environment variable ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

function optional(name, fallback) {
  const value = (process.env[name] ?? '').trim();
  return value || fallback;
}

const stripSlash = (url) => url.replace(/\/+$/, '');

const apiUrl = stripSlash(optional('CRAFTER_API_URL', 'https://dev-api.crafter.net.tr'));
const appBaseUrl = stripSlash(optional('APP_BASE_URL', 'http://localhost:3000'));

export const config = {
  port: Number(optional('PORT', '3000')),
  clientId: required('CRAFTER_CLIENT_ID'),
  clientSecret: required('CRAFTER_CLIENT_SECRET'),
  appBaseUrl,
  redirectUri: `${appBaseUrl}/oauth/callback`,
  webhookUrl: `${appBaseUrl}/webhooks/crafter`,
  /** OAuth endpoints and the JWKS live on the Crafter API host. */
  apiUrl,
  /** The public REST API (/v1) has its own host. */
  v1Url: stripSlash(optional('CRAFTER_V1_URL', 'https://dev-api.crafterpayments.com/v1')),
  /** Pin the API version you built against; fields are only added within a version. */
  apiVersion: '2026-12',
  scopes: optional('CRAFTER_SCOPES', 'read_store read_orders')
    .split(/\s+/)
    .filter(Boolean),
  sessionIssuer: stripSlash(optional('CRAFTER_SESSION_ISSUER', apiUrl)),
  /** The app's webhook signing secret from the panel (one secret for every store). */
  webhookSecret: optional('CRAFTER_WEBHOOK_SECRET', ''),
  /** During a rotation Crafter signs with both secrets for 24 hours; keep the old one here until then. */
  webhookSecretPrevious: optional('CRAFTER_WEBHOOK_SECRET_PREVIOUS', ''),
  panelOrigins: optional('CRAFTER_PANEL_ORIGINS', 'https://dev-app.crafter.net.tr')
    .split(/\s+/)
    .filter(Boolean),
  dataFile: optional('DATA_FILE', './data/tokens.json'),
};

/**
 * Webhooks reach the app only on a public https URL (Crafter never delivers to localhost or private addresses), and
 * the app needs the webhook secret to verify them.
 */
export const webhooksEnabled = config.webhookUrl.startsWith('https://') && Boolean(config.webhookSecret);

/** Secrets a delivery may be signed with: the current one and, during a rotation, the previous one. */
export const webhookSecrets = [config.webhookSecret, config.webhookSecretPrevious].filter(Boolean);
