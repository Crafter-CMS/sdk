import { CrafterError } from '../core/errors';
import { CART_COUPON_KEY, CART_STORAGE_KEY, CART_SYNCED_KEY, normalizeLines } from './cart-store';

/**
 * Hibrit sepet (#434): storefront'un sepet uçları. Ziyaretçide sepet storefront'un imzalı çerezinde, giriş yapmış
 * müşteride sunucuda tutulur; SDK iki modu ayırt etmez. Uçlar aynı kökenli ve çerezlidir (`credentials: 'same-origin'`).
 * Fiyat gönderilmez: sunucu güncel üründen hesaplar.
 *   GET  /cart.js
 *   POST /cart/add.js     { id, quantity, options? } | { items: [{ id, quantity }], replace? }
 *                         (`replace: true`: adet verilen değere ayarlanır, toplanmaz; localStorage eşitlemesi kullanır)
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

/** localStorage sepetinin eşitlemede kullanılan hali: yalnızca ürün id + adet (fiyat sunucuda hesaplanır) */
export interface LegacyCart {
  items: Array<{ id: string; quantity: number }>;
  coupon: string | null;
  /** `cart` anahtarı var mı ('[]' dahil): sepet boşaltıldıysa satırlar sunucudan da düşer */
  present: boolean;
}

const MAX_LINE_QUANTITY = 999;

function readLegacyCart(store: Storage): LegacyCart | null {
  const stored = store.getItem(CART_STORAGE_KEY);
  const coupon = store.getItem(CART_COUPON_KEY) || null;
  if (stored === null && !coupon) return null;
  let lines: ReturnType<typeof normalizeLines> = [];
  try {
    lines = normalizeLines(JSON.parse(stored || '[]'));
  } catch {
    lines = [];
  }
  // Aynı ürün iki satırda olsa da tek satır olur
  const quantities = new Map<string, number>();
  for (const line of lines) {
    quantities.set(line.id, Math.min(MAX_LINE_QUANTITY, (quantities.get(line.id) ?? 0) + Math.min(MAX_LINE_QUANTITY, line.quantity)));
  }
  return { items: [...quantities].map(([id, quantity]) => ({ id, quantity })), coupon, present: stored !== null };
}

function readSyncedSnapshot(store: Storage): Map<string, number> | null {
  try {
    const raw: unknown = JSON.parse(store.getItem(CART_SYNCED_KEY) || 'null');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const snapshot = new Map<string, number>();
    for (const [id, quantity] of Object.entries(raw as Record<string, unknown>)) {
      const value = Math.floor(Number(quantity));
      if (id && Number.isFinite(value) && value > 0) snapshot.set(id, value);
    }
    return snapshot;
  } catch {
    return null;
  }
}

function writeSyncedSnapshot(store: Storage, items: LegacyCart['items'] | null): void {
  try {
    if (items === null) store.removeItem(CART_SYNCED_KEY);
    else store.setItem(CART_SYNCED_KEY, JSON.stringify(Object.fromEntries(items.map((item) => [item.id, item.quantity]))));
  } catch {
    // Kota / gizli gezinme: sonraki sayfada yine gönderilir; `replace` olduğundan adetler katlanmaz
  }
}

/**
 * localStorage sepetinin sunucuya uygulanacak farkı (#434 düzeltme; storefront checkout'uyla aynı kural):
 * `set` son eşitlemeden sonra eklenen / adedi değişen satırlar (adet ayarlanır), `remove` çıkarılan ürünler.
 * `synced` yoksa (ilk eşitleme) bütün satırlar yenidir. `cart` anahtarı yoksa satır silinmez.
 */
export function legacyCartDiff(
  legacy: LegacyCart,
  synced: Map<string, number> | null,
): { set: Array<{ id: string; quantity: number }>; remove: string[] } {
  const base = synced ?? new Map<string, number>();
  const current = new Set(legacy.items.map((item) => item.id));
  const set = legacy.items.filter((item) => base.get(item.id) !== item.quantity);
  const remove = legacy.present ? [...base.keys()].filter((id) => !current.has(id)) : [];
  return { set, remove };
}

/**
 * Storefront sepet uçlarının istemcisi. İlk işlemden önce localStorage sepetini sunucu sepetiyle eşitler
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
   * localStorage sepetini (`cart`: v1 temalar, SDK 1.4.0 ve öncesi, headless depo) sunucu sepetiyle eşitler; sayfa
   * başına bir kez, ilk işlemden önce çalışır. Kural storefront checkout'uyla aynıdır (#434 düzeltme):
   * - Son eşitlenen hal `crafter_cart_synced` kaydındadır. Ondan sonra eklenen ya da adedi değişen satır sunucuda bu
   *   adede ayarlanır (`/cart/add.js { items, replace: true }`, toplanmaz); `cart`'tan çıkarılan satır sunucudan da
   *   düşer (`/cart/change.js { quantity: 0 }`). Değişmeyen satır gönderilmez: sunucuda / başka cihazda yapılan
   *   değişiklik korunur, sunucuda olup `cart`'ta hiç olmayan satırlar kalır. İlk eşitlemede bütün satırlar yenidir.
   * - Sunucu sepeti dolu diye `cart` atılmaz (eski kural, eski ödenmemiş sunucu sepetinin yeni seçimin yerine geçmesine
   *   yol açıyordu). Tekrar çalışması (iki sekme, ağ hatası sonrası) sonucu değiştirmez; adetler katlanmaz.
   * - `cart` anahtarı kalır (tema sepeti); `cart` hiç yoksa sunucudan satır silinmez ve kayıt temizlenir.
   * - Ağ / sunucu hatasında kayıt güncellenmez, sonraki sayfada yeniden denenir; 4xx ret (ör. ürün satıştan kalktı)
   *   bu hali eşitlenmiş sayar.
   * - Kupon (`crafter_cart_coupon`) sunucu sepetinde kupon yoksa ve sunucu kabul ederse taşınır (#476); 4xx ret
   *   dönen sepette `couponRemoved: { code, reason }` olarak bir kez bildirilir. Denemeden sonra anahtar silinir.
   * Dönüş: eşitleme sırasında okunan son sepet (yoksa null).
   */
  public migrate(): Promise<ServerCartResponse | null> {
    if (!this.migration) this.migration = this.runMigration();
    return this.migration;
  }

  private async runMigration(): Promise<ServerCartResponse | null> {
    const store = storage();
    if (!store) return null;
    let legacy: LegacyCart | null;
    let synced: Map<string, number> | null;
    try {
      legacy = readLegacyCart(store);
      synced = readSyncedSnapshot(store);
      if (!legacy) {
        if (synced) store.removeItem(CART_SYNCED_KEY);
        return null;
      }
    } catch {
      return null;
    }
    const current = legacy;
    const rejected = (error: unknown) => {
      const status = (error as CrafterError)?.statusCode ?? 0;
      return status >= 400 && status < 500;
    };
    const { set, remove } = legacyCartDiff(current, synced);
    let changed = false;
    try {
      let cart = await this.request('GET', `${this.base}.js`);
      try {
        if (set.length) {
          cart = await this.request('POST', `${this.base}/add.js`, { items: set, replace: true });
          changed = true;
        }
        for (const id of remove) {
          cart = await this.request('POST', `${this.base}/change.js`, { id, quantity: 0 });
          changed = true;
        }
      } catch (error) {
        // 4xx: satır geçersiz, bu hal eşitlenmiş sayılır; ağ / sunucu hatası dış catch'e gider (kayıt güncellenmez)
        if (!rejected(error)) throw error;
        writeSyncedSnapshot(store, current.items);
        if (changed) this.ping();
        return null;
      }
      writeSyncedSnapshot(store, current.present ? current.items : null);
      if (current.coupon) {
        if (!cart.coupon) {
          try {
            cart = await this.request('POST', `${this.base}/coupon.js`, { code: current.coupon });
            changed = true;
          } catch (error) {
            // Geçersiz eski kupon taşınmaz. Ağ / sunucu hatası dış catch'e gider (kupon anahtarı korunur).
            if (!rejected(error)) throw error;
            cart = { ...cart, couponRemoved: { code: current.coupon, reason: (error as CrafterError).type || 'coupon_invalid' } };
          }
        }
        try {
          store.removeItem(CART_COUPON_KEY);
        } catch {
          // yok sayılır
        }
      }
      if (changed) this.ping();
      return cart;
    } catch {
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
