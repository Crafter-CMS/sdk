import { CrafterError } from '../core/errors';
import { CART_COUPON_KEY, CART_STORAGE_KEY, normalizeLines } from './cart-store';

/**
 * Hibrit sepet (#434): storefront'un sepet uçları. Ziyaretçide sepet storefront'un imzalı çerezinde, giriş yapmış
 * müşteride sunucuda tutulur; SDK iki modu ayırt etmez. Uçlar aynı kökenli ve çerezlidir (`credentials: 'same-origin'`).
 * Fiyat gönderilmez: sunucu güncel üründen hesaplar.
 *   GET  /cart.js
 *   POST /cart/add.js     { id, quantity, options? } | { items: [{ id, quantity }] }
 *   POST /cart/change.js  { id, quantity }   (0 siler; id ürün id'si ya da satır anahtarı)
 *   POST /cart/clear.js
 *   POST /cart/coupon.js  { code | null }  (geçersiz kupon 422 + `type`, sepet değişmez; null / '' kaldırır)
 */

/** Sunucunun döndürdüğü satır */
export interface ServerCartLine {
  key?: string;
  id: string;
  productId?: string;
  name: string;
  slug?: string;
  url?: string;
  price: number;
  unitPrice: number;
  discountType?: string | null;
  discountValue?: number | null;
  quantity: number;
  lineTotal: number;
  images?: string[];
  image?: string | null;
  stock?: number;
  options?: Record<string, string> | null;
  [key: string]: unknown;
}

/** Sepetten düşen satır: `not_found`, `unavailable`, `out_of_stock`, `cart_full` */
export interface CartRemovedNote {
  productId: string;
  key?: string;
  name?: string | null;
  quantity: number;
  reason: string;
}

/** Adedi düşürülen satır: `stock_limit`, `max_quantity` */
export interface CartAdjustedNote {
  productId: string;
  key?: string;
  name?: string | null;
  from: number;
  to: number;
  reason: string;
}

/** Sepetteki geçerli kuponun ayrıntısı (#476) */
export interface CartCouponDetails {
  code: string;
  type: 'percentage' | 'fixed' | 'free_product';
  /** Yüzde ya da mağaza para biriminde tutar; `free_product` için null olabilir */
  value: number | null;
  /** `free_product` kuponunda hediye ürün; diğerlerinde null */
  freeProductId: string | null;
}

/** Saklı kupon geçersizleşip sepetten düşürüldü (#476); `reason` kupon hata kodu (bkz. `CouponErrorType`) */
export interface CartCouponRemovedNote {
  code: string;
  reason: string;
}

export interface ServerCartResponse {
  items: ServerCartLine[];
  itemCount: number;
  subtotal: number;
  currency: string;
  coupon: string | null;
  /** Kupon indirimi, mağaza para biriminde (#476); kupon yoksa 0 */
  discount?: number;
  /** Ödenecek tutar: `subtotal - discount` (en az 0), mağaza para biriminde (#476) */
  total?: number;
  /** Geçerli kuponun ayrıntısı (#476); kupon yoksa null */
  couponDetails?: CartCouponDetails | null;
  /** Saklı kupon düşürüldüyse bir kez bildirilir (#476); yoksa null */
  couponRemoved?: CartCouponRemovedNote | null;
  removed?: CartRemovedNote[];
  adjusted?: CartAdjustedNote[];
  mode?: 'guest' | 'customer';
}

export interface ServerCartClientOptions {
  /** Uçların kökü (bağlamın `routes.cartApi` değeri, ör. '/cart') */
  cartApi: string;
  /** Ürün adlarının dili (`X-Crafter-Locale`) */
  locale?: () => string | undefined;
  fetchImpl?: typeof fetch;
}

/** Başka sekmeye "sepet değişti" sinyali (yalnızca zaman damgası) */
export const CART_SYNC_KEY = 'crafter_cart_sync';

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const COUPON_KINDS = ['percentage', 'fixed', 'free_product'];

function couponDetailsOf(raw: any): CartCouponDetails | null {
  if (!raw || typeof raw !== 'object' || typeof raw.code !== 'string' || !raw.code) return null;
  if (!COUPON_KINDS.includes(raw.type)) return null;
  return {
    code: raw.code,
    type: raw.type,
    value: raw.value != null && raw.value !== '' && Number.isFinite(Number(raw.value)) ? Number(raw.value) : null,
    freeProductId: raw.freeProductId != null && raw.freeProductId !== '' ? String(raw.freeProductId) : null,
  };
}

function couponRemovedOf(raw: any): CartCouponRemovedNote | null {
  if (!raw || typeof raw !== 'object' || typeof raw.code !== 'string' || !raw.code) return null;
  return { code: raw.code, reason: typeof raw.reason === 'string' && raw.reason ? raw.reason : 'coupon_invalid' };
}

/** Yanıtı tip güvenli biçime getirir; bozuk satırlar atılır */
export function normalizeServerCart(raw: any): ServerCartResponse {
  const items: ServerCartLine[] = (Array.isArray(raw?.items) ? raw.items : [])
    .filter((item: any) => item && typeof item === 'object' && item.id !== undefined && item.id !== null)
    .map((item: any) => {
      const images = Array.isArray(item.images) ? item.images.filter((src: unknown) => typeof src === 'string' && src) : [];
      return {
        ...item,
        id: String(item.id),
        name: typeof item.name === 'string' ? item.name : '',
        price: num(item.price),
        unitPrice: num(item.unitPrice ?? item.price),
        quantity: Math.max(1, Math.floor(num(item.quantity) || 1)),
        lineTotal: num(item.lineTotal),
        discountType: typeof item.discountType === 'string' && item.discountType ? item.discountType : null,
        discountValue: item.discountValue != null && item.discountValue !== '' ? num(item.discountValue) : null,
        images,
        image: typeof item.image === 'string' && item.image ? item.image : images[0] || null,
      };
    });
  const subtotal = raw?.subtotal != null ? num(raw.subtotal) : items.reduce((sum, line) => sum + line.lineTotal, 0);
  // Eski storefront indirim göndermez: indirim 0, toplam ara toplam
  const discount = Math.max(0, num(raw?.discount));
  return {
    items,
    itemCount: raw?.itemCount != null ? num(raw.itemCount) : items.reduce((sum, line) => sum + line.quantity, 0),
    subtotal,
    currency: typeof raw?.currency === 'string' ? raw.currency : '',
    coupon: typeof raw?.coupon === 'string' && raw.coupon ? raw.coupon : null,
    discount,
    total: raw?.total != null && raw.total !== '' ? Math.max(0, num(raw.total)) : Math.max(0, subtotal - discount),
    couponDetails: couponDetailsOf(raw?.couponDetails),
    couponRemoved: couponRemovedOf(raw?.couponRemoved),
    removed: Array.isArray(raw?.removed) ? raw.removed : [],
    adjusted: Array.isArray(raw?.adjusted) ? raw.adjusted : [],
    ...(raw?.mode === 'guest' || raw?.mode === 'customer' ? { mode: raw.mode } : {}),
  };
}

/**
 * Storefront sepet uçlarının istemcisi. İlk işlemden önce eski localStorage sepetini bir kez sunucuya taşır
 * (`migrate`); her değişiklikten sonra diğer sekmelere `crafter_cart_sync` sinyali yazar.
 */
export class ServerCartClient {
  private migration: Promise<ServerCartResponse | null> | null = null;
  private migrationConsumed = false;
  private readonly base: string;

  constructor(private readonly options: ServerCartClientOptions) {
    this.base = options.cartApi.replace(/\/+$/, '') || '/cart';
  }

  public async get(): Promise<ServerCartResponse> {
    const migrated = await this.migrate();
    // Taşımada okunan sepet yalnızca ilk okumada kullanılır
    if (migrated && !this.migrationConsumed) {
      this.migrationConsumed = true;
      return migrated;
    }
    return this.request('GET', `${this.base}.js`);
  }

  public async add(id: string, quantity: number, options?: Record<string, string> | null): Promise<ServerCartResponse> {
    await this.migrate();
    return this.mutate('add.js', { id, quantity, ...(options && Object.keys(options).length ? { options } : {}) });
  }

  public async change(id: string, quantity: number): Promise<ServerCartResponse> {
    await this.migrate();
    return this.mutate('change.js', { id, quantity });
  }

  public async clear(): Promise<ServerCartResponse> {
    await this.migrate();
    return this.mutate('clear.js', {});
  }

  public async setCoupon(code: string | null): Promise<ServerCartResponse> {
    await this.migrate();
    return this.mutate('coupon.js', { code });
  }

  /** Başka sekmede değişince çağrılır; aboneliği kaldıran fonksiyon döner */
  public subscribe(onChange: () => void): () => void {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {};
    const listener = (event: StorageEvent) => {
      if (event.key === CART_SYNC_KEY) onChange();
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }

  /**
   * Eski temaların localStorage sepeti (`cart`, `crafter_cart_coupon`) sayfa başına bir kez taşınır: sunucu sepeti
   * boşsa satırlar (yalnızca id + adet), kupon yoksa kupon gönderilir; ardından anahtarlar silinir. Sunucu sepeti
   * doluysa sunucudaki esas alınır ve anahtarlar yine silinir. Ağ / sunucu hatasında localStorage korunur (sonraki
   * sayfada tekrar denenir); istek reddedilirse (4xx) kayıt bozuk sayılır ve silinir.
   * Kupon yalnızca sunucu kabul ederse taşınır (#476): kupon adımı 4xx ile reddedilirse taşınan satırlar korunur,
   * kupon düşer, iki anahtar da silinir ve dönen sepette `couponRemoved: { code, reason }` bir kez bildirilir.
   * Dönüş: taşıma sırasında okunan son sepet (yoksa null).
   */
  public migrate(): Promise<ServerCartResponse | null> {
    if (!this.migration) this.migration = this.runMigration();
    return this.migration;
  }

  private async runMigration(): Promise<ServerCartResponse | null> {
    const store = storage();
    if (!store) return null;
    let lines: ReturnType<typeof normalizeLines>;
    let coupon: string | null;
    try {
      const raw = store.getItem(CART_STORAGE_KEY);
      coupon = store.getItem(CART_COUPON_KEY) || null;
      if (raw === null && !coupon) return null;
      try {
        lines = normalizeLines(JSON.parse(raw || '[]'));
      } catch {
        lines = [];
      }
    } catch {
      return null;
    }
    const forget = () => {
      try {
        store.removeItem(CART_STORAGE_KEY);
        store.removeItem(CART_COUPON_KEY);
      } catch {
        // yok sayılır
      }
    };
    const rejected = (error: unknown) => {
      const status = (error as CrafterError)?.statusCode ?? 0;
      return status >= 400 && status < 500;
    };
    let changed = false;
    try {
      let cart = await this.request('GET', `${this.base}.js`);
      if (lines.length && cart.items.length === 0) {
        cart = await this.request('POST', `${this.base}/add.js`, {
          items: lines.map((line) => ({ id: line.id, quantity: line.quantity })),
        });
        changed = true;
      }
      if (coupon && !cart.coupon) {
        try {
          cart = await this.request('POST', `${this.base}/coupon.js`, { code: coupon });
          changed = true;
        } catch (error) {
          // Geçersiz eski kupon taşınmaz; satırlar sunucuda kalır. Ağ / sunucu hatası dış catch'e gider (anahtarlar korunur).
          if (!rejected(error)) throw error;
          cart = { ...cart, couponRemoved: { code: coupon, reason: (error as CrafterError).type || 'coupon_invalid' } };
        }
      }
      forget();
      if (changed) this.ping();
      return cart;
    } catch (error) {
      if (rejected(error)) forget();
      if (changed) this.ping();
      return null;
    }
  }

  private async mutate(path: string, body: Record<string, unknown>): Promise<ServerCartResponse> {
    const cart = await this.request('POST', `${this.base}/${path}`, body);
    this.ping();
    return cart;
  }

  private ping(): void {
    try {
      storage()?.setItem(CART_SYNC_KEY, String(Date.now()));
    } catch {
      // Gizli gezinme / kota: diğer sekmeler yenilenince görür
    }
  }

  private async request(method: 'GET' | 'POST', url: string, body?: Record<string, unknown>): Promise<ServerCartResponse> {
    const doFetch = this.options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
    if (!doFetch) {
      throw new CrafterError({ statusCode: 503, type: 'cart_unavailable', message: '[Crafter SDK] fetch bulunamadı' });
    }
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (method === 'POST') headers['Content-Type'] = 'application/json';
    const locale = this.options.locale?.();
    if (locale) headers['X-Crafter-Locale'] = locale;
    let response: Response;
    try {
      response = await doFetch(url, {
        method,
        headers,
        credentials: 'same-origin',
        cache: 'no-store',
        ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
      });
    } catch (error) {
      throw new CrafterError({
        statusCode: 503,
        type: 'cart_unavailable',
        message: `[Crafter SDK] Sepete ulaşılamadı: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    if (!response.ok) throw CrafterError.fromResponse(response.status, data ?? `HTTP ${response.status}`);
    return normalizeServerCart(data);
  }
}
