import { CrafterPageContext, stripLocalePrefix } from '../core/context';
import { CrafterError } from '../core/errors';
import { DomEvents } from '../core/dom-events';

export interface LocalizationState {
  /** Sayfanın dili */
  language: string;
  /** Müşterinin para birimi; yoksa mağaza para birimi */
  currency: string;
  languages: string[];
  currencies: string[];
}

export interface LocalizationChange {
  language?: string;
  currency?: string;
}

export interface LocalizationSetOptions {
  /** Seçimden sonra dönülecek uygulama içi yol (öneksiz); varsayılan bulunulan sayfa */
  returnTo?: string;
  /** false: sayfa yenilenmez, yalnızca adres döner (tema kendisi yönetir). Varsayılan true. */
  reload?: boolean;
}

/** Yalnızca aynı sitedeki yol (storefront `safeReturnTo` ile aynı kural) */
function safePath(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '/';
  const path = value.trim();
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\') || /[\u0000-\u001f\u007f]/.test(path)) return '/';
  return path;
}

/**
 * Dil ve para birimi (#447). Seçim storefront'un JS'siz formuyla aynı uca gider: `POST /localization`
 * (`language`, `currency`, `return_to`). Sunucu seçimi çereze yazar ve sayfanın seçilen dildeki adresini verir.
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
   * Dili ve/veya para birimini değiştirir. Varsayılan olarak sayfa seçilen dildeki adrese gider.
   * `crafter:localization:changed` olayı (`{ language, currency, url }`) gezinmeden önce yayılır.
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
    // Eski storefront: 303 izlenir, son adres sayfanın seçilen dildeki hali
    if (!url && response.redirected && response.url) {
      try {
        const final = new URL(response.url);
        url = safePath(final.pathname + final.search);
      } catch {
        // yok sayılır
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

/** Bulunulan sayfanın öneksiz yolu + sorgu */
function currentPath(ctx: CrafterPageContext | null): string {
  if (typeof window === 'undefined' || !window.location) return '/';
  return stripLocalePrefix(window.location.pathname, ctx?.localePrefix) + (window.location.search || '');
}
