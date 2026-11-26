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

/** Product to add to the cart; themes usually pass it from `data-*` attributes */
export interface CartAddInput {
  id: string | number;
  name?: string;
  /** Unit price in the store currency. Not sent for the storefront cart: the server calculates the price. */
  price?: number | string;
  discountType?: string | null;
  discountValue?: number | string | null;
  image?: string | null;
  images?: string[];
  /** Variant / options (storefront cart) */
  options?: Record<string, string> | null;
}

/** Cart line: stored fields + calculated ones (in the store currency) */
export interface CartLine extends StoredCartLine {
  /** First image; null if none */
  image: string | null;
  /** Unit price with the discount applied */
  unitPrice: number;
  lineTotal: number;
}

export interface CartState {
  items: CartLine[];
  /** Total quantity */
  itemCount: number;
  /** Subtotal in the store currency; for display use `crafter.money.format(cart.subtotal)` */
  subtotal: number;
  /** Store currency (from the page context); empty if unknown */
  currency: string;
  coupon: string | null;
  /**
   * Coupon discount in the store currency (#476); 0 without a coupon. The localStorage cart cannot validate coupons: always 0.
   */
  discount?: number;
  /** Amount to pay: `subtotal - discount` (at least 0), in the store currency (#476) */
  total?: number;
  /** Details of the valid coupon (#476): `code`, `type`, `value`, `freeProductId`; null without a coupon (or with localStorage) */
  couponDetails?: CartCouponDetails | null;
  /**
   * Storefront cart (#476): reported once if a stored coupon was dropped because it became invalid (`code`, `reason`:
   * a `CouponErrorType` code, e.g. `coupon_cart_total_below_minimum`); null otherwise
   */
  couponRemoved?: CartCouponRemovedNote | null;
  /** Storefront cart (#434): reported once if a product that was taken off sale / sold out was dropped */
  removed?: CartRemovedNote[];
  /** Storefront cart (#434): reported once if a quantity was reduced to match stock */
  adjusted?: CartAdjustedNote[];
}

/** Cart operations; `crafter.cart` delegates to these (localStorage or the storefront server) */
export interface CartBackend {
  get(): Promise<CartState>;
  add(product: CartAddInput, quantity: number): Promise<CartState>;
  update(id: string, quantity: number): Promise<CartState>;
  remove(id: string): Promise<CartState>;
  clear(): Promise<CartState>;
  setCoupon(code: string | null): Promise<CartState>;
  /** Called when it changes in another tab; returns a function that unsubscribes */
  subscribe(onChange: () => void): () => void;
}

export interface CartModuleDeps {
  /** Cart store (localStorage 'cart' format). If given, this store is always used. */
  store?: CartStore;
  /**
   * Storefront cart endpoints (#434): the context's `routes.cartApi` value (e.g. '/cart'). If given, the cart lives on the server
   * (a signed cookie for visitors, the account once logged in); otherwise localStorage.
   */
  cartApi?: string | null;
  /** Language of product names in the storefront cart */
  locale?: () => string | undefined;
  /** For tests */
  fetchImpl?: typeof fetch;
  dom?: DomEvents;
  storeCurrency?: () => string;
}

/** Unit price with the discount applied: 'percentage' is a percentage, other types are a fixed amount (same rule as checkout) */
export function discountedUnitPrice(line: Pick<StoredCartLine, 'price' | 'discountType' | 'discountValue'>): number {
  const price = Number(line.price) || 0;
  const discount = Number(line.discountValue) || 0;
  if (!line.discountType || discount <= 0) return price;
  return line.discountType === 'percentage'
    ? Math.max(0, price - (price * discount) / 100)
    : Math.max(0, price - discount);
}

const MAX_QUANTITY = 999;

/** localStorage cart (#447): headless use and pages without cart endpoints */
export class LocalCartBackend implements CartBackend {
  constructor(private store: CartStore, private storeCurrency: () => string) {}

  public async get(): Promise<CartState> {
    const [lines, coupon] = await Promise.all([this.store.read(), this.store.readCoupon()]);
    const items: CartLine[] = lines.map((line) => {
      const unitPrice = discountedUnitPrice(line);
      return { ...line, image: line.images?.[0] || null, unitPrice, lineTotal: unitPrice * line.quantity };
    });
    const subtotal = items.reduce((sum, line) => sum + line.lineTotal, 0);
    // The coupon cannot be validated here: checkout calculates the discount
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

/** Server response → `CartState` (amounts in the store currency, calculated by the server) */
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

/** Storefront cart (#434): `/cart.js` and `/cart/*.js` endpoints; no price is sent */
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
    // An explicit store if given; the server if the storefront context announces cart endpoints; otherwise localStorage
    this.backend =
      !deps.store && typeof deps.cartApi === 'string' && deps.cartApi.trim()
        ? new ServerCartBackend(
            new ServerCartClient({ cartApi: deps.cartApi.trim(), locale: deps.locale, fetchImpl: deps.fetchImpl }),
            storeCurrency
          )
        : new LocalCartBackend(deps.store ?? new LocalStorageCartStore(), storeCurrency);
    // A change in another tab also emits `cart:updated` on this page
    this.backend.subscribe(() => {
      void this.get()
        .then((cart) => this.dom.emit('cart:updated', cart))
        .catch(() => undefined);
    });
  }

  /** Whether the cart lives on the server (storefront cart endpoints) */
  public get isServerBacked(): boolean {
    return this.backend instanceof ServerCartBackend;
  }

  // ===================== Cart contents (#447, #434) =====================

  /** Current state of the cart */
  public async get(): Promise<CartState> {
    return this.backend.get();
  }

  /** Adds the product; if it is already in the cart the quantity increases. Emits `crafter:cart:updated`. */
  public async add(product: CartAddInput, quantity = 1): Promise<CartState> {
    if (product?.id === undefined || product.id === null || product.id === '') {
      throw new TypeError('[Crafter SDK] cart.add: product id is required');
    }
    const amount = Math.min(MAX_QUANTITY, Math.max(1, Math.floor(Number(quantity) || 1)));
    return this.emit(this.backend.add(product, amount));
  }

  /** Sets the line's quantity; 0 or less removes the line */
  public async update(id: string | number, quantity: number): Promise<CartState> {
    const next = Math.min(MAX_QUANTITY, Math.floor(Number(quantity) || 0));
    return this.emit(this.backend.update(String(id), next));
  }

  public async remove(id: string | number): Promise<CartState> {
    return this.emit(this.backend.remove(String(id)));
  }

  /** Empties the cart and the coupon */
  public async clear(): Promise<CartState> {
    return this.emit(this.backend.clear());
  }

  /**
   * Applies the coupon; null / empty removes it. In the storefront cart the server validates it right away (#476): if valid,
   * `discount`, `total` and `couponDetails` are returned filled; if invalid a `CrafterCouponError` (HTTP 422; `type`: `CouponErrorType`,
   * `message` in the page language, `details.minCartValue`) is thrown, the cart does not change and `crafter:cart:updated` is not emitted.
   * The localStorage cart cannot validate coupons: it stores the code and checkout calculates the discount.
   */
  public async setCoupon(code: string | null): Promise<CartState> {
    return this.emit(this.backend.setCoupon(code ? String(code).trim() || null : null));
  }

  /** Removes the coupon (`setCoupon(null)`) */
  public async removeCoupon(): Promise<CartState> {
    return this.setCoupon(null);
  }

  private async emit(pending: Promise<CartState>): Promise<CartState> {
    const cart = await pending;
    this.dom.emit('cart:updated', cart);
    return cart;
  }

  // ===================== Payment =====================

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
   * When the seller is an LLC with CrafterPayments, the response includes `stripe` (clientSecret, publishableKey, tax breakdown).
   * If stock is insufficient a `CrafterOutOfStockError` (HTTP 409, `productIds`) is thrown.
   * The server decides the currency; if `currency` is not given it is not sent. With `{ useCustomerCurrency: true }` a locked
   * rate quote is fetched first and payment starts in the customer currency (see `payWithQuote`).
   * POST /payment/checkout
   */
  public async checkout(data: PurchaseDto & {
    providerId: string;
    websiteId: string;
    provider?: string;
    /** Only the quote's currency (with `quoteId`); if not given the server uses the store currency */
    currency?: string;
    /** Kilitli kur teklifi (`payments.quote`) */
    quoteId?: string;
    paymentDetails?: Record<string, any>;
    user: { name: string; email: string; phone?: string; address?: string };
    /** Buyer's country (ISO 3166-1 alpha-2); the Stripe Tax location when the seller is an LLC */
    billingCountry?: string;
    /** Postal code for the US / Canada (Stripe Tax) */
    billingPostalCode?: string;
  }, options: { legalTerms?: LegalTermsConsent } & CustomerCurrencyOptions = {}): Promise<CheckoutPaymentResponse> {
    const coupon = data.coupon || (data as any).couponCode || undefined;
    const send = async (quote: PresentmentQuote | null): Promise<CheckoutPaymentResponse> => {
      const payload = this.checkoutPayload(data, coupon);
      if (quote) {
        payload.quoteId = quote.quoteId;
        payload.currency = quote.currency;
      } else if (options.useCustomerCurrency) {
        // A payment without a quote is in the store currency: the server decides the currency
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

