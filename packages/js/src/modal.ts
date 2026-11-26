import type { Handle } from './handle';

export interface ModalOptions {
  closeOnEscape?: boolean;
  closeOnBackdrop?: boolean;
}

export interface Modal {
  /** iframe'in yerleşeceği kap */
  body: HTMLElement;
  setLoading(loading: boolean): void;
  remove(): void;
}

/**
 * Tıklama anında açılan modal (#260 kapsam genişletme). Stil satır içi; sayfaya stil dosyası eklenmez. Odak modala
 * taşınır, kapanınca geri verilir; sayfa kaydırması kilitlenir.
 */
export function createModal(handle: Handle, options: ModalOptions): Modal {
  const doc = document;
  const previousFocus = doc.activeElement as HTMLElement | null;
  const previousOverflow = doc.body.style.overflow;

  const overlay = doc.createElement('div');
  overlay.setAttribute('data-crafterpayments-modal', '');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,.55);display:flex;' +
    'align-items:center;justify-content:center;padding:16px;box-sizing:border-box';

  const dialog = doc.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Checkout');
  dialog.tabIndex = -1;
  dialog.style.cssText =
    'position:relative;width:100%;max-width:520px;max-height:100%;overflow:auto;background:#fff;' +
    'border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.3);outline:none';

  const close = doc.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  close.textContent = '×';
  close.style.cssText =
    'position:absolute;top:8px;right:8px;z-index:1;width:32px;height:32px;border:0;border-radius:16px;' +
    'background:rgba(0,0,0,.06);color:#111;font:20px/32px system-ui,sans-serif;cursor:pointer;padding:0';

  const loading = doc.createElement('div');
  loading.setAttribute('role', 'status');
  loading.setAttribute('aria-live', 'polite');
  loading.style.cssText = 'padding:64px 16px;text-align:center;font:14px system-ui,sans-serif;color:#555';
  loading.textContent = '…';

  const body = doc.createElement('div');

  dialog.append(close, loading, body);
  overlay.append(dialog);
  doc.body.append(overlay);
  doc.body.style.overflow = 'hidden';
  dialog.focus();

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && options.closeOnEscape !== false) handle.close();
  };
  const onBackdrop = (event: MouseEvent) => {
    if (event.target === overlay && options.closeOnBackdrop) handle.close();
  };
  const onClose = () => handle.close();
  doc.addEventListener('keydown', onKey);
  overlay.addEventListener('click', onBackdrop);
  close.addEventListener('click', onClose);

  return {
    body,
    setLoading(value: boolean) {
      loading.style.display = value ? '' : 'none';
    },
    remove() {
      doc.removeEventListener('keydown', onKey);
      overlay.remove();
      doc.body.style.overflow = previousOverflow;
      try {
        previousFocus?.focus?.();
      } catch {
        /* odak geri verilemedi */
      }
    },
  };
}
