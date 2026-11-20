import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import {
  BalanceTopUpPolicy,
  CheckPaymentResponse,
  CrafterConfig,
  InitiatePaymentDto,
  InitiatePaymentResponse,
  PaymentDeliveryStatus,
  PaymentOutcome,
  PaymentRecordStatus,
  PaymentStatusResult,
  PaymentTaxBreakdown,
  PaymentTaxLine,
  PublicDeliveryState,
  PublicPaymentProvider,
  StripePaymentSession,
  WaitForPaymentOptions,
} from '../types';

/** Payment modülünün kullandığı yapılandırma alanları */
export type PaymentsModuleOptions = Pick<CrafterConfig, 'websiteId' | 'stripePublishableKey'>;

function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Backend yanıtındaki Stripe Tax alanlarından tipli vergi kırılımı; `subtotal` yoksa null. */
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
 * Ödeme başlatma / sepet ödeme yanıtını normalize eder (eklemeli: ham alanlar korunur).
 * - `paymentId`: backend `payment_id` döndürür; `paymentId` yoksa doldurulur.
 * - `tax`: Stripe Tax kırılımı (yoksa null).
 * - `stripe`: yalnızca `type === 'stripe'` ve `clientSecret` varsa (satıcı LLC + CrafterPayments).
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
    result.stripe = session;
  }
  return result as T & InitiatePaymentResponse;
}

/** Alıcının onayladığı sözleşme sürümü / bölge eki (CrafterPayments onay kaydı, chargeback kanıtı). */
export interface LegalTermsConsent {
  version: string;
  region?: string;
}

/** Sözleşme onayı başlıkları: x-legal-terms-version / x-legal-terms-region */
export function legalTermsHeaders(consent?: LegalTermsConsent): Record<string, string> | undefined {
  if (!consent?.version) return undefined;
  const headers: Record<string, string> = { 'x-legal-terms-version': consent.version };
  if (consent.region) headers['x-legal-terms-region'] = consent.region;
  return headers;
}

const DELIVERY_STATES = ['pending', 'delivered', 'failed', 'refunded'] as const;
const DELIVERY_STATUSES: PaymentDeliveryStatus[] = ['PENDING', 'DELIVERED', 'NEEDS_REVIEW', 'REFUNDED'];

/**
 * Public durum yanıtını yorumlar. Backend'in public `delivery` özeti:
 * pending → PENDING, delivered → DELIVERED, failed → NEEDS_REVIEW (teslim edilemedi / incelemede), refunded → REFUNDED.
 * Backend ileride `deliveryStatus` döndürürse o kullanılır.
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

/** Formdaki en yüksek bakiye yükleme tutarı: sağlayıcı üst sınırı, tek yükleme limiti ve kalan ödenmiş bakiye hakkı. */
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
   * Satıcı LLC + CrafterPayments iken yanıtta `stripe` (clientSecret, publishableKey, vergi) bulunur.
   * POST /payment/initiate
   */
  public async initiate(
    data: InitiatePaymentDto | (Omit<InitiatePaymentDto, 'providerId'> & { provider?: string; providerId?: string }),
    options: { legalTerms?: LegalTermsConsent } = {}
  ): Promise<InitiatePaymentResponse> {
    const payload = {
      ...data,
      providerId: (data as any).providerId || (data as any).provider,
    };
    const raw = await this.http.post<InitiatePaymentResponse>('/payment/initiate', payload, {
      headers: legalTermsHeaders(options.legalTerms),
    });
    const response = normalizePaymentResponse(raw, this.options.stripePublishableKey);
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

  /**
   * Ödeme ve teslimat durumu (oturum gerektirmez). Stripe ödemesinde webhook gecikirse backend ödemeyi Stripe'tan okur.
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
   * Ödeme sonucu kesinleşene kadar `getStatus` ile yoklar (Stripe `confirmPayment` sonrası).
   * Ödeme alındı ama teslimat sürüyorsa yoklama devam eder. Süre dolarsa son görülen durum döner.
   * Ağ hataları yutulur, yoklama sürer.
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
        // Ağ hatasında yoklamaya devam edilir
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
   * Bakiye yükleme koşulları: açık mı, limitler (USD ve mağaza para birimi), ödenmiş / bonus bakiye
   * ve koşul metninin gösterilip gösterilmeyeceği (`showTerms`). Oturum gerektirir.
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
