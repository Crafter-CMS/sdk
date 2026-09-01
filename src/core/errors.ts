import { CrafterApiError } from '../types';

export class CrafterError extends Error {
  public readonly statusCode: number;
  public readonly error?: string;
  public readonly details?: Record<string, any>;
  public readonly isCrafterError = true;

  constructor(payload: {
    message: string | string[];
    statusCode?: number;
    error?: string;
    details?: Record<string, any>;
  }) {
    const formattedMessage = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message || 'An unexpected Crafter SDK error occurred';

    super(formattedMessage);
    this.name = 'CrafterError';
    this.statusCode = payload.statusCode ?? 500;
    this.error = payload.error;
    this.details = payload.details;

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, CrafterError.prototype);
  }

  static fromResponse(statusCode: number, data: any): CrafterError {
    if (typeof data === 'string') {
      return new CrafterError({ statusCode, message: data });
    }

    const apiError = data as Partial<CrafterApiError>;
    return new CrafterError({
      statusCode: apiError?.statusCode || statusCode,
      message: apiError?.message || `HTTP Request failed with status ${statusCode}`,
      error: apiError?.error,
      details: apiError?.details || data,
    });
  }
}

export function isCrafterError(err: unknown): err is CrafterError {
  return err instanceof CrafterError || (typeof err === 'object' && err !== null && (err as any).isCrafterError === true);
}
