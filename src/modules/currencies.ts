import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { CrafterConfig, CurrencyConversion, CustomerCurrencyContext } from '../types';

/**
 * Customer currency (#424, #426): context and conversion for price display. The server decides the currency
 * (the storefront's `crafter_currency` cookie, country, store currency); the SDK does not write its own cookie.
 * Converted amounts are for display only; the payment amount is set by the locked quote (`payments.quote`).
 */
export class CurrenciesModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter,
    private options: Pick<CrafterConfig, 'websiteId'> = {}
  ) {}

  /**
   * Store currency, allowed currencies, the customer's currency and rates.
   * `currency`: the customer's choice (a suggestion); if not allowed, the country / store currency is returned.
   * GET /payment/currencies?websiteId=&currency=
   */
  public async context(params: { currency?: string; websiteId?: string } = {}): Promise<CustomerCurrencyContext> {
    return this.http.get<CustomerCurrencyContext>('/payment/currencies', {
      params: { websiteId: params.websiteId || this.options.websiteId, currency: params.currency },
    });
  }

  /**
   * Converts store-currency amounts (at most 500) to the customer currency; order is preserved.
   * POST /payment/currencies/convert
   */
  public async convert(
    amounts: number[],
    params: { currency?: string; websiteId?: string } = {}
  ): Promise<CurrencyConversion> {
    const payload: Record<string, any> = { websiteId: params.websiteId || this.options.websiteId, amounts };
    if (params.currency) payload.currency = params.currency;
    return this.http.post<CurrencyConversion>('/payment/currencies/convert', payload);
  }
}
