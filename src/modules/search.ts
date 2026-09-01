import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { SearchResultItem } from '../types';

export class SearchModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Global metadata live search across users, posts, tickets, pages, and products.
   * GET /metadata-search?q=:query&limit=:limit
   */
  public async metadataSearch(query: string, limit: number = 5): Promise<SearchResultItem[]> {
    const res = await this.http.get<any>('/metadata-search', {
      params: { q: query, limit },
    });
    return Array.isArray(res) ? res : (res?.data || []);
  }

  /**
   * Alias for metadataSearch.
   */
  public async query(searchTerm: string, limit: number = 5): Promise<SearchResultItem[]> {
    return this.metadataSearch(searchTerm, limit);
  }
}
