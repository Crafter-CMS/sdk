import { fetchPublicSession } from './api';
import { PROTOCOL_VERSION, RETURN_CHANNEL, SDK_SOURCE, type ResolvedConfig } from './config';
import { CrafterPaymentsError } from './errors';
import { eventForStatus, type Handle } from './handle';
import type { SessionStatus } from './types';

export interface WatchOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

const RETURN_STATUSES: readonly string[] = ['complete', 'processing', 'canceled', 'expired'];

export function isReturnMessage(data: unknown): data is { sessionId: string; status: SessionStatus } {
  const d = data as Record<string, unknown> | null;
  return (
    !!d &&
    typeof d === 'object' &&
    d.source === SDK_SOURCE &&
    d.v === PROTOCOL_VERSION &&
    d.type === 'return' &&
    typeof d.sessionId === 'string' &&
    typeof d.status === 'string' &&
    RETURN_STATUSES.includes(d.status)
  );
}

/**
 * Popup / yeni sekme sonucu (#463 §5.2). Checkout sayfası COOP same-origin gönderdiği için açan pencereyle
 * postMessage kurulamaz ve `popup.closed` güvenilir değildir. Sonuç iki kanaldan gelir:
 *  1. Dönüş adresi mağazanın kendi origin'inde → `handleReturn()` aynı-origin BroadcastChannel'a yazar.
 *  2. Yedek: `/public` yoklaması (2 sn, en çok 10 dk). clientSecret yoksa yalnızca 1. kanal çalışır.
 * Kesin durum mümkünse `/public`'ten okunur (verified: true).
 */
export function watchResult(
  config: ResolvedConfig,
  handle: Handle,
  sessionId: string,
  clientSecret: string | undefined,
  options: WatchOptions = {},
): void {
  const intervalMs = options.intervalMs ?? 2000;
  const deadline = Date.now() + (options.timeoutMs ?? 10 * 60 * 1000);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight = false;
  /** Dönüş adresinden gelen ama sunucuda henüz kesinleşmemiş durum */
  let hinted: SessionStatus | undefined;

  const settleFrom = (status: SessionStatus, verified: boolean, orderId?: string | null) => {
    const event = eventForStatus(status);
    if (event) handle.finish(event, { sessionId, status, orderId, verified });
  };

  const poll = async (): Promise<void> => {
    if (handle.settled || !clientSecret || inFlight) return;
    inFlight = true;
    try {
      const session = await fetchPublicSession(config, sessionId, clientSecret);
      if (eventForStatus(session.status)) {
        settleFrom(session.status, true, session.orderId);
        return;
      }
      // Sunucuda hâlâ open: alıcı "Geri dön" dedi (oturum iptal edilmez, #463 §5.1)
      if (hinted === 'canceled' || hinted === 'expired') settleFrom(hinted, false);
    } catch (err) {
      const e = err as CrafterPaymentsError;
      if (hinted && hinted !== 'processing') {
        settleFrom(hinted, false);
        return;
      }
      // 4xx (429 hariç): anahtar/oturum/origin hatası, yoklama durur
      if (e.code === 'api_error' && e.status && e.status >= 400 && e.status < 500 && e.status !== 429) {
        handle.fail(e);
        return;
      }
    } finally {
      inFlight = false;
    }
    schedule();
  };

  const schedule = () => {
    if (handle.settled || !clientSecret) return;
    if (Date.now() >= deadline) {
      handle.fail(new CrafterPaymentsError('result_timeout', 'No checkout result was received in time.'));
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(poll, intervalMs);
  };

  let channel: BroadcastChannel | undefined;
  if (typeof BroadcastChannel === 'function') {
    channel = new BroadcastChannel(RETURN_CHANNEL);
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data;
      if (!isReturnMessage(data) || data.sessionId !== sessionId || handle.settled) return;
      // Dönüş sekmesine "seni açan benim" bilgisi: sekme kendini kapatabilir
      try {
        channel?.postMessage({ source: SDK_SOURCE, v: PROTOCOL_VERSION, type: 'ack', sessionId });
      } catch {
        /* kanal kapanmış olabilir */
      }
      hinted = data.status;
      if (!clientSecret) {
        settleFrom(data.status, false);
        return;
      }
      clearTimeout(timer);
      void poll();
    };
  }

  handle.addCleanup(() => {
    clearTimeout(timer);
    channel?.close();
  });

  if (!clientSecret && !channel) {
    console.warn('[CrafterPayments] No clientSecret and no BroadcastChannel: the checkout result cannot be observed.');
  }
  schedule();
}
