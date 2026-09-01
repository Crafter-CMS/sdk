import { CrafterConfig, RequestOptions } from '../types';
import { CrafterError } from './errors';

export class HttpClient {
  public readonly mode: 'storefront' | 'direct';
  private config: CrafterConfig;
  private token: string | null = null;
  private storageKey: string;

  constructor(config: CrafterConfig = {}) {
    // Determine operating mode:
    // If explicitly configured, use it. Otherwise, if websiteId is provided, default to 'direct', else 'storefront'.
    this.mode = config.mode || (config.websiteId ? 'direct' : 'storefront');

    const defaultApiBase = this.mode === 'direct' ? 'https://api.crafter.net.tr' : '/api/storefront';

    this.config = {
      apiBase: defaultApiBase,
      storageKey: 'crafter_token',
      ...config,
    };

    this.storageKey = this.config.storageKey || 'crafter_token';

    // Initialize token from config or browser storage
    if (this.config.token) {
      this.token = this.config.token;
    } else {
      this.token = this.readTokenFromStorage();
    }
  }

  /**
   * Safe getter for stored token from localStorage
   */
  private readTokenFromStorage(): string | null {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        return window.localStorage.getItem(this.storageKey);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Get current auth token
   */
  public getToken(): string | null {
    return this.token;
  }

  /**
   * Set or clear auth token
   */
  public setToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        if (token) {
          window.localStorage.setItem(this.storageKey, token);
        } else {
          window.localStorage.removeItem(this.storageKey);
        }
      } catch {
        // Ignore storage write errors (e.g. private browsing quota exceeded)
      }
    }

    if (this.config.onTokenChange) {
      this.config.onTokenChange(token);
    }
  }

  /**
   * Clear active auth token
   */
  public clearToken(): void {
    this.setToken(null);
  }

  /**
   * Resolves the full URL for an endpoint according to SDK operating mode:
   * 
   * Mode 1: 'storefront' (Liquid themes)
   * - Prepends '/api/storefront':
   *   /v2/auth/signin      -> /api/storefront/v2/auth/signin
   *   /products            -> /api/storefront/products
   * 
   * Mode 2: 'direct' (Headless apps, external scripts, Node)
   * - Prepends 'https://api.crafter.net.tr/website/{v2/}:websiteId/...':
   *   /v2/auth/signin      -> https://api.crafter.net.tr/website/v2/:websiteId/auth/signin
   *   /products            -> https://api.crafter.net.tr/website/:websiteId/products
   *   /payment/initiate    -> https://api.crafter.net.tr/website/payment/initiate
   */
  public buildUrl(path: string, options?: RequestOptions): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return this.appendParams(path, options?.params);
    }

    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    let fullUrl: string;

    if (this.mode === 'direct') {
      const apiBase = (this.config.apiBase || 'https://api.crafter.net.tr').replace(/\/+$/, '');
      const websiteId = this.config.websiteId;

      if (!websiteId && !cleanPath.startsWith('/payment/')) {
        console.warn(
          `[Crafter SDK] websiteId is required in 'direct' mode for endpoint "${cleanPath}". Pass websiteId in Crafter config.`
        );
      }

      if (cleanPath.startsWith('/v2/')) {
        const subPath = cleanPath.substring(4); // Remove '/v2/'
        fullUrl = `${apiBase}/website/v2/${websiteId}/${subPath}`;
      } else if (cleanPath.startsWith('/payment/')) {
        const subPath = cleanPath.substring(9); // Remove '/payment/'
        fullUrl = `${apiBase}/website/payment/${subPath}`;
      } else {
        const subPath = cleanPath.replace(/^\/+/, '');
        fullUrl = subPath ? `${apiBase}/website/${websiteId}/${subPath}` : `${apiBase}/website/${websiteId}`;
      }
    } else {
      // Storefront mode (Liquid theme same-origin proxy)
      const apiBase = (this.config.apiBase || '/api/storefront').replace(/\/+$/, '');
      fullUrl = cleanPath ? `${apiBase}${cleanPath}` : apiBase;
    }

    return this.appendParams(fullUrl, options?.params);
  }

  private appendParams(url: string, params?: Record<string, string | number | boolean | undefined>): string {
    if (!params) return url;

    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        searchParams.append(key, String(val));
      }
    }

    const queryString = searchParams.toString();
    if (!queryString) return url;

    return url + (url.includes('?') ? '&' : '?') + queryString;
  }

  /**
   * Core request dispatcher with automatic credentials (cookies) & token header
   */
  public async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(endpoint, options);

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(this.config.headers || {}),
      ...(options.headers as Record<string, string> || {}),
    };

    if (!options.skipAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        credentials: options.credentials || (this.mode === 'storefront' ? 'same-origin' : 'include'),
        ...options,
        headers,
      });

      const contentType = response.headers.get('content-type') || '';
      let data: any = null;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      if (!response.ok) {
        throw CrafterError.fromResponse(response.status, data);
      }

      return data as T;
    } catch (error: any) {
      if (error instanceof CrafterError) {
        throw error;
      }

      throw new CrafterError({
        message: error?.message || 'Network request failed',
        statusCode: 0,
        details: error,
      });
    }
  }

  public get<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public put<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T = any>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}
