/**
 * Formats an amount by currency and language (Intl.NumberFormat). The symbol and decimals come from the currency;
 * 'TL' / '₺' are never hard-coded. If `locale` is not given, the runtime's language is used.
 * Falls back to `1234.50 XYZ` for an invalid currency / language code (never throws).
 *
 * @example formatMoney(9.99, 'USD', 'en-US') // '$9.99'
 * @example formatMoney(250, 'TRY', 'tr-TR')  // '₺250,00'
 */
export function formatMoney(amount: number | string, currency: string, locale?: string | string[]): string {
  const value = typeof amount === 'number' ? amount : Number(amount);
  const n = Number.isFinite(value) ? value : 0;
  const code = String(currency || '').trim().toUpperCase();
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(n);
  } catch {
    return code ? `${n.toFixed(2)} ${code}` : n.toFixed(2);
  }
}
