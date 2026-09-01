import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { SiteStatistics } from '../types';

export class StatisticsModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Get homepage statistics: latest purchases, payments, signups, leaderboard and total users.
   * GET /v2/statistics?limit=:limit
   */
  public async get(limit: number = 5): Promise<SiteStatistics> {
    return this.http.get<SiteStatistics>('/v2/statistics', {
      params: { limit },
    });
  }
}
