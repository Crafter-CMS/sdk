import { Emitter } from './emitter';
import { CrafterPaymentsError } from './errors';
import type {
  CheckoutController,
  CheckoutEventHandler,
  CheckoutEventName,
  CheckoutEvents,
  CheckoutResult,
  SessionStatus,
} from './types';

export type ResultEvent = 'complete' | 'cancel' | 'expired';

export function eventForStatus(status: SessionStatus): ResultEvent | null {
  if (status === 'complete') return 'complete';
  if (status === 'canceled') return 'cancel';
  if (status === 'expired') return 'expired';
  return null;
}

/**
 * Tüm modların ortak denetleyicisi: olaylar + tek seferlik `result` sözü + temizlik listesi.
 */
export class Handle implements CheckoutController {
  readonly emitter = new Emitter();
  readonly result: Promise<CheckoutResult | null>;
  sessionId?: string;
  settled = false;
  private resolveFn!: (value: CheckoutResult | null) => void;
  private rejectFn!: (reason: unknown) => void;
  private cleanups: Array<() => void> = [];
  /** close() çağrılınca moda özel kapatma (pencere, modal) */
  onClose?: () => void;

  constructor() {
    this.result = new Promise((resolve, reject) => {
      this.resolveFn = resolve;
      this.rejectFn = reject;
    });
    // `result` hiç dinlenmezse tarayıcıda "unhandled rejection" uyarısı çıkmasın
    this.result.catch(() => undefined);
  }

  on<K extends CheckoutEventName>(event: K, handler: CheckoutEventHandler<K>): this {
    this.emitter.on(event, handler);
    return this;
  }

  off<K extends CheckoutEventName>(event: K, handler: CheckoutEventHandler<K>): this {
    this.emitter.off(event, handler);
    return this;
  }

  emit<K extends CheckoutEventName>(event: K, payload: CheckoutEvents[K]): void {
    this.emitter.emit(event, payload);
  }

  addCleanup(fn: () => void): void {
    if (this.settled) fn();
    else this.cleanups.push(fn);
  }

  /** Sonuç olayı; ilk sonuç sözü çözer ve yoklama/kanal gibi kaynakları bırakır */
  finish(event: ResultEvent, result: CheckoutResult): void {
    if (this.settled) return;
    this.settled = true;
    this.emit(event, result);
    this.resolveFn(result);
    this.runCleanups();
  }

  fail(error: CrafterPaymentsError): void {
    if (this.settled) return;
    this.settled = true;
    this.emit('error', { sessionId: this.sessionId, error });
    this.rejectFn(error);
    this.runCleanups();
  }

  close(): void {
    const wasSettled = this.settled;
    this.settled = true;
    this.runCleanups();
    const hook = this.onClose;
    this.onClose = undefined;
    hook?.();
    if (!wasSettled) {
      this.emit('close', { sessionId: this.sessionId });
      this.resolveFn(null);
    }
  }

  private runCleanups(): void {
    const list = this.cleanups;
    this.cleanups = [];
    for (const fn of list) {
      try {
        fn();
      } catch {
        /* temizlik hatası yutulur */
      }
    }
  }
}
