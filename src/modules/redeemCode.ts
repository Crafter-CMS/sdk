import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { UseRedeemCodeResponse } from '../types';

export class RedeemCodeModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Redeem gift/promo code.
   * POST /redeem-codes/use
   */
  public async use(code: string): Promise<UseRedeemCodeResponse> {
    const response = await this.http.post<UseRedeemCodeResponse>('/redeem-codes/use', { code });
    this.events.emit('redeem:used', response);
    return response;
  }
}
