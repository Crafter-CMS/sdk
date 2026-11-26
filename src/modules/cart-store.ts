/**
 * localStorage cart store (#447): the 'cart' and 'crafter_cart_coupon' keys. Used in headless mode and on pages without
 * cart endpoints. Inside the storefront the cart lives on the server (#434, `cart-server.ts`); the `cart` record is synced
 * to the server cart by its changed lines (`crafter_cart_synced` keeps the last synced state), the coupon is moved once.
 */

/** Line in the store: the fields checkout reads */
export interface StoredCartLine {
  id: string;
  name: string;
  /** Unit price in the store currency (before discount) */
  price: number;
  quantity: number;
  discountType?: string | null;
  discountValue?: number | null;
  images?: string[];
  [key: string]: unknown;
}

export interface CartStore {
  read(): Promise<StoredCartLine[]>;
  write(lines: StoredCartLine[]): Promise<void>;
  readCoupon(): Promise<string | null>;
  writeCoupon(code: string | null): Promise<void>;
  /** Called when it changes in another tab or elsewhere; returns a function that unsubscribes */
  subscribe(onChange: () => void): () => void;
}

export const CART_STORAGE_KEY = 'cart';
export const CART_COUPON_KEY = 'crafter_cart_coupon';
/**
 * The last synced localStorage cart (#434 fix): `{ [product id]: quantity }`. The storefront checkout uses the same key and
 * format; lines in the `cart` record that change after this are applied to the server cart.
 */
export const CART_SYNCED_KEY = 'crafter_cart_synced';

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Drops corrupt records; lines without an id are dropped, quantity is an integer of at least 1 */
export function normalizeLines(raw: unknown): StoredCartLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, any> => !!item && typeof item === 'object' && !!item.id)
    .map((item) => {
      const images = Array.isArray(item.images) ? item.images.filter((src: unknown) => typeof src === 'string' && src) : [];
      if (!images.length && typeof item.image === 'string' && item.image) images.push(item.image);
      return {
        ...item,
        id: String(item.id),
        name: typeof item.name === 'string' ? item.name : '',
        price: Number(item.price) || 0,
        quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
        discountType: typeof item.discountType === 'string' && item.discountType ? item.discountType : null,
        discountValue: item.discountValue != null && item.discountValue !== '' ? Number(item.discountValue) : null,
        images,
      };
    });
}

export class LocalStorageCartStore implements CartStore {
  public async read(): Promise<StoredCartLine[]> {
    const store = storage();
    if (!store) return [];
    try {
      return normalizeLines(JSON.parse(store.getItem(CART_STORAGE_KEY) || '[]'));
    } catch {
      return [];
    }
  }

  public async write(lines: StoredCartLine[]): Promise<void> {
    const store = storage();
    if (!store) return;
    try {
      if (lines.length) store.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
      // If a cart synced to the server was emptied, '[]' remains: a missing key does not count as "emptied", lines would not drop
      else if (store.getItem(CART_SYNCED_KEY) !== null) store.setItem(CART_STORAGE_KEY, '[]');
      else store.removeItem(CART_STORAGE_KEY);
    } catch {
      // Private browsing / quota: the cart stays on this page only
    }
  }

  public async readCoupon(): Promise<string | null> {
    try {
      return storage()?.getItem(CART_COUPON_KEY) || null;
    } catch {
      return null;
    }
  }

  public async writeCoupon(code: string | null): Promise<void> {
    const store = storage();
    if (!store) return;
    try {
      if (code) store.setItem(CART_COUPON_KEY, code);
      else store.removeItem(CART_COUPON_KEY);
    } catch {
      // ignored
    }
  }

  public subscribe(onChange: () => void): () => void {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return () => {};
    const listener = (event: StorageEvent) => {
      if (event.key === null || event.key === CART_STORAGE_KEY || event.key === CART_COUPON_KEY) onChange();
    };
    window.addEventListener('storage', listener);
    return () => window.removeEventListener('storage', listener);
  }
}
