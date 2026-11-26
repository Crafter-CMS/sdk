import { CrafterError } from '../core/errors';

export interface SectionsRenderOptions {
  /** Page to render the sections for; defaults to the current page (path + query) */
  url?: string;
  /** false: the DOM is not touched, only the HTML is returned */
  swap?: boolean;
}

/** Storefront limit (#324) */
const MAX_SECTIONS = 10;

/** 'header-group:announcement' → 'announcement' */
function instanceId(key: string): string {
  const index = key.indexOf(':');
  return index === -1 ? key : key.slice(index + 1);
}

/**
 * Section rendering (#447): fetches the current HTML of the sections from the `?sections=a,b` endpoint and replaces the
 * `#crafter-section-<id>` wrappers on the page with the new ones. Group sections are requested as `<group>:<id>`.
 */
export class SectionsModule {
  public async render(ids: string[], options: SectionsRenderOptions = {}): Promise<Record<string, string | null>> {
    const list = Array.from(new Set((ids || []).map((id) => String(id).trim()).filter(Boolean)));
    if (list.length === 0 || list.length > MAX_SECTIONS) {
      throw new CrafterError({ statusCode: 400, message: `sections.render: 1-${MAX_SECTIONS} sections` });
    }
    const base =
      options.url ?? (typeof window !== 'undefined' && window.location ? window.location.pathname + window.location.search : '/');
    const url = new URL(base, typeof window !== 'undefined' && window.location ? window.location.href : 'http://localhost');
    url.searchParams.set('sections', list.join(','));

    const response = await fetch(url.pathname + url.search, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    const data: any = await response.json().catch(() => null);
    if (!response.ok || !data || typeof data !== 'object') {
      throw CrafterError.fromResponse(response.status || 500, data);
    }

    const result: Record<string, string | null> = {};
    for (const key of list) {
      const html = typeof data[key] === 'string' ? data[key] : null;
      result[key] = html;
      if (html !== null && options.swap !== false) swapSection(instanceId(key), html);
    }
    return result;
  }
}

function swapSection(id: string, html: string): void {
  if (typeof document === 'undefined') return;
  const current = document.getElementById(`crafter-section-${id}`);
  if (!current) return;
  const holder = document.createElement('div');
  holder.innerHTML = html;
  const next = holder.firstElementChild;
  if (next) current.replaceWith(next);
}
