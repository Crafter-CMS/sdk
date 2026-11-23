/**
 * Sayfa bağlamı (#447): storefront her v2 tema sayfasına `content_for_header` ile
 * `window.__CRAFTER_CONTEXT__` yazar. Gizli bilgi ve kişisel veri içermez; yalnızca mağaza, dil ve para birimi.
 * IIFE derlemesi bu nesneyi görünce `window.Crafter` örneğini kendiliğinden kurar (bkz. `autoInit`).
 */
export interface CrafterPageContext {
  /** Bağlamı yazan storefront'un eklediği SDK sürümü */
  sdkVersion?: string;
  websiteId?: string;
  /** Aynı kökenli proxy; varsayılan '/api/storefront' */
  apiBase?: string;
  /** Sayfanın dili (ör. 'en', 'pt-BR') */
  locale?: string;
  /** Mağazanın varsayılan dili */
  defaultLocale?: string;
  /** Sayfa adresinin dil öneki: varsayılan dilde '', diğerlerinde '/en' */
  localePrefix?: string;
  /** Mağazanın açık dilleri */
  languages?: string[];
  /** Mağaza para birimi (muhasebe birimi); tutarlar bu birimde tutulur */
  storeCurrency?: string;
  /** Müşterinin para birimi; yoksa mağaza para birimi */
  customerCurrency?: string;
  /** 1 mağaza birimi = rate müşteri birimi (yalnızca gösterim) */
  rate?: number;
  /** Seçicideki para birimleri */
  currencies?: string[];
  /** Platform adresleri; checkout dil önekiyle çalışmaz, dili Referer'dan okur */
  routes?: { cart?: string; checkout?: string; localization?: string };
}

export const CONTEXT_GLOBAL = '__CRAFTER_CONTEXT__';

/** `window.__CRAFTER_CONTEXT__` okunur; yoksa ya da nesne değilse null */
export function readPageContext(win: any = typeof window !== 'undefined' ? window : undefined): CrafterPageContext | null {
  const raw = win?.[CONTEXT_GLOBAL];
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as CrafterPageContext) : null;
}

/** Dil önekini yoldan çıkarır: '/en/cart' → '/cart' (önek '/en' iken) */
export function stripLocalePrefix(pathname: string, prefix: string | undefined): string {
  if (!prefix || prefix === '/') return pathname || '/';
  if (pathname === prefix) return '/';
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}
