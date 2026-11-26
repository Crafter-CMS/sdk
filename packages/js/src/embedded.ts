import { fetchPublicSession } from './api';
import { sanitizeAppearance } from './appearance';
import { PAGE_SOURCE, PROTOCOL_VERSION, SDK_SOURCE, SDK_VERSION, type ResolvedConfig } from './config';
import { CrafterPaymentsError } from './errors';
import { Handle } from './handle';
import type { Appearance, SessionStatus } from './types';
import { watchResult } from './watch';

export interface FrameOptions {
  sessionId: string;
  clientSecret: string;
  appearance?: Appearance;
  locale?: string;
  loadTimeoutMs?: number;
  /** redirect_required penceresi (test için değiştirilebilir) */
  openWindow?: (url: string) => Window | null;
}

const MAX_HEIGHT = 10000;

/** Gömülü sayfanın gönderdiği mesaj (#463 §5.3, protokol v1) */
interface PageMessage {
  source: typeof PAGE_SOURCE;
  v: 1;
  type: string;
  sessionId?: string;
  height?: unknown;
  status?: unknown;
  code?: unknown;
  message?: unknown;
  url?: unknown;
}

function isPageMessage(data: unknown): data is PageMessage {
  const d = data as Record<string, unknown> | null;
  return !!d && typeof d === 'object' && d.source === PAGE_SOURCE && d.v === PROTOCOL_VERSION && typeof d.type === 'string';
}

/**
 * Gömülü checkout iframe'i. clientSecret iframe adresine yazılmaz; iframe `ready` dedikten sonra yalnızca checkout
 * origin'ine postMessage ile verilir. Gelen her mesajda hem `event.origin` hem `event.source` doğrulanır.
 */
export class EmbeddedFrame {
  readonly iframe: HTMLIFrameElement;
  private readonly handle: Handle;
  private readonly config: ResolvedConfig;
  private readonly options: FrameOptions;
  private readonly appearance?: Appearance;
  private readyTimer?: ReturnType<typeof setTimeout>;
  private gotReady = false;
  private watching = false;
  private destroyed = false;
  private readonly listener = (event: MessageEvent) => this.onMessage(event);

  constructor(config: ResolvedConfig, handle: Handle, options: FrameOptions) {
    this.config = config;
    this.handle = handle;
    this.options = options;
    this.appearance = sanitizeAppearance(options.appearance);

    const iframe = document.createElement('iframe');
    const query = new URLSearchParams();
    const locale = options.locale ?? config.locale;
    if (locale) query.set('locale', locale);
    // Hash sunucuya ve Referer'a gitmez; sayfa `ready` mesajını hangi origin'e göndereceğini buradan bilir (sır değil)
    const hash = new URLSearchParams({ v: String(PROTOCOL_VERSION), origin: window.location.origin });
    const qs = query.toString();
    iframe.src = `${config.checkoutOrigin}/embed/${encodeURIComponent(options.sessionId)}${qs ? `?${qs}` : ''}#${hash}`;
    iframe.title = 'Checkout';
    iframe.setAttribute('allow', 'payment');
    iframe.setAttribute(
      'sandbox',
      'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation',
    );
    iframe.setAttribute('referrerpolicy', 'origin');
    iframe.setAttribute('scrolling', 'no');
    iframe.style.cssText = 'border:0;width:100%;min-width:280px;height:420px;display:block;background:transparent;color-scheme:normal';
    this.iframe = iframe;

    window.addEventListener('message', this.listener);
    const timeout = options.loadTimeoutMs ?? 15000;
    this.readyTimer = setTimeout(() => {
      if (this.gotReady || this.destroyed) return;
      this.handle.fail(
        new CrafterPaymentsError(
          'embed_load_timeout',
          'Embedded checkout did not load. Check that this page origin is in the store allowed origins list, ' +
            'that the session was created with uiMode "embedded", and that the store plan includes embedded checkout.',
        ),
      );
    }, timeout);
  }

  private post(message: Record<string, unknown>): void {
    this.iframe.contentWindow?.postMessage(
      { source: SDK_SOURCE, v: PROTOCOL_VERSION, ...message },
      this.config.checkoutOrigin,
    );
  }

  private onMessage(event: MessageEvent): void {
    if (this.destroyed) return;
    if (event.origin !== this.config.checkoutOrigin) return;
    if (!this.iframe.contentWindow || event.source !== this.iframe.contentWindow) return;
    const data = event.data;
    if (!isPageMessage(data)) return;
    if (data.sessionId && data.sessionId !== this.options.sessionId) return;
    const sessionId = this.options.sessionId;

    switch (data.type) {
      case 'ready': {
        // iframe 3DS sonrası yeniden yüklenirse init tekrar gönderilir
        this.post({
          type: 'init',
          sessionId,
          clientSecret: this.options.clientSecret,
          publishableKey: this.config.publishableKey,
          appearance: this.appearance,
          locale: this.options.locale ?? this.config.locale,
          sdkVersion: SDK_VERSION,
        });
        if (!this.gotReady) {
          this.gotReady = true;
          clearTimeout(this.readyTimer);
          this.handle.emit('ready', { sessionId });
        }
        break;
      }
      case 'resize': {
        const height = Number(data.height);
        if (Number.isFinite(height) && height >= 0) {
          this.iframe.style.height = `${Math.min(Math.ceil(height), MAX_HEIGHT)}px`;
        }
        break;
      }
      case 'complete':
        void this.confirm('complete');
        break;
      case 'expired':
        this.handle.finish('expired', { sessionId, status: 'expired', verified: false });
        break;
      case 'cancel':
        this.handle.finish('cancel', { sessionId, status: 'canceled', verified: false });
        break;
      case 'payment_failed':
        this.handle.emit('payment_failed', {
          sessionId,
          code: typeof data.code === 'string' ? data.code.slice(0, 64) : undefined,
        });
        break;
      case 'redirect_required':
        this.onRedirectRequired(data.url);
        break;
      case 'error': {
        const code = typeof data.code === 'string' ? data.code.slice(0, 64) : 'checkout_error';
        const message = typeof data.message === 'string' ? data.message.slice(0, 500) : 'Checkout error.';
        clearTimeout(this.readyTimer);
        this.handle.fail(new CrafterPaymentsError(code, message));
        break;
      }
      default:
        break; // loading ve bilinmeyen türler yok sayılır (ileri uyumluluk)
    }
  }

  /** Tamamlanma mesajını `/public` ile doğrular; okunamazsa doğrulanmamış olarak bildirir */
  private async confirm(status: SessionStatus): Promise<void> {
    const sessionId = this.options.sessionId;
    try {
      const session = await fetchPublicSession(this.config, sessionId, this.options.clientSecret);
      if (session.status === 'complete') {
        this.handle.finish('complete', { sessionId, status: 'complete', orderId: session.orderId, verified: true });
        return;
      }
    } catch {
      /* aşağıda doğrulanmamış sonuç */
    }
    this.handle.finish('complete', { sessionId, status, verified: false });
  }

  /** iframe içinde çalışmayan ödeme yöntemi: ayrı pencere, engellenirse aynı sekmede yönlendirme */
  private onRedirectRequired(rawUrl: unknown): void {
    const sessionId = this.options.sessionId;
    let url: URL;
    try {
      url = new URL(String(rawUrl));
    } catch {
      return;
    }
    if (url.protocol !== 'https:') return;
    this.handle.emit('redirect_required', { sessionId, url: url.href });
    const open = this.options.openWindow ?? ((u: string) => window.open(u, 'crafterpayments_checkout'));
    const win = open(url.href);
    if (!win) {
      window.location.assign(url.href);
      return;
    }
    if (!this.watching) {
      this.watching = true;
      watchResult(this.config, this.handle, sessionId, this.options.clientSecret);
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    try {
      this.post({ type: 'destroy', sessionId: this.options.sessionId });
    } catch {
      /* iframe zaten kalkmış olabilir */
    }
    this.destroyed = true;
    clearTimeout(this.readyTimer);
    window.removeEventListener('message', this.listener);
    this.iframe.remove();
  }
}
