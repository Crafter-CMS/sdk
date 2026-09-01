import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { ServerStatusItem } from '../types';

export class ServersModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Get server list with live player counts and online status.
   * GET /config/servers
   */
  public async getList(): Promise<ServerStatusItem[]> {
    return this.http.get<ServerStatusItem[]>('/config/servers');
  }

  /**
   * Alias for getList.
   */
  public async list(): Promise<ServerStatusItem[]> {
    return this.getList();
  }
}
