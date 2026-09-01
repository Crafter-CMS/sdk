import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { VoteProcessResponse, VoteProviderItem } from '../types';

export class VoteModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Get active vote sites with player cooldowns.
   * GET /config/vote-providers
   */
  public async getProviders(): Promise<VoteProviderItem[]> {
    return this.http.get<VoteProviderItem[]>('/config/vote-providers');
  }

  /**
   * Process vote request.
   * POST /config/vote-providers/vote
   */
  public async vote(providerId: string, extraData: Record<string, any> = {}): Promise<VoteProcessResponse> {
    const response = await this.http.post<VoteProcessResponse>('/config/vote-providers/vote', { providerId, ...extraData });
    this.events.emit('vote:success', { providerId, response });
    return response;
  }
}
