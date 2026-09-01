import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { CrafterError } from '../core/errors';
import {
  AuthResponse,
  InGameAuthDto,
  ResetPasswordDto,
  SignInDto,
  SignUpDto,
  TwoFactorValidateDto,
} from '../types';

export class AuthModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Sign in user with username and password.
   * POST /v2/auth/signin
   */
  public async signin(data: SignInDto): Promise<AuthResponse> {
    const payload: SignInDto = {
      username: data.username,
      password: data.password,
      turnstileToken: data.turnstileToken,
    };

    const response = await this.http.post<AuthResponse>('/v2/auth/signin', payload);

    const token = 'accessToken' in response ? response.accessToken : (response as any).token;
    if (token) {
      this.http.setToken(token);
    }

    this.events.emit('auth:login', {
      token: token || undefined,
    });

    return response;
  }

  /**
   * Alias for signin.
   */
  public login(data: SignInDto): Promise<AuthResponse> {
    return this.signin(data);
  }

  /**
   * Register a new user.
   * POST /v2/auth/signup
   */
  public async signup(data: SignUpDto | (Omit<SignUpDto, 'confirm_password'> & { confirmPassword: string })): Promise<AuthResponse> {
    const payload: SignUpDto = {
      username: data.username,
      email: data.email,
      password: data.password,
      confirm_password: (data as any).confirm_password || (data as any).confirmPassword || '',
      turnstileToken: data.turnstileToken,
    };
    return this.http.post<AuthResponse>('/v2/auth/signup', payload);
  }

  /**
   * Alias for signup.
   */
  public register(data: SignUpDto | (Omit<SignUpDto, 'confirm_password'> & { confirmPassword: string })): Promise<AuthResponse> {
    return this.signup(data);
  }

  /**
   * Fast authentication for in-game players clicking web links (e.g. /web command in Minecraft).
   * If parameters are omitted, automatically extracts username, uuid, server_id, and hash from URL query params.
   * POST /v2/auth/ingame
   */
  public async inGameAuth(data?: Partial<InGameAuthDto>): Promise<AuthResponse> {
    let username = data?.username;
    let uuid = data?.uuid;
    let server_id = data?.server_id;
    let hash = data?.hash;

    // Auto-resolve from URL query string if in browser and parameters missing
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      username = username || params.get('username') || undefined;
      uuid = uuid || params.get('uuid') || undefined;
      server_id = server_id || params.get('server_id') || params.get('serverId') || undefined;
      hash = hash || params.get('hash') || undefined;
    }

    if (!username || !uuid || !server_id || !hash) {
      throw new CrafterError({
        message: 'In-game authentication requires username, uuid, server_id, and hash. Ensure they are provided or present in URL query parameters.',
        statusCode: 400,
      });
    }

    const payload: InGameAuthDto = { username, uuid, server_id, hash };
    const response = await this.http.post<AuthResponse>('/v2/auth/ingame', payload);

    const token = 'accessToken' in response ? response.accessToken : (response as any).token;
    if (token) {
      this.http.setToken(token);
    }

    this.events.emit('auth:login', {
      token: token || undefined,
    });

    return response;
  }

  /**
   * Refresh access token using refresh token.
   * POST /v2/auth/refresh-token
   */
  public async refreshToken(refreshToken: string): Promise<AuthResponse> {
    const response = await this.http.post<AuthResponse>('/v2/auth/refresh-token', { refreshToken });
    const token = 'accessToken' in response ? response.accessToken : (response as any).token;
    if (token) {
      this.http.setToken(token);
      this.events.emit('auth:token_refreshed', { token });
    }
    return response;
  }

  /**
   * Alias for refreshToken.
   */
  public refresh(refreshToken: string): Promise<AuthResponse> {
    return this.refreshToken(refreshToken);
  }

  /**
   * Request password reset email.
   * POST /v2/auth/forgot-password
   */
  public async forgotPassword(email: string, turnstileToken?: string): Promise<{ success: boolean; message: string }> {
    return this.http.post('/v2/auth/forgot-password', { email, turnstileToken });
  }

  /**
   * Get password reset token from current URL query parameters (?token=...).
   * Returns null in SSR/Node environments or if token query param is missing.
   */
  public getResetTokenFromUrl(): string | null {
    if (typeof window !== 'undefined' && window.location) {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('token') || null;
    }
    return null;
  }

  /**
   * Reset password with reset token.
   * If data.token is omitted, it automatically attempts to read ?token= from the URL (window.location.search).
   * POST /v2/auth/reset-password
   */
  public async resetPassword(
    data: ResetPasswordDto | { token?: string; newPassword?: string; new_password?: string; confirmPassword?: string; confirm_password?: string; turnstileToken?: string }
  ): Promise<{ success: boolean; message: string }> {
    const token = data.token || this.getResetTokenFromUrl();

    if (!token) {
      throw new CrafterError({
        message: 'Password reset token is required. Please provide it in data.token or ensure ?token= is in the URL query string.',
        statusCode: 400,
      });
    }

    const payload = {
      token,
      new_password: (data as any).new_password || (data as any).newPassword || '',
      confirm_password: (data as any).confirm_password || (data as any).confirmPassword || '',
      turnstileToken: data.turnstileToken,
    };
    return this.http.post('/v2/auth/reset-password', payload);
  }

  /**
   * Verify email OTP code during login or signup.
   * POST /v2/auth/verify-email
   */
  public async verifyEmail(data: { tempToken: string; code: string } | string): Promise<any> {
    const payload = typeof data === 'string' ? { token: data } : data;
    return this.http.post('/v2/auth/verify-email', payload);
  }

  /**
   * Resend verification email code during login or registration.
   * POST /v2/auth/resend-email
   */
  public async resendEmail(tempToken: string): Promise<any> {
    return this.http.post('/v2/auth/resend-email', { tempToken });
  }

  /**
   * Alias for resendEmail.
   */
  public async resendVerification(tempToken: string): Promise<any> {
    return this.resendEmail(tempToken);
  }

  // ===================== Login 2FA & OTP Methods =====================

  /**
   * Validate 2FA code during sign in.
   * POST /v2/auth/2fa/verify
   */
  public async validate2Fa(data: TwoFactorValidateDto): Promise<AuthResponse> {
    const response = await this.http.post<AuthResponse>('/v2/auth/2fa/verify', data);
    const token = 'accessToken' in response ? response.accessToken : (response as any).token;
    if (token) {
      this.http.setToken(token);
    }
    return response;
  }

  /**
   * Send 2FA verification code to email during login.
   * POST /v2/auth/2fa/send-email-code
   */
  public async send2FaEmailCode(tempToken: string): Promise<any> {
    return this.http.post('/v2/auth/2fa/send-email-code', { tempToken });
  }

  /**
   * Send 2FA verification code/push to Discord DM during login.
   * POST /v2/auth/2fa/send-discord-code
   */
  public async send2FaDiscordCode(tempToken: string): Promise<any> {
    return this.http.post('/v2/auth/2fa/send-discord-code', { tempToken });
  }

  /**
   * Update temporary @temp.com email and send verification code (for players registered in-game).
   * POST /v2/auth/update-temp-email
   */
  public async updateTempEmail(tempToken: string, email: string): Promise<any> {
    return this.http.post('/v2/auth/update-temp-email', { tempToken, email });
  }

  // ===================== Discord OAuth =====================

  /**
   * Get Discord OAuth redirect URL for login or account connect.
   * GET /v2/auth/discord?action=login|connect&redirectUri=...
   */
  public getDiscordAuthUrl(action: 'login' | 'connect' = 'login', redirectUri?: string): string {
    const params: Record<string, string | undefined> = { action, redirectUri };
    return this.http.buildUrl('/v2/auth/discord', { params });
  }

  /**
   * Sign out user and clear session token.
   * In storefront mode, notifies proxy to delete HttpOnly cookies.
   */
  public async logout(): Promise<void> {
    if (this.http.mode === 'storefront') {
      try {
        await this.http.post('/v2/auth/logout', {});
      } catch {
        // Proxy intercepts and deletes cookies regardless
      }
    }
    this.http.clearToken();
    this.events.emit('auth:logout');
  }

  public isAuthenticated(): boolean {
    return !!this.http.getToken();
  }

  public getToken(): string | null {
    return this.http.getToken();
  }

  public setToken(token: string | null): void {
    this.http.setToken(token);
  }
}
