import { EventEmitter } from './events';

/**
 * Tema olayları (#447): SDK değişiklikleri hem kendi olay yoluna (`crafter.on('cart:updated')`) hem de
 * `document` üzerine `crafter:<ad>` CustomEvent olarak yayar. Temalar SDK örneğini beklemeden dinleyebilir:
 *   document.addEventListener('crafter:cart:updated', (e) => e.detail.itemCount)
 */
export const DOM_EVENTS = {
  ready: 'crafter:ready',
  cartUpdated: 'crafter:cart:updated',
  localizationChanged: 'crafter:localization:changed',
} as const;

export type DomEventName = (typeof DOM_EVENTS)[keyof typeof DOM_EVENTS];

function targetDocument(): any {
  return typeof document !== 'undefined' ? document : undefined;
}

/** `document` üzerine `crafter:<name>` olayı; tarayıcı dışında sessizce atlanır */
export function dispatchDomEvent(name: string, detail?: unknown): void {
  const doc = targetDocument();
  if (!doc || typeof doc.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
  const type = name.startsWith('crafter:') ? name : `crafter:${name}`;
  try {
    doc.dispatchEvent(new CustomEvent(type, { detail }));
  } catch (error) {
    console.error(`[Crafter SDK] "${type}" olayı yayılamadı:`, error);
  }
}

export class DomEvents {
  constructor(private events: EventEmitter) {}

  /** SDK olay yoluna ve `document`'a birlikte yayar */
  public emit(name: string, detail?: unknown): void {
    this.events.emit(name, detail);
    dispatchDomEvent(name, detail);
  }

  /**
   * `document` üzerindeki `crafter:<name>` olayını dinler; işleyici `event.detail` alır. Aboneliği kaldıran fonksiyon döner.
   * @example crafter.dom.on('cart:updated', (cart) => badge.textContent = cart.itemCount)
   */
  public on(name: string, handler: (detail: any) => void): () => void {
    const doc = targetDocument();
    if (!doc) return () => {};
    const type = name.startsWith('crafter:') ? name : `crafter:${name}`;
    const listener = (event: any) => handler(event?.detail);
    doc.addEventListener(type, listener);
    return () => doc.removeEventListener(type, listener);
  }
}
