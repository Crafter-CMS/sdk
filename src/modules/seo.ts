import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { SitemapUrlItem, WebsiteSeoConfig } from '../types';

export class SeoModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Get global website SEO configuration (meta tags, keywords, og:image, favicon etc.).
   * GET /v2/seo/config
   */
  public async getConfig(): Promise<WebsiteSeoConfig> {
    return this.http.get<WebsiteSeoConfig>('/v2/seo/config');
  }

  /**
   * Get dynamic sitemap URL entries for all published posts, pages, categories, and products.
   * GET /v2/seo/sitemap-data
   */
  public async getSitemapData(): Promise<SitemapUrlItem[]> {
    return this.http.get<SitemapUrlItem[]>('/v2/seo/sitemap-data');
  }
}
