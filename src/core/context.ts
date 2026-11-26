/**
 * Page context (#447): the storefront writes `window.__CRAFTER_CONTEXT__` into every v2 theme page with
 * `content_for_header`. It holds no secrets or personal data; only the store, language and currency.
 * When the IIFE build sees this object it sets up the `window.Crafter` instance by itself (see `autoInit`).
 */
export interface CrafterPageContext {
  /** SDK version added by the storefront that wrote the context */
  sdkVersion?: string;
  websiteId?: string;
  /** Same-origin proxy; default '/api/storefront' */
  apiBase?: string;
  /** Page language (e.g. 'en', 'pt-BR') */
  locale?: string;
  /** The store's default language */
  defaultLocale?: string;
  /** Language prefix of the page URL: '' for the default language, '/en' for the others */
  localePrefix?: string;
  /** The store's enabled languages */
  languages?: string[];
  /** Store currency (accounting unit); amounts are kept in this unit */
  storeCurrency?: string;
  /** The customer's currency; the store currency if absent */
  customerCurrency?: string;
  /** 1 store unit = rate customer units (display only) */
  rate?: number;
  /** Currencies in the selector */
  currencies?: string[];
  /** Platform URLs; checkout does not use the language prefix, it reads the language from the Referer */
  routes?: {
    cart?: string;
    checkout?: string;
    localization?: string;
    /** Root of the storefront cart endpoints (#434), e.g. '/cart' → `/cart.js`, `/cart/add.js`. If absent the cart lives in localStorage. */
    cartApi?: string;
  };
}

export const CONTEXT_GLOBAL = '__CRAFTER_CONTEXT__';

/** Reads `window.__CRAFTER_CONTEXT__`; null if missing or not an object */
export function readPageContext(win: any = typeof window !== 'undefined' ? window : undefined): CrafterPageContext | null {
  const raw = win?.[CONTEXT_GLOBAL];
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as CrafterPageContext) : null;
}

/** Strips the language prefix from the path: '/en/cart' → '/cart' (when the prefix is '/en') */
export function stripLocalePrefix(pathname: string, prefix: string | undefined): string {
  if (!prefix || prefix === '/') return pathname || '/';
  if (pathname === prefix) return '/';
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}
