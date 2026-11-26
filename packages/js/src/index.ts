import { CrafterPayments, type CrafterPaymentsOptions } from './client';
import { SDK_VERSION } from './config';

export { CrafterPayments, isMobileViewport } from './client';
export type { CrafterPaymentsOptions } from './client';
export { CrafterPaymentsError } from './errors';
export type { CrafterPaymentsErrorCode } from './errors';
export { handleReturn } from './return';
export type { HandleReturnOptions, ReturnResult, ReturnStatus } from './return';
export { API_VERSION } from './config';
export type { Environment } from './config';
export type * from './types';

export const version: string = SDK_VERSION;

const instances = new Map<string, CrafterPayments>();

/**
 * Herkese açık anahtarla (cp_pk_…) istemciyi döndürür. Sunucuda (SSR) `null` döner. Aynı anahtar ve seçeneklerle
 * tekrar çağrılırsa aynı örnek döner. Gizli anahtar (cp_sk_…) verilirse `secret_key_in_browser` hatasıyla reddedilir.
 */
export async function loadCrafterPayments(
  publishableKey: string,
  options: CrafterPaymentsOptions = {},
): Promise<CrafterPayments | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  const cacheKey = `${publishableKey}|${options.environment ?? ''}|${options.locale ?? ''}|${options.checkoutOrigin ?? ''}|${options.apiBase ?? ''}`;
  let instance = instances.get(cacheKey);
  if (!instance) {
    instance = new CrafterPayments(publishableKey, options);
    instances.set(cacheKey, instance);
  }
  return instance;
}
