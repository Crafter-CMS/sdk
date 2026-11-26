import { CrafterPaymentsError } from './errors';

declare const __SDK_VERSION__: string;
export const SDK_VERSION: string = typeof __SDK_VERSION__ === 'string' ? __SDK_VERSION__ : '0.0.0-dev';

/** API sürümü (backend `Crafter-Version`, #465) */
export const API_VERSION = '2026-12';
/** Popup dönüşü için aynı-origin kanal adı (#463 §5.2) */
export const RETURN_CHANNEL = 'crafter-checkout';
/** postMessage protokol sürümü (#463 §5.3) */
export const PROTOCOL_VERSION = 1;
/** SDK'dan giden mesajların kaynak etiketi */
export const SDK_SOURCE = 'crafterpayments-js';
/** Checkout sayfasından gelen mesajların kaynak etiketi */
export const PAGE_SOURCE = 'crafterpayments-checkout';

export type Environment = 'production' | 'development';

const ENDPOINTS: Record<Environment, { apiBase: string; checkoutOrigin: string }> = {
  production: {
    apiBase: 'https://api.crafterpayments.com/v1',
    checkoutOrigin: 'https://checkout.crafterpayments.com',
  },
  development: {
    apiBase: 'https://dev-api.crafterpayments.com/v1',
    checkoutOrigin: 'https://dev-checkout.crafterpayments.com',
  },
};

export interface ResolvedConfig {
  publishableKey: string;
  livemode: boolean;
  apiBase: string;
  checkoutOrigin: string;
  locale?: string;
}

const PUBLISHABLE_KEY = /^cp_pk_(test|live)_[A-Za-z0-9]{24,64}$/;
const SECRET_KEY = /^\s*(cp_sk_|cp_rk_|sk_live_|sk_test_|rk_live_|rk_test_)/;
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{22,40}$/;
const CLIENT_SECRET = /^(cs_(test|live)_[A-Za-z0-9]{22,40})_secret_[A-Za-z0-9]{16,64}$/;

/** Gizli anahtar tarayıcıya hiç girmemeli (#463 §4.1). Görülürse sert hata. */
export function assertNotSecretKey(value: unknown, field: string): void {
  if (typeof value === 'string' && SECRET_KEY.test(value)) {
    throw new CrafterPaymentsError(
      'secret_key_in_browser',
      `A secret key was passed as "${field}". Secret keys (cp_sk_…) must never be used in the browser; ` +
        'create checkout sessions on your server and pass only the publishable key (cp_pk_…) here. ' +
        'Rotate this key in the dashboard if it was shipped to browsers.',
    );
  }
}

export function assertPublishableKey(key: unknown): { livemode: boolean } {
  assertNotSecretKey(key, 'publishableKey');
  const match = typeof key === 'string' ? PUBLISHABLE_KEY.exec(key) : null;
  if (!match) {
    throw new CrafterPaymentsError(
      'invalid_publishable_key',
      'Invalid publishable key. Expected a key starting with cp_pk_test_ or cp_pk_live_.',
    );
  }
  return { livemode: match[1] === 'live' };
}

export function assertSessionId(id: unknown): string {
  assertNotSecretKey(id, 'sessionId');
  if (typeof id !== 'string' || !SESSION_ID.test(id)) {
    throw new CrafterPaymentsError('invalid_session_id', 'Invalid checkout session id (expected cs_test_… or cs_live_…).');
  }
  return id;
}

/** clientSecret biçimi `<sessionId>_secret_<rastgele>`; oturumla eşleşmeli */
export function assertClientSecret(secret: unknown, sessionId?: string): string {
  assertNotSecretKey(secret, 'clientSecret');
  const match = typeof secret === 'string' ? CLIENT_SECRET.exec(secret) : null;
  if (!match || (sessionId && match[1] !== sessionId)) {
    throw new CrafterPaymentsError(
      'invalid_client_secret',
      'Invalid clientSecret for this checkout session. Pass the clientSecret returned when the session was created.',
    );
  }
  return secret as string;
}

export function sessionIdFromClientSecret(secret: string): string | undefined {
  return CLIENT_SECRET.exec(secret)?.[1];
}

function normalizeOrigin(value: string, field: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new CrafterPaymentsError('invalid_options', `"${field}" must be an absolute URL.`);
  }
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) {
    throw new CrafterPaymentsError('invalid_options', `"${field}" must use https (http is allowed only for localhost).`);
  }
  return url.origin;
}

export interface ConfigOptions {
  environment?: Environment;
  locale?: string;
  /** Yerel geliştirme için (ör. http://localhost:3000). Yalnızca https ya da localhost. */
  checkoutOrigin?: string;
  /** Yerel geliştirme için API tabanı, `/v1` dahil. */
  apiBase?: string;
}

export function resolveConfig(publishableKey: string, options: ConfigOptions = {}): ResolvedConfig {
  const { livemode } = assertPublishableKey(publishableKey);
  const env = options.environment ?? 'production';
  const defaults = ENDPOINTS[env];
  if (!defaults) {
    throw new CrafterPaymentsError('invalid_options', 'environment must be "production" or "development".');
  }
  const checkoutOrigin = options.checkoutOrigin
    ? normalizeOrigin(options.checkoutOrigin, 'checkoutOrigin')
    : defaults.checkoutOrigin;
  let apiBase = defaults.apiBase;
  if (options.apiBase) {
    const origin = normalizeOrigin(options.apiBase, 'apiBase');
    apiBase = origin + new URL(options.apiBase).pathname.replace(/\/+$/, '');
  }
  return { publishableKey, livemode, apiBase, checkoutOrigin, locale: options.locale };
}
