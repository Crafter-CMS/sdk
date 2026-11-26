import { PROTOCOL_VERSION, RETURN_CHANNEL, SDK_SOURCE } from './config';

export type ReturnStatus = 'complete' | 'processing' | 'canceled' | 'expired';

export interface ReturnResult {
  sessionId: string;
  status: ReturnStatus;
  /** Adreste `cp_sig` var mı. İmzayı yalnızca sunucunuz `returnSecret` ile doğrulayabilir. */
  signed: boolean;
  /** Bu sekme SDK'nın açtığı popup/yeni sekme ise true (açan sayfa kanaldan yanıt verdi) */
  openedByCheckout: boolean;
}

export interface HandleReturnOptions {
  /** Popup/yeni sekmeyse pencereyi kapat (varsayılan true) */
  closeWindow?: boolean;
  /** Açan sayfanın yanıtı için bekleme süresi (varsayılan 1500 ms) */
  ackTimeoutMs?: number;
  /** Varsayılan: window.location.href */
  url?: string;
}

const STATUSES: readonly string[] = ['complete', 'processing', 'canceled', 'expired'];
const SESSION_ID = /^cs_(test|live)_[A-Za-z0-9]{22,40}$/;

/**
 * successUrl / cancelUrl sayfasında çağrılır (#463 §5.2). Adresteki `session_id` + `cp_status` değerini aynı
 * origin'deki açan sayfaya BroadcastChannel ile iletir; açan sayfa yanıt verirse sekme kendini kapatır.
 * Adresteki durum yalnızca bir ipucudur; teslimatı webhook'a ya da sunucudaki GET isteğine bağlayın.
 */
export async function handleReturn(options: HandleReturnOptions = {}): Promise<ReturnResult | null> {
  if (typeof window === 'undefined') return null;
  let params: URLSearchParams;
  try {
    params = new URL(options.url ?? window.location.href).searchParams;
  } catch {
    return null;
  }
  const sessionId = params.get('session_id') ?? params.get('cp_session') ?? '';
  const status = params.get('cp_status') ?? '';
  if (!SESSION_ID.test(sessionId) || !STATUSES.includes(status)) return null;

  const result: ReturnResult = {
    sessionId,
    status: status as ReturnStatus,
    signed: /^[0-9a-f]{64}$/.test(params.get('cp_sig') ?? ''),
    openedByCheckout: false,
  };
  if (typeof BroadcastChannel !== 'function') return result;

  const channel = new BroadcastChannel(RETURN_CHANNEL);
  result.openedByCheckout = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), options.ackTimeoutMs ?? 1500);
    channel.onmessage = (event: MessageEvent) => {
      const d = event.data as Record<string, unknown> | null;
      if (d && d.source === SDK_SOURCE && d.type === 'ack' && d.sessionId === sessionId) {
        clearTimeout(timer);
        resolve(true);
      }
    };
    channel.postMessage({ source: SDK_SOURCE, v: PROTOCOL_VERSION, type: 'return', sessionId, status });
  });
  channel.close();

  if (result.openedByCheckout && options.closeWindow !== false) {
    try {
      window.close();
    } catch {
      /* tarayıcı izin vermedi; sayfa kendi mesajını gösterir */
    }
  }
  return result;
}
