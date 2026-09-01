import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { PaginatedPunishmentsResponse, PunishmentItem } from '../types';

export class PunishmentsModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * List punishments with pagination.
   * GET /v2/punishments
   */
  public async list(page: number = 1, limit: number = 10): Promise<PaginatedPunishmentsResponse> {
    return this.http.get<PaginatedPunishmentsResponse>('/v2/punishments', {
      params: { page, limit },
    });
  }

  /**
   * Search punishments by player name and optional type (ban, mute etc.).
   * GET /v2/punishments/search?query=:query&type=:type
   */
  public async search(query: string, type?: 'ban' | 'mute' | 'kick' | 'warn' | string): Promise<PunishmentItem[]> {
    return this.http.get<PunishmentItem[]>('/v2/punishments/search', {
      params: { query, type },
    });
  }
}
