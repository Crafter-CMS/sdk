import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import {
  ChangePasswordDto,
  DisableTwoFactorDto,
  DiscordStatusData,
  DiscordStatusResponse,
  LightweightBalanceResponse,
  SendBalanceParams,
  SendBalanceResponse,
  TwoFactorStatusResponse,
  UpdateOwnUserDto,
  UserProfile,
  WallMessage,
} from '../types';

export class UsersModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Get user profile by ID or current user ('me').
   * GET /v2/users/:userId
   */
  public async getProfile(userId: string = 'me'): Promise<UserProfile> {
    return this.http.get<UserProfile>(`/v2/users/${userId}`);
  }

  /**
   * High-performance lightweight balance check for theme headers.
   * GET /v2/users/:userId/balance
   */
  public async getBalance(userId: string = 'me'): Promise<LightweightBalanceResponse['data']> {
    const res = await this.http.get<LightweightBalanceResponse>(`/v2/users/${userId}/balance`);
    return res.data || res;
  }

  /**
   * Search/get user by username.
   * GET /v2/users/@:username
   */
  public async getByUsername(username: string): Promise<UserProfile> {
    const cleanUsername = username.replace(/^@/, '');
    return this.http.get<UserProfile>(`/v2/users/@${cleanUsername}`);
  }

  /**
   * Update own user profile.
   * In backend self-update, only email can be updated.
   * PUT /v2/users/:userId
   */
  public async updateProfile(data: UpdateOwnUserDto, userId: string = 'me'): Promise<UserProfile> {
    const payload: UpdateOwnUserDto = { email: data.email };
    const updated = await this.http.put<UserProfile>(`/v2/users/${userId}`, payload);
    this.events.emit('user:updated', updated);
    return updated;
  }

  /**
   * Send balance to another user.
   * POST /v2/users/:sender/balance/send
   */
  public async sendBalance(params: SendBalanceParams): Promise<SendBalanceResponse> {
    const sender = params.userId || 'me';
    const response = await this.http.post<SendBalanceResponse>(`/v2/users/${sender}/balance/send`, {
      targetUserId: params.targetUserId,
      amount: params.amount,
    });

    this.events.emit('balance:sent', response);
    return response;
  }

  /**
   * Change user password.
   * POST /v2/users/:userId/change-password
   */
  public async changePassword(
    data: ChangePasswordDto | { currentPassword?: string; current_password?: string; newPassword?: string; new_password?: string },
    userId: string = 'me'
  ): Promise<{ success: boolean; message: string }> {
    const payload: ChangePasswordDto = {
      currentPassword: (data as any).currentPassword || (data as any).current_password || '',
      newPassword: (data as any).newPassword || (data as any).new_password || '',
    };
    return this.http.post(`/v2/users/${userId}/change-password`, payload);
  }

  // ===================== User Wall Messages =====================

  /**
   * List wall messages and replies for a user profile.
   * GET /v2/users/:userId/wall
   */
  public async getWall(userId: string): Promise<WallMessage[]> {
    return this.http.get<WallMessage[]>(`/v2/users/${userId}/wall`);
  }

  /**
   * Post a message on a user's wall.
   * POST /v2/users/:userId/wall
   */
  public async postWallMessage(userId: string, content: string): Promise<any> {
    const res = await this.http.post<any>(`/v2/users/${userId}/wall`, { content });
    this.events.emit('wall:message_added', { userId, message: res });
    return res;
  }

  /**
   * Reply to a wall message.
   * POST /v2/users/:userId/wall/:wallMessageId/reply
   */
  public async replyWallMessage(userId: string, wallMessageId: string, content: string): Promise<any> {
    const res = await this.http.post<any>(`/v2/users/${userId}/wall/${wallMessageId}/reply`, { content });
    this.events.emit('wall:reply_added', { userId, wallMessageId, reply: res });
    return res;
  }

  // ===================== User 2FA Management =====================

  /**
   * Check 2FA active methods status.
   * GET /v2/users/me/2fa/status
   */
  public async get2FaStatus(): Promise<TwoFactorStatusResponse> {
    return this.http.get<TwoFactorStatusResponse>('/v2/users/me/2fa/status');
  }

  /**
   * Generate Google Authenticator secret & QR code.
   * POST /v2/users/me/2fa/authenticator/setup
   */
  public async setupAuthenticator(): Promise<{ secret: string; qrCodeUrl: string }> {
    return this.http.post('/v2/users/me/2fa/authenticator/setup', {});
  }

  /**
   * Enable Google Authenticator with 6-digit code.
   * POST /v2/users/me/2fa/authenticator/enable
   */
  public async enableAuthenticator(code: string): Promise<any> {
    const res = await this.http.post<any>('/v2/users/me/2fa/authenticator/enable', { code });
    this.events.emit('2fa:enabled', { method: 'authenticator', recoveryCodes: res?.recoveryCodes });
    return res;
  }

  /**
   * Send 2FA confirmation code to registered email.
   * POST /v2/users/me/2fa/email/send-code
   */
  public async sendEmail2FaCode(): Promise<any> {
    return this.http.post('/v2/users/me/2fa/email/send-code', {});
  }

  /**
   * Enable Email 2FA with received code.
   * POST /v2/users/me/2fa/email/enable
   */
  public async enableEmail2Fa(code: string): Promise<any> {
    const res = await this.http.post<any>('/v2/users/me/2fa/email/enable', { code });
    this.events.emit('2fa:enabled', { method: 'email' });
    return res;
  }

  /**
   * Send 2FA confirmation code to user's Discord DM.
   * POST /v2/users/me/2fa/discord/send-code
   */
  public async sendDiscord2FaCode(): Promise<any> {
    return this.http.post('/v2/users/me/2fa/discord/send-code', {});
  }

  /**
   * Enable Discord 2FA with received code.
   * POST /v2/users/me/2fa/discord/enable
   */
  public async enableDiscord2Fa(code: string): Promise<any> {
    const res = await this.http.post<any>('/v2/users/me/2fa/discord/enable', { code });
    this.events.emit('2fa:enabled', { method: 'discord' });
    return res;
  }

  /**
   * Disable 2FA.
   * Accepts optional password and specific method to disable.
   * POST /v2/users/me/2fa/disable
   */
  public async disable2Fa(data: DisableTwoFactorDto = {}): Promise<any> {
    const res = await this.http.post('/v2/users/me/2fa/disable', data);
    this.events.emit('2fa:disabled', { method: data.method });
    return res;
  }

  /**
   * Set primary 2FA method.
   * PUT /v2/users/me/2fa/primary-method
   */
  public async setPrimary2FaMethod(method: 'authenticator' | 'email' | 'discord'): Promise<any> {
    return this.http.put('/v2/users/me/2fa/primary-method', { method });
  }

  /**
   * Regenerate 2FA backup recovery codes.
   * POST /v2/users/me/2fa/recovery-codes/regenerate
   */
  public async regenerateRecoveryCodes(): Promise<{ recoveryCodes: string[] }> {
    return this.http.post('/v2/users/me/2fa/recovery-codes/regenerate', {});
  }

  // ===================== Discord Account Link =====================

  /**
   * Get user's linked Discord status.
   * GET /v2/users/me/discord/status
   */
  public async getDiscordStatus(): Promise<DiscordStatusData> {
    const res = await this.http.get<DiscordStatusResponse>('/v2/users/me/discord/status');
    return res.data;
  }

  /**
   * Unlink Discord account.
   * POST /v2/users/me/discord/unlink
   */
  public async unlinkDiscord(): Promise<any> {
    const res = await this.http.post('/v2/users/me/discord/unlink', {});
    this.events.emit('discord:unlinked');
    return res;
  }
}
