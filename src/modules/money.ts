import { CrafterPageContext } from '../core/context';
import { formatMoney } from '../utils/money';

export interface MoneyFormatOptions {
  /**
   * Tutar mağaza para birimindeyse (varsayılan) sayfa bağlamının kuruyla müşterinin para birimine çevrilir.
   * `false`: çevrilmez, mağaza para biriminde basılır (bakiye, hakediş gibi).
   */
  convert?: boolean;
  /** Tutar zaten bu para birimindeyse (ör. ödeme teklifi) verilir; çeviri yapılmaz */
  currency?: string;
  /** Varsayılan: sayfanın dili */
  locale?: string;
}

const CODE = /^[A-Z]{3}$/;

function code(value: unknown): string {
  const upper = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return CODE.test(upper) ? upper : '';
}

/** Para biriminin ondalık hanesi (Intl); bilinmeyen kodda 2 */
export function currencyDigits(currency: string): number {
  try {
    const digits = new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
    return typeof digits === 'number' ? digits : 2;
  } catch {
    return 2;
  }
}

function round(value: number, currency: string): number {
  const factor = Math.pow(10, currencyDigits(currency));
  return Math.round(Number((value * factor).toFixed(6))) / factor;
}

/**
 * Para gösterimi (#447): storefront'un `money` filtresiyle aynı kural. Tutarlar mağaza para biriminde gelir;
 * sayfa bağlamındaki kurla müşterinin para birimine çevrilip sayfanın dilinde biçimlenir. Bağlam yoksa ya da
 * kur geçersizse mağaza para biriminde gösterilir. Yalnızca gösterimdir; kesin tutar ödeme anında sunucuda belirlenir.
 */
export class MoneyModule {
  constructor(private getContext: () => CrafterPageContext | null) {}

  /** Mağaza para birimi; bağlam yoksa boş */
  public get storeCurrency(): string {
    return code(this.getContext()?.storeCurrency);
  }

  /** Müşterinin para birimi; kur geçersizse mağaza para birimi */
  public get currency(): string {
    const ctx = this.getContext();
    const customer = code(ctx?.customerCurrency);
    return customer && this.rateOf(ctx) ? customer : this.storeCurrency;
  }

  /** 1 mağaza birimi = rate müşteri birimi; müşteri para birimi mağazanınkiyse 1 */
  public get rate(): number {
    return this.currency === this.storeCurrency ? 1 : this.rateOf(this.getContext()) || 1;
  }

  /** Mağaza tutarını müşteri para birimine çevirir ve o birimin hanesine yuvarlar */
  public convert(storeAmount: number | string): number {
    const value = Number(storeAmount);
    const n = Number.isFinite(value) ? value : 0;
    const target = this.currency;
    return target ? round(n * this.rate, target) : n;
  }

  /**
   * @example Crafter.money.format(19.99)                    // '€18,40' (EUR müşteri, de)
   * @example Crafter.money.format(250, { convert: false })  // mağaza para biriminde
   */
  public format(amount: number | string, options: MoneyFormatOptions = {}): string {
    const ctx = this.getContext();
    const locale = options.locale || ctx?.locale || undefined;
    const explicit = code(options.currency);
    if (explicit) return formatMoney(amount, explicit, locale);
    if (options.convert === false) {
      return this.storeCurrency ? formatMoney(amount, this.storeCurrency, locale) : plain(amount);
    }
    const target = this.currency;
    return target ? formatMoney(this.convert(amount), target, locale) : plain(amount);
  }

  private rateOf(ctx: CrafterPageContext | null): number {
    const rate = Number(ctx?.rate);
    return Number.isFinite(rate) && rate > 0 ? rate : 0;
  }
}

/** Para birimi bilinmiyorsa uydurulmaz: 2 haneli sayı */
function plain(amount: number | string): string {
  const value = Number(amount);
  return (Number.isFinite(value) ? value : 0).toFixed(2);
}
