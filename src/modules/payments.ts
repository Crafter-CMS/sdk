import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { isCrafterError, PaymentErrorType } from '../core/errors';
import {
  BalanceTopUpPolicy,
  CheckPaymentResponse,
  CrafterConfig,
  CustomerCurrencyOptions,
  InitiatePaymentDto,
  InitiatePaymentResponse,
  PaymentDeliveryStatus,
  PaymentOutcome,
  PaymentRecordStatus,
  PaymentStatusResult,
  PaymentTaxBreakdown,
  PaymentTaxLine,
  PresentmentQuote,
  PresentmentQuoteRequest,
  PublicDeliveryState,
  PublicPaymentProvider,
  StripePaymentSession,
  WaitForPaymentOptions,
} from '../types';

/** Configuration fields used by the payment module */
export type PaymentsModuleOptions = Pick<CrafterConfig, 'websiteId' | 'stripePublishableKey'>;

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Typed tax breakdown from the Stripe Tax fields in the backend response; null if there is no `subtotal`. */
export function parseTaxBreakdown(raw: Record<string, any> | null | undefined): PaymentTaxBreakdown | null {
  if (!raw || typeof raw.subtotal !== 'number') return null;
  const subtotal = raw.subtotal;
  const taxAmount = toNumber(raw.taxAmount);
  const lines: PaymentTaxLine[] = Array.isArray(raw.taxes)
    ? raw.taxes.map((line: any) => ({
        country: line?.country ?? null,
        state: line?.state ?? null,
        taxType: line?.taxType ?? null,
        rate: toNumber(line?.rate),
        amount: toNumber(line?.amount),
      }))
    : [];
  const amount = raw.amount !== undefined ? toNumber(raw.amount, NaN) : NaN;
  return {
    subtotal,
    taxAmount,
    total: Number.isFinite(amount) ? amount : round2(subtotal + taxAmount),
    currency: String(raw.currency || ''),
    lines,
  };
}

/**
 * Normalizes the payment initiation / cart payment response (additive: raw fields are kept).
 * - `paymentId`: the backend returns `payment_id`; `paymentId` is filled if missing.
 * - `tax`: Stripe Tax breakdown (null if absent).
 * - `stripe`: only when `type === 'stripe'` and `clientSecret` exists (seller LLC + CrafterPayments).
 */
export function normalizePaymentResponse<T extends Record<string, any>>(
  raw: T,
  fallbackPublishableKey?: string | null
): T & InitiatePaymentResponse {
  if (!raw || typeof raw !== 'object') return raw as T & InitiatePaymentResponse;
  const paymentId = raw.paymentId ?? raw.payment_id;
  const tax = parseTaxBreakdown(raw);
  const result: Record<string, any> = { ...raw, tax };
  if (paymentId !== undefined) result.paymentId = paymentId;

  if (raw.type === 'stripe' && typeof raw.clientSecret === 'string' && raw.clientSecret) {
    const session: StripePaymentSession = {
      paymentId: String(paymentId ?? ''),
      clientSecret: raw.clientSecret,
      publishableKey: raw.publishableKey || raw.stripePublishableKey || fallbackPublishableKey || null,
      amount: toNumber(raw.amount),
      currency: String(raw.currency || ''),
      tax,
    };
    if (raw.merchant_oid) session.merchantOid = String(raw.merchant_oid);
    if (raw.presentment && typeof raw.presentment === 'object') session.presentment = raw.presentment;
    result.stripe = session;
  }
  return result as T & InitiatePaymentResponse;
}

/** Terms version / region suffix the buyer accepted (CrafterPayments consent record, chargeback evidence). */
export interface LegalTermsConsent {
  version: string;
  region?: string;
}

/** Terms consent headers: x-legal-terms-version / x-legal-terms-region */
export function legalTermsHeaders(consent?: LegalTermsConsent): Record<string, string> | undefined {
  if (!consent?.version) return undefined;
  const headers: Record<string, string> = { 'x-legal-terms-version': consent.version };
  if (consent.region) headers['x-legal-terms-region'] = consent.region;
  return headers;
}

/** Errors retried once with a new quote */
const QUOTE_RETRY_ERRORS: string[] = [
  PaymentErrorType.PRESENTMENT_QUOTE_EXPIRED,
  PaymentErrorType.PRESENTMENT_QUOTE_MISMATCH,
  PaymentErrorType.PRESENTMENT_QUOTE_NOT_FOUND,
];

const errorType = (err: unknown) => (isCrafterError(err) ? err.type : undefined);

/**
 * Payment in the customer currency (#424, #426): a quote is fetched, payment starts with `quoteId` and the quote's currency.
 * If the quote expired / the cart changed, a new quote is fetched once. If the store disabled the customer currency
 * (`customer_currency_not_allowed`), payment starts without a quote, in the store currency (`customerCurrencyDisabled`).
 * Other errors are thrown as is.
 */
export async function payWithQuote<T extends Record<string, any>>(
  getQuote: () => Promise<PresentmentQuote>,
  pay: (quote: PresentmentQuote | null) => Promise<T>
): Promise<T & { customerCurrencyDisabled: boolean }> {
  const inStoreCurrency = async () => ({ ...(await pay(null)), customerCurrencyDisabled: true });
  for (let attempt = 0; ; attempt++) {
    let quote: PresentmentQuote;
    try {
      quote = await getQuote();
    } catch (err) {
      if (errorType(err) === PaymentErrorType.CUSTOMER_CURRENCY_NOT_ALLOWED) return inStoreCurrency();
      throw err;
    }
    try {
      return { ...(await pay(quote)), customerCurrencyDisabled: false };
    } catch (err) {
      const type = errorType(err);
      if (type === PaymentErrorType.CUSTOMER_CURRENCY_NOT_ALLOWED) return inStoreCurrency();
      if (attempt === 0 && type && QUOTE_RETRY_ERRORS.includes(type)) continue;
      throw err;
    }
  }
}

const DELIVERY_STATES = ['pending', 'delivered', 'failed', 'refunded'] as const;
const DELIVERY_STATUSES: PaymentDeliveryStatus[] = ['PENDING', 'DELIVERED', 'NEEDS_REVIEW', 'REFUNDED'];

/**
 * Interprets the public status response. The backend's public `delivery` summary:
 * pending → PENDING, delivered → DELIVERED, failed → NEEDS_REVIEW (could not be delivered / under review), refunded → REFUNDED.
 * If the backend returns `deliveryStatus` in the future, that is used.
 */
export function parsePaymentStatus(paymentId: string, raw: Record<string, any> | null | undefined): PaymentStatusResult {
  const body = raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object' && !raw.status ? raw.data : raw || {};
  const status = String(body.status || 'PENDING').toUpperCase() as PaymentRecordStatus;
  const rawDelivery = typeof body.delivery === 'string' ? body.delivery.toLowerCase() : null;
  const delivery: PublicDeliveryState = (DELIVERY_STATES as readonly string[]).includes(rawDelivery as string)
    ? (rawDelivery as PublicDeliveryState)
    : null;

  const explicit = typeof body.deliveryStatus === 'string' ? body.deliveryStatus.toUpperCase() : null;
  let deliveryStatus: PaymentDeliveryStatus | null =
    explicit && (DELIVERY_STATUSES as string[]).includes(explicit)
      ? (explicit as PaymentDeliveryStatus)
      : explicit === 'FAILED'
        ? 'NEEDS_REVIEW'
        : null;
  if (!deliveryStatus && delivery) {
    deliveryStatus =
      delivery === 'pending' ? 'PENDING' : delivery === 'delivered' ? 'DELIVERED' : delivery === 'refunded' ? 'REFUNDED' : 'NEEDS_REVIEW';
  }

  let outcome: PaymentOutcome;
  if (status === 'REFUNDED' || deliveryStatus === 'REFUNDED') outcome = 'refunded';
  else if (status === 'COMPLETED' || status === 'SUCCESS') {
    outcome = deliveryStatus === 'NEEDS_REVIEW' ? 'needs_review' : deliveryStatus === 'PENDING' ? 'processing' : 'success';
  } else if (status === 'PENDING') outcome = 'pending';
  else outcome = 'failed';

  return {
    paymentId,
    status,
    delivery,
    deliveryStatus,
    outcome,
    final: outcome !== 'pending' && outcome !== 'processing',
  };
}

/** Highest balance top-up amount for the form: provider cap, single top-up limit and the remaining paid balance allowance. */
export function topUpMaxAmount(policy: BalanceTopUpPolicy | null | undefined, providerMax?: number): number {
  const limits = [providerMax || 1000000];
  if (policy?.closedLoop) {
    if (typeof policy.maxSingleAmount === 'number') limits.push(policy.maxSingleAmount);
    if (typeof policy.remainingAmount === 'number') limits.push(policy.remainingAmount);
  }
  return Math.max(0, Math.min(...limits));
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new Error('Aborted'));
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error('Aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export class PaymentsModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter,
    private options: PaymentsModuleOptions = {}
  ) {}

  /**
   * Get public active payment providers and bonus multipliers.
   * GET /config/payment/public
   */
  public async getPublicProviders(): Promise<PublicPaymentProvider[]> {
    return this.http.get<PublicPaymentProvider[]>('/config/payment/public');
  }

  /**
   * Initiate a payment session (PayTR, Shopier, KuveytTürk, CrafterPayments etc.).
   * When the seller is an LLC with CrafterPayments, the response includes `stripe` (clientSecret, publishableKey, tax).
   * POST /payment/initiate
   */
  public async initiate(
    data: InitiatePaymentDto | (Omit<InitiatePaymentDto, 'providerId'> & { provider?: string; providerId?: string }),
    options: { legalTerms?: LegalTermsConsent } & CustomerCurrencyOptions = {}
  ): Promise<InitiatePaymentResponse> {
    const send = async (quote: PresentmentQuote | null) => {
      const payload: Record<string, any> = {
        ...data,
        providerId: (data as any).providerId || (data as any).provider,
      };
      if (quote) {
        payload.quoteId = quote.quoteId;
        payload.currency = quote.currency;
      } else if (options.useCustomerCurrency) {
        // A payment without a quote is in the store currency: the server decides the currency
        delete payload.quoteId;
        delete payload.currency;
      }
      const raw = await this.http.post<InitiatePaymentResponse>('/payment/initiate', payload, {
        headers: legalTermsHeaders(options.legalTerms),
      });
      return normalizePaymentResponse(raw, this.options.stripePublishableKey);
    };

    const response: InitiatePaymentResponse = options.useCustomerCurrency
      ? await payWithQuote(
          () =>
            this.quote({
              websiteId: data.websiteId,
              kind: 'top_up',
              amount: data.amount,
              currency: options.customerCurrency,
            }),
          send
        )
      : await send(null);
    this.events.emit('payment:initiated', response);
    return response;
  }

  /**
   * Locked rate quote (~30 min): the amount is calculated in the store currency, the server decides the customer's currency
   * (`currency` is only a suggestion). Payment starts with `quoteId`. Requires a session.
   * 400 `customer_currency_not_allowed` if the store disabled the customer currency.
   * POST /payment/quote
   */
  public async quote(data: PresentmentQuoteRequest): Promise<PresentmentQuote> {
    const payload: Record<string, any> = { ...data };
    const websiteId = data.websiteId || this.options.websiteId;
    if (websiteId) payload.websiteId = websiteId;
    for (const key of Object.keys(payload)) if (payload[key] === undefined) delete payload[key];
    const quote = await this.http.post<PresentmentQuote>('/payment/quote', payload);
    this.events.emit('payment:quoted', quote);
    return quote;
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

  /**
   * Payment and delivery status (no session required). For a Stripe payment, if the webhook is late the backend reads the payment from Stripe.
   * GET /payment/status/:paymentId
   */
  public async getStatus(paymentId: string): Promise<PaymentStatusResult> {
    const raw = await this.http.get<Record<string, any>>(`/payment/status/${encodeURIComponent(paymentId)}`, {
      skipAuth: true,
    });
    const result = parsePaymentStatus(paymentId, raw);
    this.events.emit('payment:status', result);
    return result;
  }

  /**
   * Polls with `getStatus` until the payment result is final (after Stripe `confirmPayment`).
   * If the payment was received but delivery is still running, polling continues. On timeout the last seen status is returned.
   * Network errors are swallowed and polling continues.
   */
  public async waitForResult(paymentId: string, options: WaitForPaymentOptions = {}): Promise<PaymentStatusResult> {
    const { attempts = 20, intervalMs = 1500, signal } = options;
    let last: PaymentStatusResult = parsePaymentStatus(paymentId, { status: 'PENDING' });
    for (let i = 0; i < attempts; i++) {
      if (signal?.aborted) break;
      try {
        last = await this.getStatus(paymentId);
        if (last.final) return last;
      } catch {
        // Keep polling on a network error
      }
      if (i < attempts - 1) {
        try {
          await sleep(intervalMs, signal);
        } catch {
          break;
        }
      }
    }
    return last;
  }

  /**
   * Balance top-up conditions: whether enabled, limits (USD and the store currency), paid / bonus balance
   * and whether to show the terms text (`showTerms`). Requires a session.
   * GET /payment/balance-top-up/policy?websiteId=
   */
  public async getTopUpPolicy(websiteId?: string): Promise<BalanceTopUpPolicy> {
    const id = websiteId || this.options.websiteId;
    const raw = await this.http.get<Record<string, any>>('/payment/balance-top-up/policy', {
      params: id ? { websiteId: id } : undefined,
    });
    const data = raw && typeof raw === 'object' && raw.data && typeof raw.data === 'object' ? raw.data : raw || {};
    const closedLoop = data.closedLoop === true;
    return {
      enabled: data.enabled === true,
      closedLoop,
      showTerms: closedLoop,
      currency: String(data.currency || ''),
      maxSingleUsd: toNumber(data.maxSingleUsd),
      maxPaidUsd: toNumber(data.maxPaidUsd),
      maxSingleAmount: typeof data.maxSingleAmount === 'number' ? data.maxSingleAmount : null,
      remainingAmount: typeof data.remainingAmount === 'number' ? data.remainingAmount : null,
      balance: toNumber(data.balance),
      paidBalance: toNumber(data.paidBalance),
      bonusBalance: toNumber(data.bonusBalance),
    };
  }
}
