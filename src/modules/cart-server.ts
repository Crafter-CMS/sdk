import { CrafterError } from '../core/errors';
import { CART_COUPON_KEY, CART_STORAGE_KEY, CART_SYNCED_KEY, normalizeLines } from './cart-store';

/**
 * Hybrid cart (#434): the storefront's cart endpoints. For a visitor the cart is kept in the storefront's signed cookie, for a
 * logged-in customer on the server; the SDK does not tell the two modes apart. The endpoints are same-origin with cookies (`credentials: 'same-origin'`).
 * No price is sent: the server calculates it from the current product.
 *   GET  /cart.js
 *   POST /cart/add.js     { id, quantity, options? } | { items: [{ id, quantity }], replace? }
 *                         (`replace: true`: the quantity is set to the given value, not added; used by the localStorage sync)
 *   POST /cart/change.js  { id, quantity }   (0 removes; id is a product id or a line key)
 *   POST /cart/clear.js
 *   POST /cart/coupon.js  { code | null }  (invalid coupon: 422 + `type`, the cart does not change; null / '' removes)
 */

/** Line returned by the server */
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

/** Line dropped from the cart: `not_found`, `unavailable`, `out_of_stock`, `cart_full` */
export interface CartRemovedNote {
  productId: string;
  key?: string;
  name?: string | null;
  quantity: number;
  reason: string;
}

/** Line whose quantity was reduced: `stock_limit`, `max_quantity` */
export interface CartAdjustedNote {
  productId: string;
  key?: string;
  name?: string | null;
  from: number;
  to: number;
  reason: string;
}

/** Details of the valid coupon in the cart (#476) */
export interface CartCouponDetails {
  code: string;
  type: 'percentage' | 'fixed' | 'free_product';
  /** Percentage or amount in the store currency; may be null for `free_product` */
  value: number | null;
  /** Gift product for a `free_product` coupon; null for others */
  freeProductId: string | null;
}

/** A stored coupon became invalid and was dropped from the cart (#476); `reason` is the coupon error code (see `CouponErrorType`) */
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
  /** Coupon discount in the store currency (#476); 0 without a coupon */
  discount?: number;
  /** Amount to pay: `subtotal - discount` (at least 0), in the store currency (#476) */
  total?: number;
  /** Details of the valid coupon (#476); null without a coupon */
  couponDetails?: CartCouponDetails | null;
  /** Reported once if a stored coupon was dropped (#476); null otherwise */
  couponRemoved?: CartCouponRemovedNote | null;
  removed?: CartRemovedNote[];
  adjusted?: CartAdjustedNote[];
  mode?: 'guest' | 'customer';
}

export interface ServerCartClientOptions {
  /** Root of the endpoints (the context's `routes.cartApi` value, e.g. '/cart') */
  cartApi: string;
  /** Language of product names (`X-Crafter-Locale`) */
  locale?: () => string | undefined;
  fetchImpl?: typeof fetch;
}

/** "Cart changed" signal for other tabs (timestamp only) */
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

/** Normalizes the response into a type-safe shape; corrupt lines are dropped */
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
  // Old storefronts send no discount: discount 0, total = subtotal
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

/** The localStorage cart as used by the sync: only product id + quantity (the price is calculated on the server) */
export interface LegacyCart {
  items: Array<{ id: string; quantity: number }>;
  coupon: string | null;
  /** Whether the `cart` key exists (including '[]'): if the cart was emptied, the lines are dropped on the server too */
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
  // Even if the same product is on two lines it becomes one line
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
    // Quota / private browsing: sent again on the next page; quantities do not double because of `replace`
  }
}

/**
 * Difference of the localStorage cart to apply to the server (#434 fix; same rule as the storefront checkout):
 * `set` lines added / whose quantity changed since the last sync (the quantity is set), `remove` products that were removed.
 * Without `synced` (first sync) all lines are new. Without the `cart` key no line is removed.
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
 * Client for the storefront cart endpoints. Before the first operation it syncs the localStorage cart with the server cart
 * (`migrate`); after every change it writes a `crafter_cart_sync` signal for other tabs.
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
    // The cart read during migration is only used for the first read
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

  /** Called when it changes in another tab; returns a function that unsubscribes */
  public subscribe(onChange: () => void): () => void {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {};
    const listener = (event: StorageEvent) => {
      if (event.key === CART_SYNC_KEY) onChange();
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }

  /**
   * Syncs the localStorage cart (`cart`: v1 themes, SDK 1.4.0 and earlier, headless store) with the server cart; runs once
   * per page, before the first operation. The rule matches the storefront checkout (#434 fix):
   * - The last synced state is in the `crafter_cart_synced` record. A line added or whose quantity changed after that is set to
   *   this quantity on the server (`/cart/add.js { items, replace: true }`, not added); a line removed from `cart` is dropped
   *   on the server too (`/cart/change.js { quantity: 0 }`). Unchanged lines are not sent: changes made on the server / another
   *   device are kept, and lines that are on the server but never in `cart` stay. On the first sync all lines are new.
   * - `cart` is not discarded just because the server cart is not empty (the old rule let an old unpaid server cart replace
   *   the new selection). Running again (two tabs, after a network error) does not change the result; quantities do not double.
   * - The `cart` key stays (the theme cart); if `cart` does not exist at all, no line is removed on the server and the record is cleared.
   * - On a network / server error the record is not updated and it is retried on the next page; a 4xx rejection (e.g. the product
   *   was taken off sale) counts this state as synced.
   * - The coupon (`crafter_cart_coupon`) is moved if the server cart has no coupon and the server accepts it (#476); a 4xx rejection
   *   is reported once in the returned cart as `couponRemoved: { code, reason }`. The key is removed after the attempt.
   * Returns: the last cart read during the sync (null if none).
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
        // 4xx: the line is invalid, this state counts as synced; network / server errors go to the outer catch (the record is not updated)
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
            // An invalid old coupon is not moved. Network / server errors go to the outer catch (the coupon key is kept).
            if (!rejected(error)) throw error;
            cart = { ...cart, couponRemoved: { code: current.coupon, reason: (error as CrafterError).type || 'coupon_invalid' } };
          }
        }
        try {
          store.removeItem(CART_COUPON_KEY);
        } catch {
          // ignored
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
      // Private browsing / quota: other tabs see it when they reload
    }
  }

  private async request(method: 'GET' | 'POST', url: string, body?: Record<string, unknown>): Promise<ServerCartResponse> {
    const doFetch = this.options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
    if (!doFetch) {
      throw new CrafterError({ statusCode: 503, type: 'cart_unavailable', message: '[Crafter SDK] fetch is not available' });
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
        message: `[Crafter SDK] Could not reach the cart: ${error instanceof Error ? error.message : String(error)}`,
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
