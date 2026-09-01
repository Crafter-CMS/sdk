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
    const payload = {
      productIds: data.productIds,
      coupon: data.coupon || (data as any).couponCode || null,
    };
    const response = await this.http.post<PurchaseResponse>('/marketplace/purchase', payload);
    this.events.emit('cart:purchased', response);
    return response;
  }
}
