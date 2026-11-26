import { API_VERSION, type ResolvedConfig } from './config';
import { CrafterPaymentsError } from './errors';
import type { PublicCheckoutSession } from './types';

/** `GET /v1/checkout/sessions/:id/public` (publishable anahtar + X-Client-Secret, çerezsiz) */
export async function fetchPublicSession(
  config: ResolvedConfig,
  sessionId: string,
  clientSecret: string,
): Promise<PublicCheckoutSession> {
  let response: Response;
  try {
    response = await fetch(`${config.apiBase}/checkout/sessions/${encodeURIComponent(sessionId)}/public`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${config.publishableKey}`,
        'X-Client-Secret': clientSecret,
        'Crafter-Version': API_VERSION,
      },
      credentials: 'omit',
      cache: 'no-store',
    });
  } catch {
    throw new CrafterPaymentsError('network_error', 'Could not reach the CrafterPayments API.');
  }
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const err = body && typeof body === 'object' ? body.error : undefined;
    throw new CrafterPaymentsError('api_error', (err && err.message) || `Request failed (${response.status}).`, {
      type: err && err.type,
      status: response.status,
      requestId: (err && err.requestId) || response.headers.get('X-Request-Id') || undefined,
    });
  }
  return body as PublicCheckoutSession;
}
