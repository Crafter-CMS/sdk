import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { CheckoutPaymentResponse, PurchaseDto, PurchaseResponse } from '../types';
import { LegalTermsConsent, legalTermsHeaders, normalizePaymentResponse, PaymentsModuleOptions } from './payments';

export class CartModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter,
    private options: PaymentsModuleOptions = {}
  ) {}

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
   * POST /payment/checkout
   */
  public async checkout(data: PurchaseDto & {
    providerId: string;
    websiteId: string;
    provider?: string;
    currency?: string;
    paymentDetails?: Record<string, any>;
    user: { name: string; email: string; phone?: string; address?: string };
    /** Alıcının ülkesi (ISO 3166-1 alpha-2); satıcı LLC iken Stripe Tax vergi konumu */
    billingCountry?: string;
    /** ABD / Kanada için posta kodu (Stripe Tax) */
    billingPostalCode?: string;
  }, options: { legalTerms?: LegalTermsConsent } = {}): Promise<CheckoutPaymentResponse> {
    const payload: Record<string, any> = {
      providerId: data.providerId,
      websiteId: data.websiteId,
      currency: data.currency || 'TRY',
      coupon: data.coupon || (data as any).couponCode || undefined,
      user: data.user,
    };
    if (data.provider !== undefined) payload.provider = data.provider;
    if (data.paymentDetails !== undefined) payload.paymentDetails = data.paymentDetails;
    if (data.productIds !== undefined) payload.productIds = data.productIds;
    if (data.items !== undefined) payload.items = data.items;
    if (data.quantities !== undefined) payload.quantities = data.quantities;
    if (data.billingCountry !== undefined) payload.billingCountry = data.billingCountry;
    if (data.billingPostalCode !== undefined) payload.billingPostalCode = data.billingPostalCode;

    const raw = await this.http.post<CheckoutPaymentResponse>('/payment/checkout', payload, {
      headers: legalTermsHeaders(options.legalTerms),
    });
    const response = normalizePaymentResponse(raw, this.options.stripePublishableKey);
    this.events.emit('cart:checkout', response);
    return response;
  }
}

