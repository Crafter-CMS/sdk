import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { ChestItem } from '../types';

export class ChestModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Get user's chest items.
   * GET /chest/:userId
   */
  public async getItems(userId: string = 'me'): Promise<ChestItem[]> {
    return this.http.get<ChestItem[]>(`/chest/${userId}`);
  }

  /**
   * Use an item from the user's chest.
   * POST /chest/:userId/use/:chestItemId
   */
  public async useItem(chestItemId: string, userId: string = 'me'): Promise<any> {
    const response = await this.http.post<any>(`/chest/${userId}/use/${chestItemId}`, {});
    this.events.emit('chest:item_used', { itemId: chestItemId, response });
    return response;
  }

  /**
   * Gift a chest item to another user.
   * POST /chest/:from/gift/:to/:chestItemId
   */
  public async giftItem(targetUserId: string, chestItemId: string, fromUserId: string = 'me'): Promise<any> {
    const response = await this.http.post<any>(`/chest/${fromUserId}/gift/${targetUserId}/${chestItemId}`, {});
    this.events.emit('chest:item_gifted', { targetUserId, itemId: chestItemId, response });
    return response;
  }
}
