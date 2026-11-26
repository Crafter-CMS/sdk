import type { CrafterPaymentsError } from './errors';

/** Oturum durumu (#463 §3.5) */
export type SessionStatus = 'open' | 'processing' | 'complete' | 'expired' | 'canceled';

/** `GET /v1/checkout/sessions/:id/public` yanıtı: yalnızca durum alanları */
export interface PublicCheckoutSession {
  id: string;
  object: 'checkout.session';
  status: SessionStatus;
  paymentStatus: string;
  amountTotal: number | null;
  currency: string | null;
  orderId: string | null;
  delivery: { status: string | null };
  expiresAt: string;
}

/** Sonuç olaylarının yükü */
export interface CheckoutResult {
  sessionId: string;
  status: SessionStatus;
  /** Sipariş kimliği; yalnızca durum sunucudan okunduysa dolu olabilir */
  orderId?: string | null;
  /**
   * true: durum `/public` uç noktasından okundu. false: durum yalnızca dönüş adresinden ya da gömülü sayfadan geldi.
   * Ürün teslimini asla tarayıcı olayına bağlamayın; doğruluk kaynağı webhook ve sunucudaki GET isteğidir.
   */
  verified: boolean;
}

export interface CheckoutErrorEvent {
  sessionId?: string;
  error: CrafterPaymentsError;
}

export interface PaymentFailedEvent {
  sessionId: string;
  /** Sağlayıcıdan bağımsız kısa kod (ör. card_declined). Alıcı aynı oturumda tekrar deneyebilir. */
  code?: string;
}

export interface CheckoutEvents {
  /** Checkout yüklendi (gömülü/modal: iframe hazır; popup: pencere açıldı) */
  ready: { sessionId: string };
  complete: CheckoutResult;
  /** Alıcı vazgeçti ya da oturum iptal edildi (status: canceled) */
  cancel: CheckoutResult;
  expired: CheckoutResult;
  /** Ödeme reddedildi; kalıcı değil, alıcı tekrar deneyebilir */
  payment_failed: PaymentFailedEvent;
  /** iframe dışı ödeme yöntemi ayrı pencere istedi; SDK pencereyi kendisi açar */
  redirect_required: { sessionId: string; url: string };
  /** Modal ya da popup ödeme olmadan kapandı */
  close: { sessionId?: string };
  error: CheckoutErrorEvent;
}

export type CheckoutEventName = keyof CheckoutEvents;
export type CheckoutEventHandler<K extends CheckoutEventName> = (payload: CheckoutEvents[K]) => void;

export interface CheckoutController {
  on<K extends CheckoutEventName>(event: K, handler: CheckoutEventHandler<K>): CheckoutController;
  off<K extends CheckoutEventName>(event: K, handler: CheckoutEventHandler<K>): CheckoutController;
  /** Pencereyi/modalı kapatır, yoklamayı durdurur. Oturumu iptal etmez. */
  close(): void;
  /** Sonuç olayıyla (complete / cancel / expired) çözülür; error ile reddedilir. close() çağrılırsa `null` döner. */
  readonly result: Promise<CheckoutResult | null>;
}

export interface EmbeddedCheckout extends CheckoutController {
  /** iframe'i kaldırır, dinleyicileri temizler */
  destroy(): void;
  readonly iframe: HTMLIFrameElement;
}

/**
 * Görünüm (sahip kararı 26.11.2026): kart alanları (kart numarası / son kullanma / CVC ayrık alanlar) checkout
 * sayfasında sağlayıcının görünüm API'siyle bu değerlere göre çizilir. Serbest CSS yoktur; yalnızca bu token'lar.
 * Geçersiz değer sessizce atılır (konsola uyarı yazılır). Logo ve mağaza adı mağaza ayarından gelir (#269).
 */
export interface Appearance {
  theme?: 'light' | 'dark' | 'auto';
  variables?: {
    colorPrimary?: string;
    colorBackground?: string;
    colorText?: string;
    colorTextSecondary?: string;
    colorTextPlaceholder?: string;
    colorDanger?: string;
    colorBorder?: string;
    colorFocusRing?: string;
    fontFamily?: string;
    fontSizeBase?: string;
    fontWeightNormal?: string;
    borderRadius?: string;
    borderWidth?: string;
    spacingUnit?: string;
  };
  /** Kart numarası alanında kart markası ikonu (varsayılan true) */
  showCardBrandIcon?: boolean;
}

export type SessionInput =
  | { sessionId: string; clientSecret?: string }
  | { clientSecret: string; sessionId?: string };

export interface CreatedSession {
  sessionId: string;
  clientSecret?: string;
  /** Oturumun `url` alanı (yönlendirme/popup); verilmezse sessionId'den kurulur */
  url?: string;
}

export interface OpenCheckoutOptions {
  sessionId?: string;
  clientSecret?: string;
  url?: string;
  /**
   * Oturum tıklamadan sonra sunucuda oluşturulacaksa: SDK pencereyi/modalı tıklama anında açar (engelleyiciye
   * takılmaz), oturum gelince yükler.
   */
  createSession?: () => Promise<CreatedSession>;
  /** auto: masaüstünde popup, mobilde `mobile` seçeneği. modal: gömülü iframe (Pro+ paket, `uiMode: embedded`). */
  mode?: 'auto' | 'popup' | 'modal' | 'redirect';
  /** Mobilde (genişlik < 800 px, düşük yükseklik ya da dokunmatik) ne yapılacağı. Varsayılan redirect. */
  mobile?: 'redirect' | 'new_tab' | 'modal';
  /** Popup engellenirse aynı sekmede yönlendirme (varsayılan) ya da `error` olayı. */
  onPopupBlocked?: 'redirect' | 'error';
  appearance?: Appearance;
  locale?: string;
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
  autoCloseOnComplete?: boolean;
}

export interface MountCheckoutOptions {
  sessionId?: string;
  clientSecret: string;
  appearance?: Appearance;
  locale?: string;
  /** ready gelmezse kaç ms sonra `embed_load_timeout` hatası verilir (varsayılan 15000) */
  loadTimeoutMs?: number;
}

export type RedirectToCheckoutOptions = { sessionId: string } | { url: string };
