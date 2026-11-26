import { fetchPublicSession } from './api';
import {
  assertClientSecret,
  assertNotSecretKey,
  assertSessionId,
  resolveConfig,
  sessionIdFromClientSecret,
  type ConfigOptions,
  type ResolvedConfig,
} from './config';
import { EmbeddedFrame } from './embedded';
import { CrafterPaymentsError } from './errors';
import { Handle } from './handle';
import { createModal } from './modal';
import { handleReturn, type HandleReturnOptions, type ReturnResult } from './return';
import type {
  CheckoutController,
  CreatedSession,
  EmbeddedCheckout,
  MountCheckoutOptions,
  OpenCheckoutOptions,
  PublicCheckoutSession,
  RedirectToCheckoutOptions,
} from './types';
import { watchResult } from './watch';

export type CrafterPaymentsOptions = ConfigOptions;

const POPUP_NAME = 'crafterpayments_checkout';
const defer = (fn: () => void) => void Promise.resolve().then(fn);

interface ResolvedSession {
  sessionId: string;
  clientSecret?: string;
  url: string;
}

/** Mobil eşik (#260): genişlik < 800 px, düşük yükseklik ya da dokunmatik dar ekran */
export function isMobileViewport(win: Window = window): boolean {
  const coarse = typeof win.matchMedia === 'function' && win.matchMedia('(pointer: coarse)').matches;
  return win.innerWidth < 800 || win.innerHeight < 500 || (coarse && win.innerWidth < 1024);
}

function popupFeatures(win: Window): string {
  const width = 480;
  const height = 720;
  const left = Math.max(0, Math.round((win.screenX ?? 0) + ((win.outerWidth || width) - width) / 2));
  const top = Math.max(0, Math.round((win.screenY ?? 0) + ((win.outerHeight || height) - height) / 2));
  return `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
}

export class CrafterPayments {
  private readonly config: ResolvedConfig;

  constructor(publishableKey: string, options: CrafterPaymentsOptions = {}) {
    if (typeof window === 'undefined') {
      throw new CrafterPaymentsError('not_browser', '@crafterpayments/js runs only in the browser.');
    }
    this.config = resolveConfig(publishableKey, options);
  }

  /** Anahtar canlı mod mu (cp_pk_live_) */
  get livemode(): boolean {
    return this.config.livemode;
  }

  /** Checkout sayfasının origin'i (postMessage doğrulaması bu değere yapılır) */
  get checkoutOrigin(): string {
    return this.config.checkoutOrigin;
  }

  private checkoutUrl(sessionId: string | undefined, url: string | undefined): string {
    if (url) {
      assertNotSecretKey(url, 'url');
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new CrafterPaymentsError('invalid_checkout_url', 'Invalid checkout URL.');
      }
      if (parsed.origin !== this.config.checkoutOrigin || !/^\/(c|s)\/[^/]+/.test(parsed.pathname)) {
        throw new CrafterPaymentsError(
          'invalid_checkout_url',
          `Checkout URL must be a session URL on ${this.config.checkoutOrigin} (use the "url" returned by the API).`,
        );
      }
      return parsed.href;
    }
    return `${this.config.checkoutOrigin}/c/${encodeURIComponent(sessionId!)}`;
  }

  private resolveSession(input: { sessionId?: string; clientSecret?: string; url?: string }): ResolvedSession {
    assertNotSecretKey(input.clientSecret, 'clientSecret');
    let sessionId = input.sessionId;
    if (!sessionId && input.clientSecret) sessionId = sessionIdFromClientSecret(input.clientSecret);
    if (!sessionId && input.url) {
      const match = /\/c\/(cs_(?:test|live)_[A-Za-z0-9]+)/.exec(input.url);
      sessionId = match?.[1];
    }
    if (!sessionId && !input.url) {
      throw new CrafterPaymentsError('invalid_options', 'Pass sessionId, clientSecret or url.');
    }
    if (sessionId) {
      assertSessionId(sessionId);
      const live = sessionId.startsWith('cs_live_');
      if (live !== this.config.livemode) {
        throw new CrafterPaymentsError(
          'invalid_session_id',
          `This ${live ? 'live' : 'test'} session cannot be used with a ${this.config.livemode ? 'live' : 'test'} publishable key.`,
        );
      }
    }
    const clientSecret = input.clientSecret ? assertClientSecret(input.clientSecret, sessionId) : undefined;
    return { sessionId: sessionId ?? '', clientSecret, url: this.checkoutUrl(sessionId, input.url) };
  }

  /** Aynı sekmede barındırılan checkout sayfasına yönlendirir (#463 §5.1) */
  async redirectToCheckout(options: RedirectToCheckoutOptions): Promise<void> {
    if (!options || typeof options !== 'object') {
      throw new CrafterPaymentsError('invalid_options', 'Pass { sessionId } or { url }.');
    }
    const input = options as { sessionId?: string; url?: string };
    const { url } = this.resolveSession({ sessionId: input.sessionId, url: input.url });
    window.location.assign(url);
  }

  /**
   * Checkout'u açar: popup (masaüstü varsayılanı), modal (gömülü iframe) ya da yönlendirme. Kullanıcı tıklamasının
   * içinde çağrılmalıdır; `createSession` verilirse pencere/modal hemen açılır, oturum gelince yüklenir.
   */
  open(options: OpenCheckoutOptions): CheckoutController {
    const handle = new Handle();
    const hasSession = !!(options.sessionId || options.clientSecret || options.url);
    if (!hasSession && typeof options.createSession !== 'function') {
      throw new CrafterPaymentsError('invalid_options', 'Pass sessionId/clientSecret/url or createSession.');
    }
    const eager = hasSession ? this.resolveSession(options) : undefined;
    if (eager) handle.sessionId = eager.sessionId;

    const requested = options.mode ?? 'auto';
    let mode: 'popup' | 'modal' | 'redirect' | 'new_tab' = requested === 'auto' ? 'popup' : requested;
    if (isMobileViewport()) {
      if (requested === 'auto' || requested === 'popup') mode = options.mobile ?? 'redirect';
      else if (requested === 'modal' && options.mobile) mode = options.mobile;
    }

    const load = (): Promise<ResolvedSession> => {
      if (eager) return Promise.resolve(eager);
      return Promise.resolve()
        .then(() => options.createSession!())
        .catch((err: unknown) => {
          throw new CrafterPaymentsError(
            'create_session_failed',
            err instanceof Error ? err.message : 'createSession failed.',
          );
        })
        .then((created: CreatedSession) => {
          const resolved = this.resolveSession(created ?? ({} as CreatedSession));
          handle.sessionId = resolved.sessionId;
          return resolved;
        });
    };
    const failWith = (err: unknown) =>
      handle.fail(
        err instanceof CrafterPaymentsError ? err : new CrafterPaymentsError('invalid_options', String(err)),
      );

    if (mode === 'redirect') {
      load()
        .then((s) => window.location.assign(s.url))
        .catch(failWith);
      return handle;
    }

    if (mode === 'modal') {
      this.openModal(handle, options, load, failWith);
      return handle;
    }

    // popup / new_tab: pencere tıklama anında (senkron) açılır, yoksa engelleyiciye takılır
    const features = mode === 'popup' ? popupFeatures(window) : undefined;
    const target = mode === 'popup' ? POPUP_NAME : '_blank';
    const win = eager ? window.open(eager.url, target, features) : window.open('about:blank', target, features);
    if (win) handle.onClose = () => win.close();

    load()
      .then((s) => {
        if (!win) {
          if (options.onPopupBlocked === 'error') {
            handle.fail(new CrafterPaymentsError('popup_blocked', 'The checkout window was blocked by the browser.'));
          } else {
            window.location.assign(s.url);
          }
          return;
        }
        if (!eager) win.location.replace(s.url);
        handle.emit('ready', { sessionId: s.sessionId });
        watchResult(this.config, handle, s.sessionId, s.clientSecret);
      })
      .catch((err) => {
        win?.close();
        failWith(err);
      });
    return handle;
  }

  private openModal(
    handle: Handle,
    options: OpenCheckoutOptions,
    load: () => Promise<ResolvedSession>,
    failWith: (err: unknown) => void,
  ): void {
    const modal = createModal(handle, options);
    let frame: EmbeddedFrame | undefined;
    handle.onClose = () => {
      frame?.destroy();
      modal.remove();
    };
    handle.on('ready', () => modal.setLoading(false));
    handle.on('error', () => modal.setLoading(false));
    if (options.autoCloseOnComplete !== false) {
      const closeSoon = () => defer(() => handle.close());
      handle.on('complete', closeSoon);
      handle.on('cancel', closeSoon);
    }
    load()
      .then((s) => {
        if (handle.settled) return; // tıklamadan sonra kapatıldı
        if (!s.clientSecret) {
          throw new CrafterPaymentsError('invalid_options', 'Modal checkout requires the session clientSecret.');
        }
        frame = new EmbeddedFrame(this.config, handle, {
          sessionId: s.sessionId,
          clientSecret: s.clientSecret,
          appearance: options.appearance,
          locale: options.locale,
        });
        modal.body.append(frame.iframe);
      })
      .catch(failWith);
  }

  /** Gömülü checkout'u verilen öğeye yerleştirir (#463 §5.3). Oturum `uiMode: "embedded"` ile açılmalıdır. */
  mountCheckout(target: string | HTMLElement, options: MountCheckoutOptions): EmbeddedCheckout {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (!element || typeof (element as HTMLElement).appendChild !== 'function') {
      throw new CrafterPaymentsError('mount_target_not_found', `Mount target not found: ${String(target)}`);
    }
    if (!options || !options.clientSecret) {
      throw new CrafterPaymentsError('invalid_options', 'Embedded checkout requires the session clientSecret.');
    }
    const session = this.resolveSession(options);
    const handle = new Handle();
    handle.sessionId = session.sessionId;
    const frame = new EmbeddedFrame(this.config, handle, {
      sessionId: session.sessionId,
      clientSecret: session.clientSecret!,
      appearance: options.appearance,
      locale: options.locale,
      loadTimeoutMs: options.loadTimeoutMs,
    });
    handle.onClose = () => frame.destroy();
    element.appendChild(frame.iframe);
    return Object.assign(handle, {
      iframe: frame.iframe,
      destroy: () => handle.close(),
    }) as unknown as EmbeddedCheckout;
  }

  /** Oturumun herkese açık durumunu okur (publishable anahtar + clientSecret) */
  retrieveSession(clientSecret: string): Promise<PublicCheckoutSession> {
    const { sessionId, clientSecret: secret } = this.resolveSession({ clientSecret });
    return fetchPublicSession(this.config, sessionId, secret!);
  }

  handleReturn(options?: HandleReturnOptions): Promise<ReturnResult | null> {
    return handleReturn(options);
  }
}
