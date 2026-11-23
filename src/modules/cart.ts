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

export class CartModule {
  private payments: PaymentsModule;

  constructor(
    private http: HttpClient,
    private events: EventEmitter,
    private options: PaymentsModuleOptions = {}
  ) {
    this.payments = new PaymentsModule(http, events, options);
  }

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

