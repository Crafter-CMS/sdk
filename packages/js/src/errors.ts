/** SDK hata kodları. Entegrasyon `code` üzerinden karar verir; `message` insan içindir. */
export type CrafterPaymentsErrorCode =
  | 'not_browser'
  | 'invalid_publishable_key'
  | 'secret_key_in_browser'
  | 'invalid_session_id'
  | 'invalid_client_secret'
  | 'invalid_checkout_url'
  | 'invalid_options'
  | 'mount_target_not_found'
  | 'popup_blocked'
  | 'embed_load_timeout'
  | 'create_session_failed'
  | 'result_timeout'
  | 'network_error'
  | 'api_error';

export class CrafterPaymentsError extends Error {
  readonly code: CrafterPaymentsErrorCode | string;
  /** /v1 hata gövdesindeki `type` (ör. CHECKOUT_SESSION_NOT_FOUND) */
  readonly type?: string;
  readonly status?: number;
  readonly requestId?: string;

  constructor(
    code: CrafterPaymentsErrorCode | string,
    message: string,
    extra: { type?: string; status?: number; requestId?: string } = {},
  ) {
    super(message);
    this.name = 'CrafterPaymentsError';
    this.code = code;
    this.type = extra.type;
    this.status = extra.status;
    this.requestId = extra.requestId;
  }
}
