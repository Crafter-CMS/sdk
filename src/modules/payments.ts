import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import {
  CheckPaymentResponse,
  InitiatePaymentDto,
  InitiatePaymentResponse,
  PublicPaymentProvider,
} from '../types';

export class PaymentsModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Get public active payment providers and bonus multipliers.
   * GET /config/payment/public
   */
  public async getPublicProviders(): Promise<PublicPaymentProvider[]> {
    return this.http.get<PublicPaymentProvider[]>('/config/payment/public');
  }

  /**
   * Initiate a payment session (PayTR, Shopier, CrafterPayments etc.).
   * POST /payment/initiate
   */
  public async initiate(
    data: InitiatePaymentDto | (Omit<InitiatePaymentDto, 'providerId'> & { provider?: string; providerId?: string })
  ): Promise<InitiatePaymentResponse> {
    const payload = {
      ...data,
      providerId: (data as any).providerId || (data as any).provider,
    };
    const response = await this.http.post<InitiatePaymentResponse>('/payment/initiate', payload);
    this.events.emit('payment:initiated', response);
    return response;
  }

  /**
   * Check payment status by payment ID.
   * POST /payment/check
   */
  public async check(paymentId: string): Promise<CheckPaymentResponse> {
    const response = await this.http.post<CheckPaymentResponse>('/payment/check', { paymentId });
    this.events.emit('payment:checked', response);
    return response;
  }
}
