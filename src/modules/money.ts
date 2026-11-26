import { CrafterPageContext } from '../core/context';
import { formatMoney } from '../utils/money';

export interface MoneyFormatOptions {
  /**
   * If the amount is in the store currency (default) it is converted to the customer's currency with the page context's rate.
   * `false`: not converted, printed in the store currency (balance, earnings, etc.).
   */
  convert?: boolean;
  /** Given if the amount is already in this currency (e.g. a payment quote); no conversion is done */
  currency?: string;
  /** Default: the page language */
  locale?: string;
}

const CODE = /^[A-Z]{3}$/;

function code(value: unknown): string {
  const upper = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return CODE.test(upper) ? upper : '';
}

/** Decimals of the currency (Intl); 2 for an unknown code */
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
 * Money display (#447): same rule as the storefront's `money` filter. Amounts arrive in the store currency;
 * they are converted to the customer's currency with the page context's rate and formatted in the page language. Without a context, or
 * with an invalid rate, they are shown in the store currency. Display only; the exact amount is set on the server at payment time.
 */
export class MoneyModule {
  constructor(private getContext: () => CrafterPageContext | null) {}

  /** Store currency; empty without a context */
  public get storeCurrency(): string {
    return code(this.getContext()?.storeCurrency);
  }

  /** The customer's currency; the store currency if the rate is invalid */
  public get currency(): string {
    const ctx = this.getContext();
    const customer = code(ctx?.customerCurrency);
    return customer && this.rateOf(ctx) ? customer : this.storeCurrency;
  }

  /** 1 store unit = rate customer units; 1 if the customer currency is the store's */
  public get rate(): number {
    return this.currency === this.storeCurrency ? 1 : this.rateOf(this.getContext()) || 1;
  }

  /** Converts a store amount to the customer currency and rounds to that unit's decimals */
  public convert(storeAmount: number | string): number {
    const value = Number(storeAmount);
    const n = Number.isFinite(value) ? value : 0;
    const target = this.currency;
    return target ? round(n * this.rate, target) : n;
  }

  /**
   * @example Crafter.money.format(19.99)                    // '€18,40' (EUR customer, de)
   * @example Crafter.money.format(250, { convert: false })  // in the store currency
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

/** If the currency is unknown nothing is made up: a number with 2 decimals */
function plain(amount: number | string): string {
  const value = Number(amount);
  return (Number.isFinite(value) ? value : 0).toFixed(2);
}
