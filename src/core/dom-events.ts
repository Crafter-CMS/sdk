import { EventEmitter } from './events';

/**
 * Theme events (#447): the SDK emits changes both on its own event bus (`crafter.on('cart:updated')`) and as a
 * `crafter:<name>` CustomEvent on `document`. Themes can listen without waiting for the SDK instance:
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

/** `crafter:<name>` event on `document`; silently skipped outside the browser */
export function dispatchDomEvent(name: string, detail?: unknown): void {
  const doc = targetDocument();
  if (!doc || typeof doc.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return;
  const type = name.startsWith('crafter:') ? name : `crafter:${name}`;
  try {
    doc.dispatchEvent(new CustomEvent(type, { detail }));
  } catch (error) {
    console.error(`[Crafter SDK] Could not dispatch the "${type}" event:`, error);
  }
}

export class DomEvents {
  constructor(private events: EventEmitter) {}

  /** Emits on the SDK event bus and on `document` together */
  public emit(name: string, detail?: unknown): void {
    this.events.emit(name, detail);
    dispatchDomEvent(name, detail);
  }

  /**
   * Listens for the `crafter:<name>` event on `document`; the handler receives `event.detail`. Returns a function that unsubscribes.
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
