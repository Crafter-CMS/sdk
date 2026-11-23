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
import { DomEvents } from '../core/dom-events';

/** Sepete eklenecek ürün; tema genelde `data-*` özniteliklerinden verir */
export interface CartAddInput {
  id: string | number;
  name?: string;
  /** Birim fiyat, mağaza para biriminde */
  price?: number | string;
  discountType?: string | null;
  discountValue?: number | string | null;
  image?: string | null;
  images?: string[];
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
}

export interface CartModuleDeps {
  /** Sepet deposu; varsayılan localStorage ('cart'). Hibrit sepet (#434) sunucu deposu verir. */
  store?: CartStore;
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

export class CartModule {
  private payments: PaymentsModule;
  private store: CartStore;
  private dom: DomEvents;
  private storeCurrency: () => string;

  constructor(
    private http: HttpClient,
    private events: EventEmitter,
    private options: PaymentsModuleOptions = {},
    deps: CartModuleDeps = {}
  ) {
    this.payments = new PaymentsModule(http, events, options);
    this.store = deps.store ?? new LocalStorageCartStore();
    this.dom = deps.dom ?? new DomEvents(events);
    this.storeCurrency = deps.storeCurrency ?? (() => '');
    // Başka sekmedeki değişiklik bu sayfada da `cart:updated` yayar
    this.store.subscribe(() => {
      void this.get().then((cart) => this.dom.emit('cart:updated', cart));
    });
  }

  // ===================== Sepet içeriği (#447) =====================

  /** Sepetin güncel hali */
  public async get(): Promise<CartState> {
    const [lines, coupon] = await Promise.all([this.store.read(), this.store.readCoupon()]);
    const items: CartLine[] = lines.map((line) => {
      const unitPrice = discountedUnitPrice(line);
      return { ...line, image: line.images?.[0] || null, unitPrice, lineTotal: unitPrice * line.quantity };
    });
    return {
      items,
      itemCount: items.reduce((sum, line) => sum + line.quantity, 0),
      subtotal: items.reduce((sum, line) => sum + line.lineTotal, 0),
      currency: this.storeCurrency(),
      coupon,
    };
  }

  /** Ürünü ekler; sepette varsa adedi artar. `crafter:cart:updated` yayar. */
  public async add(product: CartAddInput, quantity = 1): Promise<CartState> {
    if (product?.id === undefined || product.id === null || product.id === '') {
      throw new TypeError('[Crafter SDK] cart.add: ürün id gerekli');
    }
    const id = String(product.id);
    const amount = Math.max(1, Math.floor(Number(quantity) || 1));
    const lines = await this.store.read();
    const existing = lines.find((line) => line.id === id);
    if (existing) {
      existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + amount);
    } else {
      const images = Array.isArray(product.images) ? product.images.filter(Boolean) : product.image ? [product.image] : [];
      lines.push(
        ...normalizeLines([
          {
            id,
            name: product.name ?? '',
            price: Number(product.price) || 0,
            quantity: Math.min(MAX_QUANTITY, amount),
            discountType: product.discountType || null,
            discountValue: product.discountValue ?? null,
            images,
          },
        ])
      );
    }
    return this.commit(lines);
  }

  /** Satırın adedini ayarlar; 0 ya da altı satırı siler */
  public async update(id: string | number, quantity: number): Promise<CartState> {
    const key = String(id);
    const next = Math.floor(Number(quantity) || 0);
    const lines = (await this.store.read())
      .map((line) => (line.id === key ? { ...line, quantity: Math.min(MAX_QUANTITY, next) } : line))
      .filter((line) => line.quantity > 0);
    return this.commit(lines);
  }

  public async remove(id: string | number): Promise<CartState> {
    const key = String(id);
    return this.commit((await this.store.read()).filter((line) => line.id !== key));
  }

  /** Sepeti ve kuponu boşaltır */
  public async clear(): Promise<CartState> {
    await this.store.writeCoupon(null);
    return this.commit([]);
  }

  /** Checkout'ta uygulanacak kupon kodu; null kaldırır */
  public async setCoupon(code: string | null): Promise<CartState> {
    await this.store.writeCoupon(code ? String(code).trim() || null : null);
    return this.commit(await this.store.read());
  }

  private async commit(lines: StoredCartLine[]): Promise<CartState> {
    await this.store.write(lines);
    const cart = await this.get();
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

