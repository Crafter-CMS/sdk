import type { CheckoutEventHandler, CheckoutEventName, CheckoutEvents } from './types';

export class Emitter {
  private handlers: { [K in CheckoutEventName]?: Set<CheckoutEventHandler<K>> } = {};

  on<K extends CheckoutEventName>(event: K, handler: CheckoutEventHandler<K>): void {
    let set = this.handlers[event] as Set<CheckoutEventHandler<K>> | undefined;
    if (!set) {
      set = new Set();
      (this.handlers as Record<string, unknown>)[event] = set;
    }
    set.add(handler);
  }

  off<K extends CheckoutEventName>(event: K, handler: CheckoutEventHandler<K>): void {
    (this.handlers[event] as Set<CheckoutEventHandler<K>> | undefined)?.delete(handler);
  }

  emit<K extends CheckoutEventName>(event: K, payload: CheckoutEvents[K]): void {
    const set = this.handlers[event] as Set<CheckoutEventHandler<K>> | undefined;
    if (!set) {
      // Dinlenmeyen hata kaybolmasın
      if (event === 'error') console.error('[CrafterPayments]', (payload as CheckoutEvents['error']).error);
      return;
    }
    for (const handler of Array.from(set)) {
      try {
        handler(payload);
      } catch (err) {
        console.error('[CrafterPayments] event handler threw:', err);
      }
    }
  }

  clear(): void {
    this.handlers = {};
  }
}
