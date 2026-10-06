import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { PurchaseDto, PurchaseResponse } from '../types';

export class CartModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
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
   * POST /payment/checkout
   */
  public async checkout(data: PurchaseDto & {
    providerId: string;
    websiteId: string;
    provider?: string;
    currency?: string;
    paymentDetails?: Record<string, any>;
    user: { name: string; email: string; phone?: string; address?: string };
  }): Promise<any> {
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

    const response = await this.http.post<any>('/payment/checkout', payload);
    this.events.emit('cart:checkout', response);
    return response;
  }
}

