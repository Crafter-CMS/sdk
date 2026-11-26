import { CrafterPageContext, stripLocalePrefix } from '../core/context';
import { CrafterError } from '../core/errors';
import { DomEvents } from '../core/dom-events';

export interface LocalizationState {
  /** Page language */
  language: string;
  /** The customer's currency; the store currency if absent */
  currency: string;
  languages: string[];
  currencies: string[];
}

export interface LocalizationChange {
  language?: string;
  currency?: string;
}

export interface LocalizationSetOptions {
  /** In-app path to return to after the choice (without prefix); defaults to the current page */
  returnTo?: string;
  /** false: the page is not reloaded, only the URL is returned (the theme handles it). Default true. */
  reload?: boolean;
}

/** Only a path on the same site (same rule as the storefront's `safeReturnTo`) */
function safePath(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '/';
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\') || /[\u0000-\u001f\u007f]/.test(path)) return '/';
  return path;
}

/**
 * Language and currency (#447). The choice goes to the same endpoint as the storefront's no-JS form: `POST /localization`
 * (`language`, `currency`, `return_to`). The server writes the choice to a cookie and returns the page URL in the chosen language.
 */
export class LocalizationModule {
  constructor(private getContext: () => CrafterPageContext | null, private dom: DomEvents) {}

  public get(): LocalizationState {
    const ctx = this.getContext();
    const htmlLang = typeof document !== 'undefined' ? document.documentElement?.lang : '';
    const store = ctx?.storeCurrency || '';
    return {
      language: ctx?.locale || htmlLang || '',
      currency: ctx?.customerCurrency || store,
      languages: Array.isArray(ctx?.languages) ? [...ctx!.languages!] : [],
      currencies: Array.isArray(ctx?.currencies) ? [...ctx!.currencies!] : store ? [store] : [],
    };
  }

  /**
   * Changes the language and/or currency. By default the page navigates to the URL in the chosen language.
   * The `crafter:localization:changed` event (`{ language, currency, url }`) is emitted before navigating.
   */
  public async set(change: LocalizationChange, options: LocalizationSetOptions = {}): Promise<{ url: string }> {
    const ctx = this.getContext();
    const body = new URLSearchParams();
    if (change.language) body.set('language', String(change.language));
    if (change.currency) body.set('currency', String(change.currency).toUpperCase());
    const returnTo = safePath(options.returnTo ?? currentPath(ctx));
    body.set('return_to', returnTo);

    const endpoint = ctx?.routes?.localization || '/localization';
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: body.toString(),
      });
    } catch (error: any) {
      throw new CrafterError({ statusCode: 0, message: error?.message || 'localization request failed' });
    }
    if (!response.ok) {
      throw new CrafterError({ statusCode: response.status, message: `localization: HTTP ${response.status}` });
    }

    let url = '';
    if ((response.headers.get('content-type') || '').includes('application/json')) {
      const data: any = await response.json().catch(() => null);
      if (data && typeof data.location === 'string') url = safePath(data.location);
    }
    // Old storefront: the 303 is followed, the final URL is the page in the chosen language
    if (!url && response.redirected && response.url) {
      try {
        const final = new URL(response.url);
        url = safePath(final.pathname + final.search);
      } catch {
        // ignored
      }
    }
    if (!url) url = returnTo;

    const state = this.get();
    this.dom.emit('localization:changed', {
      language: change.language || state.language,
      currency: change.currency ? String(change.currency).toUpperCase() : state.currency,
      url,
    });
    if (options.reload !== false && typeof window !== 'undefined' && window.location) {
      window.location.assign(url);
    }
    return { url };
  }
}

/** Unprefixed path + query of the current page */
function currentPath(ctx: CrafterPageContext | null): string {
  if (typeof window === 'undefined' || !window.location) return '/';
  return stripLocalePrefix(window.location.pathname, ctx?.localePrefix) + (window.location.search || '');
}
