import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { CrafterConfig, CurrencyConversion, CustomerCurrencyContext } from '../types';

/**
 * Müşteri para birimi (#424, #426): fiyat gösterimi için bağlam ve çeviri. Para birimini sunucu belirler
 * (vitrinin `crafter_currency` çerezi, ülke, mağaza para birimi); SDK kendi çerezini yazmaz.
 * Çevrilen tutarlar yalnızca gösterim içindir; ödeme tutarı kilitli teklifle (`payments.quote`) belirlenir.
 */
export class CurrenciesModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter,
    private options: Pick<CrafterConfig, 'websiteId'> = {}
  ) {}

  /**
   * Mağaza para birimi, izinli para birimleri, müşterinin para birimi ve kurlar.
   * `currency`: müşterinin seçimi (öneri); izinli değilse ülke / mağaza para birimi döner.
   * GET /payment/currencies?websiteId=&currency=
   */
  public async context(params: { currency?: string; websiteId?: string } = {}): Promise<CustomerCurrencyContext> {
    return this.http.get<CustomerCurrencyContext>('/payment/currencies', {
      params: { websiteId: params.websiteId || this.options.websiteId, currency: params.currency },
    });
  }

  /**
   * Mağaza para birimindeki tutarları (en fazla 500) müşteri para birimine çevirir; sıra korunur.
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
