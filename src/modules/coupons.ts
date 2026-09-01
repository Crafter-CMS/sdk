import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { CouponResponse } from '../types';

export class CouponsModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Validate and get coupon discount details.
   * GET /coupons/:couponCode
   */
  public async get(couponCode: string): Promise<CouponResponse> {
    return this.http.get<CouponResponse>(`/coupons/${couponCode}`);
  }
}
