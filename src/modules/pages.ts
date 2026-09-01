import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { PageItem } from '../types';

export class PagesModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * List all published static pages.
   * GET /v2/pages/public
   */
  public async list(): Promise<PageItem[]> {
    return this.http.get<PageItem[]>('/v2/pages/public');
  }

  /**
   * Get page details and content by slug.
   * GET /v2/pages/slug/:slug
   */
  public async getBySlug(slug: string): Promise<PageItem> {
    return this.http.get<PageItem>(`/v2/pages/slug/${slug}`);
  }
}
