/**
 * Tutarı para birimi ve dile göre biçimlendirir (Intl.NumberFormat). Sembol ve ondalık hane para biriminden gelir;
 * 'TL' / '₺' sabit yazılmaz. `locale` verilmezse çalışma ortamının dili kullanılır.
 * Geçersiz para birimi / dil kodunda `1234.50 XYZ` biçimine düşer (hata fırlatmaz).
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
