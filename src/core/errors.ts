import { CrafterApiError } from '../types';

export class CrafterError extends Error {
  public readonly statusCode: number;
  public readonly error?: string;
  /** Backend error code (ErrorType), e.g. 'out_of_stock', 'balance_top_up_limit_exceeded' */
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
        if (payload.type && COUPON_ERROR_TYPES.includes(payload.type)) {
          return new CrafterCouponError(payload);
        }
        if (payload.type && PAYMENT_PROVIDER_ERROR_TYPES.includes(payload.type)) {
          return new CrafterPaymentProviderError(payload);
        }
        return new CrafterError(payload);
    }
  }
}

/** Backend error codes (ErrorType) related to the payment flow. */
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
  /** The currency sent by the client differs from the store's (or the quote's) */
  PAYMENT_CURRENCY_MISMATCH: 'payment_currency_mismatch',
  /** The provider / seller does not support this currency */
  PAYMENT_CURRENCY_UNSUPPORTED: 'payment_currency_unsupported',
  /** The store disabled the customer currency: payment is in the store currency */
  CUSTOMER_CURRENCY_NOT_ALLOWED: 'customer_currency_not_allowed',
  /** Quote not found / expired / cart changed: get a new quote */
  PRESENTMENT_QUOTE_NOT_FOUND: 'presentment_quote_not_found',
  PRESENTMENT_QUOTE_EXPIRED: 'presentment_quote_expired',
  PRESENTMENT_QUOTE_MISMATCH: 'presentment_quote_mismatch',
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
  PaymentErrorType.PAYMENT_CURRENCY_UNSUPPORTED,
];

/**
 * Coupon rejection (#476): `crafter.cart.setCoupon()` (storefront `POST /cart/coupon.js`, HTTP 422) and coupon validation.
 * The cart also reports the same codes in `couponRemoved.reason` (when a stored coupon became invalid and was dropped).
 */
export const CouponErrorType = {
  NOT_FOUND: 'coupon_not_found',
  INACTIVE: 'coupon_inactive',
  USAGE_LIMIT_REACHED: 'coupon_usage_limit_reached',
  ALREADY_USED_BY_USER: 'coupon_already_used_by_user',
  NOT_ASSIGNED_TO_USER: 'coupon_not_assigned_to_user',
  /** Cart total is below the coupon's minimum (`details.minCartValue`, in the store currency) */
  CART_TOTAL_BELOW_MINIMUM: 'coupon_cart_total_below_minimum',
  INVALID_FOR_PRODUCT: 'coupon_invalid_for_product',
  INVALID_TYPE: 'coupon_invalid_type',
} as const;

export type CouponErrorTypeValue = (typeof CouponErrorType)[keyof typeof CouponErrorType];

/** List of coupon error codes */
export const COUPON_ERROR_TYPES: string[] = Object.values(CouponErrorType);

type ErrorPayload = ConstructorParameters<typeof CrafterError>[0];

/**
 * Coupon rejected (#476). `message` is in the page language and can be shown as is; see `CouponErrorType` for `type`.
 * A rejected coupon is not written to the cart and the cart does not change.
 */
export class CrafterCouponError extends CrafterError {
  /** The coupon's minimum (`details.minCartValue`) for `coupon_cart_total_below_minimum`; null otherwise */
  public readonly minCartValue: number | null;

  constructor(payload: ErrorPayload) {
    super(payload);
    this.name = 'CrafterCouponError';
    const min = Number(payload.details?.minCartValue);
    this.minCartValue = payload.details?.minCartValue != null && Number.isFinite(min) ? min : null;
  }
}

/** Stock turned out to be insufficient when starting payment (HTTP 409, `out_of_stock`). */
export class CrafterOutOfStockError extends CrafterError {
  /** IDs of the sold-out products (`details.productIds`); empty if the backend did not send them */
  public readonly productIds: string[];

  constructor(payload: ErrorPayload) {
    super({ ...payload, type: payload.type ?? PaymentErrorType.OUT_OF_STOCK });
    this.name = 'CrafterOutOfStockError';
    const ids = payload.details?.productIds;
    this.productIds = Array.isArray(ids) ? ids.map(String) : [];
  }
}

/** Balance top-up limit info (from the error's `details` field). */
export interface BalanceTopUpLimits {
  currency?: string;
  maxSingleUsd?: number;
  maxPaidUsd?: number;
  maxSingleAmount?: number | null;
  remainingAmount?: number | null;
}

/** Balance top-up rejected: disabled, single top-up limit or total paid balance limit exceeded. */
export class CrafterBalanceTopUpError extends CrafterError {
  public readonly reason: 'unavailable' | 'single_limit' | 'total_limit';
  /** Limits returned by the backend for limit errors; null for `unavailable` */
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
 * Payment provider / infrastructure error: provider not found, seller infrastructure not ready,
 * Stripe Tax could not calculate tax, payment could not start, etc. The `type` field gives the detail.
 */
export class CrafterPaymentProviderError extends CrafterError {
  /** Whether the user can retry with the same details a little later */
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

/** Whether this is a coupon rejection (`CrafterCouponError` or a `CrafterError` with a coupon error code) */
export function isCouponError(err: unknown): err is CrafterCouponError {
  return (
    err instanceof CrafterCouponError ||
    (isCrafterError(err) && typeof err.type === 'string' && COUPON_ERROR_TYPES.includes(err.type))
  );
}

export function isPaymentProviderError(err: unknown): err is CrafterPaymentProviderError {
  return err instanceof CrafterPaymentProviderError;
}
