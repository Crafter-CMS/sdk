import { JSDOM, VirtualConsole } from 'jsdom';

export const PK = 'cp_pk_test_' + 'a'.repeat(32);
export const PK_LIVE = 'cp_pk_live_' + 'b'.repeat(32);
export const SK = 'cp_sk_test_' + 'c'.repeat(32);
export const SID = 'cs_test_' + 'A1b2C3d4E5f6G7h8I9j0K1l2';
export const SECRET = `${SID}_secret_` + 'Z'.repeat(24);
export const CHECKOUT = 'https://checkout.crafterpayments.com';
export const API = 'https://api.crafterpayments.com/v1';

/** Yeni jsdom penceresi; global window/document/fetch bunlara bağlanır. Gezinme denemeleri `navigations`a düşer. */
export function setupDom(url = 'https://shop.example.com/cart') {
  const navigations = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (err) => {
    if (/navigation/i.test(String(err && err.message))) navigations.push(err.message);
  });
  const dom = new JSDOM('<!doctype html><html><body><div id="pay"></div></body></html>', {
    url,
    pretendToBeVisual: true,
    virtualConsole,
  });
  const { window } = dom;
  globalThis.window = window;
  globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.MessageEvent = window.MessageEvent;
  const opened = [];
  window.open = (u, target, features) => {
    const win = {
      url: u,
      target,
      features,
      closed: false,
      replaced: [],
      location: { replace: (next) => win.replaced.push(next) },
      close() {
        win.closed = true;
      },
    };
    opened.push(win);
    return win;
  };
  return { dom, window, navigations, opened };
}

/** fetch taklidi: sıradaki yanıtı döndürür, istekleri kaydeder */
export function mockFetch(responses) {
  const calls = [];
  const queue = [...responses];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next instanceof Error) throw next;
    const status = next.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => null },
      json: async () => next.body,
    };
  };
  return calls;
}

export function publicSession(status, extra = {}) {
  return {
    body: {
      id: SID,
      object: 'checkout.session',
      status,
      paymentStatus: status === 'complete' ? 'paid' : 'unpaid',
      amountTotal: 9.99,
      currency: 'USD',
      orderId: status === 'complete' ? 'CR-7F3K2M' : null,
      delivery: { status: null },
      expiresAt: '2026-11-26T12:00:00.000Z',
    },
  };
}

/** iframe'den gelen mesajı taklit eder */
export function postFromFrame(window, iframe, data, origin = CHECKOUT) {
  window.dispatchEvent(new window.MessageEvent('message', { data, origin, source: iframe.contentWindow }));
}

export const page = (type, extra = {}) => ({ source: 'crafterpayments-checkout', v: 1, type, sessionId: SID, ...extra });

export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
