/**
 * localStorage sepet deposu (#447): 'cart' ve 'crafter_cart_coupon' anahtarları. Headless kullanımda ve sepet uçları
 * olmayan sayfalarda kullanılır. Storefront içinde sepet sunucudadır (#434, `cart-server.ts`); bu anahtarlar oradan
 * bir kez taşınıp silinir.
 */

/** Depodaki satır: checkout'un okuduğu alanlar */
export interface StoredCartLine {
  id: string;
  name: string;
  /** Birim fiyat, mağaza para biriminde (indirimsiz) */
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
  /** Başka sekmede ya da dışarıda değişince çağrılır; aboneliği kaldıran fonksiyon döner */
  subscribe(onChange: () => void): () => void;
}

export const CART_STORAGE_KEY = 'cart';
export const CART_COUPON_KEY = 'crafter_cart_coupon';

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** Bozuk kayıtları ayıklar; id'siz satır atılır, miktar en az 1 tam sayı */
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
      else store.removeItem(CART_STORAGE_KEY);
    } catch {
      // Gizli gezinme / kota: sepet yalnızca bu sayfada kalır
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
      // yok sayılır
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
