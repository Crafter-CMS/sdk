import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { LuckPermsPlayerData } from '../types';

export class LuckPermsModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Get player's LuckPerms primary group, inherited groups, and active permissions.
   * Identifier can be a player username or Minecraft UUID.
   * GET /v2/modules/luckperms/player/:identifier
   */
  public async getPlayer(identifier: string): Promise<LuckPermsPlayerData> {
    return this.http.get<LuckPermsPlayerData>(`/v2/modules/luckperms/player/${identifier}`);
  }

  /**
   * Get list of available LuckPerms groups configured on the server.
   * GET /v2/modules/luckperms/groups
   */
  public async getGroups(): Promise<string[]> {
    return this.http.get<string[]>('/v2/modules/luckperms/groups');
  }
}
