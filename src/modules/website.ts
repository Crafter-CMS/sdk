import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { WebsiteInfo } from '../types';

export class WebsiteModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Get website general info, active plugin modules (discord_bot, authme, luckperms, etc.), and settings.
   * Resolves to GET /api/storefront in storefront mode, or GET /website/:websiteId in direct mode.
   */
  public async getInfo(): Promise<WebsiteInfo> {
    return this.http.get<WebsiteInfo>('');
  }
}
