import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { CheckoutPaymentResponse, CustomerCurrencyOptions, PresentmentQuote, PurchaseDto, PurchaseResponse } from '../types';
import {
  LegalTermsConsent,
  legalTermsHeaders,
  normalizePaymentResponse,
  PaymentsModule,
  PaymentsModuleOptions,
  payWithQuote,
} from './payments';
import { CartStore, LocalStorageCartStore, normalizeLines, StoredCartLine } from './cart-store';
import {
  CartAdjustedNote,
  CartCouponDetails,
  CartCouponRemovedNote,
  CartRemovedNote,
  ServerCartClient,
  ServerCartResponse,
} from './cart-server';
import { DomEvents } from '../core/dom-events';

/** Sepete eklenecek ürün; tema genelde `data-*` özniteliklerinden verir */
export interface CartAddInput {
  id: string | number;
  name?: string;
  /** Birim fiyat, mağaza para biriminde. Storefront sepetinde gönderilmez: fiyatı sunucu hesaplar. */
  price?: number | string;
  discountType?: string | null;
  discountValue?: number | string | null;
  image?: string | null;
  images?: string[];
  /** Varyant / seçenekler (storefront sepeti) */
  options?: Record<string, string> | null;
}

/** Sepet satırı: depodaki alanlar + hesaplananlar (mağaza para biriminde) */
export interface CartLine extends StoredCartLine {
  /** İlk görsel; yoksa null */
  image: string | null;
  /** İndirim uygulanmış birim fiyat */
  unitPrice: number;
  lineTotal: number;
}

export interface CartState {
  items: CartLine[];
  /** Toplam adet */
  itemCount: number;
  /** Ara toplam, mağaza para biriminde; gösterim için `crafter.money.format(cart.subtotal)` */
  subtotal: number;
  /** Mağaza para birimi (sayfa bağlamından); bilinmiyorsa boş */
  currency: string;
  coupon: string | null;
  /**
   * Kupon indirimi, mağaza para biriminde (#476); kupon yoksa 0. localStorage sepeti kuponu doğrulayamaz: her zaman 0.
   */
  discount?: number;
  /** Ödenecek tutar: `subtotal - discount` (en az 0), mağaza para biriminde (#476) */
  total?: number;
  /** Geçerli kuponun ayrıntısı (#476): `code`, `type`, `value`, `freeProductId`; kupon yoksa (ya da localStorage) null */
  couponDetails?: CartCouponDetails | null;
  /**
   * Storefront sepeti (#476): saklı kupon geçersizleştiği için düşürüldüyse bir kez bildirilir (`code`, `reason`:
   * `CouponErrorType` kodu, ör. `coupon_cart_total_below_minimum`); yoksa null
   */
  couponRemoved?: CartCouponRemovedNote | null;
  /** Storefront sepeti (#434): satıştan kalkan / tükenen ürün düştüyse bir kez bildirilir */
  removed?: CartRemovedNote[];
  /** Storefront sepeti (#434): adet stoğa göre düşürüldüyse bir kez bildirilir */
  adjusted?: CartAdjustedNote[];
}

/** Sepetin işlemleri; `crafter.cart` bunlara devreder (localStorage ya da storefront sunucusu) */
export interface CartBackend {
  get(): Promise<CartState>;
  add(product: CartAddInput, quantity: number): Promise<CartState>;
  update(id: string, quantity: number): Promise<CartState>;
  remove(id: string): Promise<CartState>;
  clear(): Promise<CartState>;
  setCoupon(code: string | null): Promise<CartState>;
  /** Başka sekmede değişince çağrılır; aboneliği kaldıran fonksiyon döner */
  subscribe(onChange: () => void): () => void;
}

export interface CartModuleDeps {
  /** Sepet deposu (localStorage 'cart' biçimi). Verilirse her zaman bu depo kullanılır. */
  store?: CartStore;
  /**
   * Storefront sepet uçları (#434): bağlamın `routes.cartApi` değeri (ör. '/cart'). Verilirse sepet sunucudadır
   * (ziyaretçide imzalı çerez, giriş yapınca hesap); yoksa localStorage.
   */
  cartApi?: string | null;
  /** Storefront sepetinde ürün adlarının dili */
  locale?: () => string | undefined;
  /** Testler için */
  fetchImpl?: typeof fetch;
  dom?: DomEvents;
  storeCurrency?: () => string;
}

/** İndirim uygulanmış birim fiyat: 'percentage' yüzde, diğer tipler sabit tutar (checkout ile aynı kural) */
export function discountedUnitPrice(line: Pick<StoredCartLine, 'price' | 'discountType' | 'discountValue'>): number {
  const price = Number(line.price) || 0;
  const discount = Number(line.discountValue) || 0;
  if (!line.discountType || discount <= 0) return price;
  return line.discountType === 'percentage'
    ? Math.max(0, price - (price * discount) / 100)
    : Math.max(0, price - discount);
}

const MAX_QUANTITY = 999;

/** localStorage sepeti (#447): headless kullanım ve sepet uçları olmayan sayfalar */
export class LocalCartBackend implements CartBackend {
  constructor(private store: CartStore, private storeCurrency: () => string) {}

  public async get(): Promise<CartState> {
    const [lines, coupon] = await Promise.all([this.store.read(), this.store.readCoupon()]);
    const items: CartLine[] = lines.map((line) => {
      const unitPrice = discountedUnitPrice(line);
      return { ...line, image: line.images?.[0] || null, unitPrice, lineTotal: unitPrice * line.quantity };
    });
    const subtotal = items.reduce((sum, line) => sum + line.lineTotal, 0);
    // Kupon burada doğrulanamaz: indirimi checkout hesaplar
    return {
      items,
      itemCount: items.reduce((sum, line) => sum + line.quantity, 0),
      subtotal,
      currency: this.storeCurrency(),
      coupon,
      discount: 0,
      total: subtotal,
      couponDetails: null,
      couponRemoved: null,
    };
  }

  public async add(product: CartAddInput, quantity: number): Promise<CartState> {
    const id = String(product.id);
    const lines = await this.store.read();
    const existing = lines.find((line) => line.id === id);
    if (existing) {
      existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + quantity);
    } else {
      const images = Array.isArray(product.images) ? product.images.filter(Boolean) : product.image ? [product.image] : [];
      lines.push(
        ...normalizeLines([
          {
            id,
            name: product.name ?? '',
            price: Number(product.price) || 0,
            quantity: Math.min(MAX_QUANTITY, quantity),
            discountType: product.discountType || null,
            discountValue: product.discountValue ?? null,
            images,
          },
        ])
      );
    }
    return this.commit(lines);
  }

  public async update(id: string, quantity: number): Promise<CartState> {
    const lines = (await this.store.read())
      .map((line) => (line.id === id ? { ...line, quantity: Math.min(MAX_QUANTITY, quantity) } : line))
      .filter((line) => line.quantity > 0);
    return this.commit(lines);
  }

  public async remove(id: string): Promise<CartState> {
    return this.commit((await this.store.read()).filter((line) => line.id !== id));
  }

  public async clear(): Promise<CartState> {
    await this.store.writeCoupon(null);
    return this.commit([]);
  }

  public async setCoupon(code: string | null): Promise<CartState> {
    await this.store.writeCoupon(code);
    return this.commit(await this.store.read());
  }

  public subscribe(onChange: () => void): () => void {
    return this.store.subscribe(onChange);
  }

  private async commit(lines: StoredCartLine[]): Promise<CartState> {
    await this.store.write(lines);
    return this.get();
  }
}

/** Sunucu yanıtı → `CartState` (tutarlar mağaza para biriminde, sunucu hesaplar) */
export function cartStateFromServer(cart: ServerCartResponse, fallbackCurrency = ''): CartState {
  return {
    items: cart.items.map((line) => ({
      ...line,
      image: line.image ?? line.images?.[0] ?? null,
      images: line.images ?? [],
    })) as CartLine[],
    itemCount: cart.itemCount,
    subtotal: cart.subtotal,
    currency: cart.currency || fallbackCurrency,
    coupon: cart.coupon,
    discount: cart.discount ?? 0,
    total: cart.total ?? Math.max(0, cart.subtotal - (cart.discount ?? 0)),
    couponDetails: cart.couponDetails ?? null,
    couponRemoved: cart.couponRemoved ?? null,
    removed: cart.removed ?? [],
    adjusted: cart.adjusted ?? [],
  };
}

/** Storefront sepeti (#434): `/cart.js` ve `/cart/*.js` uçları; fiyat gönderilmez */
export class ServerCartBackend implements CartBackend {
  constructor(private client: ServerCartClient, private storeCurrency: () => string) {}

  public async get(): Promise<CartState> {
    return this.state(await this.client.get());
  }

  public async add(product: CartAddInput, quantity: number): Promise<CartState> {
    return this.state(await this.client.add(String(product.id), quantity, product.options ?? null));
  }

  public async update(id: string, quantity: number): Promise<CartState> {
    return this.state(await this.client.change(id, Math.max(0, quantity)));
  }

  public async remove(id: string): Promise<CartState> {
    return this.state(await this.client.change(id, 0));
  }

  public async clear(): Promise<CartState> {
    return this.state(await this.client.clear());
  }

  public async setCoupon(code: string | null): Promise<CartState> {
    return this.state(await this.client.setCoupon(code));
  }

  public subscribe(onChange: () => void): () => void {
    return this.client.subscribe(onChange);
  }

  private state(cart: ServerCartResponse): CartState {
    return cartStateFromServer(cart, this.storeCurrency());
  }
}

export class CartModule {
  private payments: PaymentsModule;
  private backend: CartBackend;
  private dom: DomEvents;

  constructor(
    private http: HttpClient,
    private events: EventEmitter,
    private options: PaymentsModuleOptions = {},
    deps: CartModuleDeps = {}
  ) {
    this.payments = new PaymentsModule(http, events, options);
    this.dom = deps.dom ?? new DomEvents(events);
    const storeCurrency = deps.storeCurrency ?? (() => '');
    // Açık depo verildiyse o; storefront bağlamı sepet uçlarını bildiriyorsa sunucu; değilse localStorage
    this.backend =
      !deps.store && typeof deps.cartApi === 'string' && deps.cartApi.trim()
        ? new ServerCartBackend(
            new ServerCartClient({ cartApi: deps.cartApi.trim(), locale: deps.locale, fetchImpl: deps.fetchImpl }),
            storeCurrency
          )
        : new LocalCartBackend(deps.store ?? new LocalStorageCartStore(), storeCurrency);
    // Başka sekmedeki değişiklik bu sayfada da `cart:updated` yayar
    this.backend.subscribe(() => {
      void this.get()
        .then((cart) => this.dom.emit('cart:updated', cart))
        .catch(() => undefined);
    });
  }

  /** Sepet sunucuda mı (storefront sepet uçları) */
  public get isServerBacked(): boolean {
    return this.backend instanceof ServerCartBackend;
  }

  // ===================== Sepet içeriği (#447, #434) =====================

  /** Sepetin güncel hali */
  public async get(): Promise<CartState> {
    return this.backend.get();
  }

  /** Ürünü ekler; sepette varsa adedi artar. `crafter:cart:updated` yayar. */
  public async add(product: CartAddInput, quantity = 1): Promise<CartState> {
    if (product?.id === undefined || product.id === null || product.id === '') {
      throw new TypeError('[Crafter SDK] cart.add: ürün id gerekli');
    }
    const amount = Math.min(MAX_QUANTITY, Math.max(1, Math.floor(Number(quantity) || 1)));
    return this.emit(this.backend.add(product, amount));
  }

  /** Satırın adedini ayarlar; 0 ya da altı satırı siler */
  public async update(id: string | number, quantity: number): Promise<CartState> {
    const next = Math.min(MAX_QUANTITY, Math.floor(Number(quantity) || 0));
    return this.emit(this.backend.update(String(id), next));
  }

  public async remove(id: string | number): Promise<CartState> {
    return this.emit(this.backend.remove(String(id)));
  }

  /** Sepeti ve kuponu boşaltır */
  public async clear(): Promise<CartState> {
    return this.emit(this.backend.clear());
  }

  /**
   * Kuponu uygular; null / boş kaldırır. Storefront sepetinde sunucu hemen doğrular (#476): geçerliyse `discount`,
   * `total`, `couponDetails` dolu döner; geçersizse `CrafterCouponError` (HTTP 422; `type`: `CouponErrorType`,
   * `message` sayfanın dilinde, `details.minCartValue`) fırlatılır, sepet değişmez ve `crafter:cart:updated` yayılmaz.
   * localStorage sepeti kuponu doğrulayamaz: kodu saklar, indirimi checkout hesaplar.
   */
  public async setCoupon(code: string | null): Promise<CartState> {
    return this.emit(this.backend.setCoupon(code ? String(code).trim() || null : null));
  }

  /** Kuponu kaldırır (`setCoupon(null)`) */
  public async removeCoupon(): Promise<CartState> {
    return this.setCoupon(null);
  }

  private async emit(pending: Promise<CartState>): Promise<CartState> {
    const cart = await pending;
    this.dom.emit('cart:updated', cart);
    return cart;
  }

  // ===================== Ödeme =====================

  /**
   * Complete purchase using user balance.
   * POST /marketplace/purchase
   */
  public async purchase(data: PurchaseDto): Promise<PurchaseResponse> {
    const payload: Record<string, any> = {
      coupon: data.coupon || (data as any).couponCode || null,
    };

    if (data.productIds !== undefined) payload.productIds = data.productIds;
    if (data.items !== undefined) payload.items = data.items;
    if (data.quantities !== undefined) payload.quantities = data.quantities;

    const response = await this.http.post<PurchaseResponse>('/marketplace/purchase', payload);
    this.events.emit('cart:purchased', response);
    return response;
  }

  /**
   * Pay the cart at a provider. The charged amount is the storefront total.
   * Balance is not credited and the top-up multiplier is not applied.
   * Satıcı LLC + CrafterPayments iken yanıtta `stripe` (clientSecret, publishableKey, vergi kırılımı) bulunur.
   * Stok yetersizse `CrafterOutOfStockError` (HTTP 409, `productIds`) fırlatılır.
   * Para birimini sunucu belirler; `currency` verilmezse gönderilmez. `{ useCustomerCurrency: true }` ile önce kilitli
   * kur teklifi alınır ve ödeme müşteri para biriminde başlatılır (bkz. `payWithQuote`).
   * POST /payment/checkout
   */
  public async checkout(data: PurchaseDto & {
    providerId: string;
    websiteId: string;
    provider?: string;
    /** Yalnızca teklifin para birimi (`quoteId` ile); verilmezse sunucu mağaza para birimini kullanır */
    currency?: string;
    /** Kilitli kur teklifi (`payments.quote`) */
    quoteId?: string;
    paymentDetails?: Record<string, any>;
    user: { name: string; email: string; phone?: string; address?: string };
    /** Alıcının ülkesi (ISO 3166-1 alpha-2); satıcı LLC iken Stripe Tax vergi konumu */
    billingCountry?: string;
    /** ABD / Kanada için posta kodu (Stripe Tax) */
    billingPostalCode?: string;
  }, options: { legalTerms?: LegalTermsConsent } & CustomerCurrencyOptions = {}): Promise<CheckoutPaymentResponse> {
    const coupon = data.coupon || (data as any).couponCode || undefined;
    const send = async (quote: PresentmentQuote | null): Promise<CheckoutPaymentResponse> => {
      const payload = this.checkoutPayload(data, coupon);
      if (quote) {
        payload.quoteId = quote.quoteId;
        payload.currency = quote.currency;
      } else if (options.useCustomerCurrency) {
        // Teklifsiz ödeme mağaza para biriminde: para birimini sunucu belirler
        delete payload.quoteId;
        delete payload.currency;
      }
      const raw = await this.http.post<CheckoutPaymentResponse>('/payment/checkout', payload, {
        headers: legalTermsHeaders(options.legalTerms),
      });
      return normalizePaymentResponse(raw, this.options.stripePublishableKey);
    };

    const response = options.useCustomerCurrency
      ? await payWithQuote(
          () =>
            this.payments.quote({
              websiteId: data.websiteId,
              kind: 'cart',
              currency: options.customerCurrency,
              coupon,
              productIds: data.productIds,
              items: data.items,
              quantities: data.quantities,
            }),
          send
        )
      : await send(null);
    this.events.emit('cart:checkout', response);
    return response;
  }

  private checkoutPayload(data: Parameters<CartModule['checkout']>[0], coupon: string | undefined): Record<string, any> {
    const payload: Record<string, any> = {
      providerId: data.providerId,
      websiteId: data.websiteId,
      coupon,
      user: data.user,
    };
    if (data.currency) payload.currency = data.currency;
    if (data.quoteId) payload.quoteId = data.quoteId;
    if (data.provider !== undefined) payload.provider = data.provider;
    if (data.paymentDetails !== undefined) payload.paymentDetails = data.paymentDetails;
    if (data.productIds !== undefined) payload.productIds = data.productIds;
    if (data.items !== undefined) payload.items = data.items;
    if (data.quantities !== undefined) payload.quantities = data.quantities;
    if (data.billingCountry !== undefined) payload.billingCountry = data.billingCountry;
    if (data.billingPostalCode !== undefined) payload.billingPostalCode = data.billingPostalCode;
    return payload;
  }
}

