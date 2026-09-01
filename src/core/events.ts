import { CrafterEventMap } from '../types';

export type EventHandler<T = any> = (payload: T) => void;

export class EventEmitter {
  private listeners: Map<string, Set<EventHandler>> = new Map();

  /**
   * Subscribe to an event.
   */
  on<K extends keyof CrafterEventMap>(
    event: K,
    handler: EventHandler<CrafterEventMap[K]>
  ): () => void;
  on(event: string, handler: EventHandler): () => void;
  on(event: string, handler: EventHandler): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    // Returns unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe a handler from an event.
   */
  off<K extends keyof CrafterEventMap>(
    event: K,
    handler: EventHandler<CrafterEventMap[K]>
  ): void;
  off(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Subscribe to an event and automatically remove the listener after it fires once.
   */
  once<K extends keyof CrafterEventMap>(
    event: K,
    handler: EventHandler<CrafterEventMap[K]>
  ): () => void;
  once(event: string, handler: EventHandler): () => void;
  once(event: string, handler: EventHandler): () => void {
    const wrapper: EventHandler = (data: any) => {
      this.off(event, wrapper);
      handler(data);
    };
    return this.on(event, wrapper);
  }

  /**
   * Emit an event to all subscribers.
   */
  emit<K extends keyof CrafterEventMap>(
    event: K,
    payload: CrafterEventMap[K]
  ): void;
  emit(event: string, payload?: any): void;
  emit(event: string, payload?: any): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((fn) => {
        try {
          fn(payload);
        } catch (error) {
          console.error(`[Crafter SDK] Error in event listener for "${event}":`, error);
        }
      });
    }
  }

  /**
   * Remove all listeners for an event or all events.
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
