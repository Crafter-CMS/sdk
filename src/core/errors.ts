import { CrafterApiError } from '../types';

export class CrafterError extends Error {
  public readonly statusCode: number;
  public readonly error?: string;
  /** Backend hata kodu (ErrorType), ör. 'out_of_stock', 'balance_top_up_limit_exceeded' */
  public readonly type?: string;
  public readonly details?: Record<string, any>;
  public readonly isCrafterError = true;

  constructor(payload: {
    message: string | string[];
    statusCode?: number;
    error?: string;
    type?: string;
    details?: Record<string, any>;
  }) {
    const formattedMessage = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message || 'An unexpected Crafter SDK error occurred';

    super(formattedMessage);
    this.name = 'CrafterError';
    this.statusCode = payload.statusCode ?? 500;
    this.error = payload.error;
    this.type = payload.type;
    this.details = payload.details;

    // Maintain proper prototype chain (subclasses included)
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static fromResponse(statusCode: number, data: any): CrafterError {
    if (typeof data === 'string') {
      return new CrafterError({ statusCode, message: data });
    }

    const apiError = data as Partial<CrafterApiError>;
    const payload = {
      statusCode: apiError?.statusCode || statusCode,
      message: apiError?.message || `HTTP Request failed with status ${statusCode}`,
      error: apiError?.error,
      type: typeof apiError?.type === 'string' ? apiError.type : undefined,
      details: apiError?.details || data,
    };

    switch (payload.type) {
      case PaymentErrorType.OUT_OF_STOCK:
        return new CrafterOutOfStockError(payload);
      case PaymentErrorType.BALANCE_TOP_UP_UNAVAILABLE:
      case PaymentErrorType.BALANCE_TOP_UP_LIMIT_EXCEEDED:
      case PaymentErrorType.BALANCE_TOP_UP_TOTAL_LIMIT_EXCEEDED:
        return new CrafterBalanceTopUpError(payload);
      default:
        if (payload.type && PAYMENT_PROVIDER_ERROR_TYPES.includes(payload.type)) {
          return new CrafterPaymentProviderError(payload);
        }
        return new CrafterError(payload);
    }
  }
}

/** Ödeme akışıyla ilgili backend hata kodları (ErrorType). */
export const PaymentErrorType = {
  OUT_OF_STOCK: 'out_of_stock',
  BALANCE_TOP_UP_UNAVAILABLE: 'balance_top_up_unavailable',
  BALANCE_TOP_UP_LIMIT_EXCEEDED: 'balance_top_up_limit_exceeded',
  BALANCE_TOP_UP_TOTAL_LIMIT_EXCEEDED: 'balance_top_up_total_limit_exceeded',
  SELLER_ENTITY_NOT_READY: 'seller_entity_not_ready',
  TAX_CALCULATION_FAILED: 'tax_calculation_failed',
  TAX_LOCATION_INVALID: 'tax_location_invalid',
  PAYMENT_PROVIDER_NOT_FOUND: 'payment_provider_not_found',
  PAYMENT_PROVIDER_UNSUPPORTED: 'payment_provider_unsupported',
  PAYMENT_CONFIG_ERROR: 'payment_config_error',
  PAYMENT_INITIALIZATION_FAILED: 'payment_initialization_failed',
  PAYMENT_FAILED: 'payment_failed',
} as const;

export type PaymentErrorTypeValue = (typeof PaymentErrorType)[keyof typeof PaymentErrorType];

const PAYMENT_PROVIDER_ERROR_TYPES: string[] = [
  PaymentErrorType.SELLER_ENTITY_NOT_READY,
  PaymentErrorType.TAX_CALCULATION_FAILED,
  PaymentErrorType.TAX_LOCATION_INVALID,
  PaymentErrorType.PAYMENT_PROVIDER_NOT_FOUND,
  PaymentErrorType.PAYMENT_PROVIDER_UNSUPPORTED,
  PaymentErrorType.PAYMENT_CONFIG_ERROR,
  PaymentErrorType.PAYMENT_INITIALIZATION_FAILED,
  PaymentErrorType.PAYMENT_FAILED,
];

type ErrorPayload = ConstructorParameters<typeof CrafterError>[0];

/** Stok ödeme başlatılırken yetersiz çıktı (HTTP 409, `out_of_stock`). */
export class CrafterOutOfStockError extends CrafterError {
  /** Tükenen ürünlerin kimlikleri (`details.productIds`); backend göndermediyse boş */
  public readonly productIds: string[];

  constructor(payload: ErrorPayload) {
    super({ ...payload, type: payload.type ?? PaymentErrorType.OUT_OF_STOCK });
    this.name = 'CrafterOutOfStockError';
    const ids = payload.details?.productIds;
    this.productIds = Array.isArray(ids) ? ids.map(String) : [];
  }
}

/** Bakiye yükleme limit bilgisi (hata `details` alanından). */
export interface BalanceTopUpLimits {
  currency?: string;
  maxSingleUsd?: number;
  maxPaidUsd?: number;
  maxSingleAmount?: number | null;
  remainingAmount?: number | null;
}

/** Bakiye yüklemesi reddedildi: kapalı, tek yükleme limiti veya toplam ödenmiş bakiye limiti aşıldı. */
export class CrafterBalanceTopUpError extends CrafterError {
  public readonly reason: 'unavailable' | 'single_limit' | 'total_limit';
  /** Limit hatalarında backend'in döndürdüğü limitler; `unavailable` için null */
  public readonly limits: BalanceTopUpLimits | null;

  constructor(payload: ErrorPayload) {
    super(payload);
    this.name = 'CrafterBalanceTopUpError';
    this.reason =
      payload.type === PaymentErrorType.BALANCE_TOP_UP_LIMIT_EXCEEDED
        ? 'single_limit'
        : payload.type === PaymentErrorType.BALANCE_TOP_UP_TOTAL_LIMIT_EXCEEDED
          ? 'total_limit'
          : 'unavailable';
    const d = payload.details;
    this.limits =
      this.reason !== 'unavailable' && d && typeof d === 'object' && ('maxSingleUsd' in d || 'remainingAmount' in d)
        ? {
            currency: d.currency,
            maxSingleUsd: d.maxSingleUsd,
            maxPaidUsd: d.maxPaidUsd,
            maxSingleAmount: d.maxSingleAmount ?? null,
            remainingAmount: d.remainingAmount ?? null,
          }
        : null;
  }
}

/**
 * Ödeme sağlayıcısı / altyapı hatası: sağlayıcı bulunamadı, satıcı altyapısı hazır değil,
 * Stripe Tax vergi hesaplanamadı, ödeme başlatılamadı vb. `type` alanı ayrıntıyı verir.
 */
export class CrafterPaymentProviderError extends CrafterError {
  /** Kullanıcı aynı bilgilerle biraz sonra tekrar deneyebilir mi */
  public readonly retryable: boolean;

  constructor(payload: ErrorPayload) {
    super(payload);
    this.name = 'CrafterPaymentProviderError';
    this.retryable =
      payload.type === PaymentErrorType.SELLER_ENTITY_NOT_READY ||
      payload.type === PaymentErrorType.TAX_CALCULATION_FAILED ||
      payload.type === PaymentErrorType.PAYMENT_INITIALIZATION_FAILED;
  }
}

export function isCrafterError(err: unknown): err is CrafterError {
  return err instanceof CrafterError || (typeof err === 'object' && err !== null && (err as any).isCrafterError === true);
}

export function isOutOfStockError(err: unknown): err is CrafterOutOfStockError {
  return err instanceof CrafterOutOfStockError;
}

export function isBalanceTopUpError(err: unknown): err is CrafterBalanceTopUpError {
  return err instanceof CrafterBalanceTopUpError;
}

export function isPaymentProviderError(err: unknown): err is CrafterPaymentProviderError {
  return err instanceof CrafterPaymentProviderError;
}
