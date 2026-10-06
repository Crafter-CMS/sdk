import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';

export interface LicenseRecord {
  id: string;
  productId: string;
  productName: string | null;
  key: string;
  type: 'in_game' | 'digital' | 'downloadable';
  code: string | null;
  hasDownload: boolean;
  status: string;
  createdAt: string;
}

export interface LicenseVerification {
  valid: boolean;
  productId?: string;
  type?: string;
  downloadable?: boolean;
}

export class LicensesModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Licenses owned by the signed-in user, including digital codes.
   * GET /marketplace/licenses
   */
  public async list(): Promise<LicenseRecord[]> {
    return this.http.get<LicenseRecord[]>('/marketplace/licenses');
  }

  /**
   * Check a license key. The response does not include a digital code or a download URL.
   * GET /marketplace/licenses/verify
   */
  public async verify(key: string): Promise<LicenseVerification> {
    const response = await this.http.get<LicenseVerification>('/marketplace/licenses/verify', {
      params: { key },
      skipAuth: true,
    });
    this.events.emit('license:verified', response);
    return response;
  }

  /**
   * Short-lived download URL for a license owned by the signed-in user.
   * GET /marketplace/licenses/:licenseId/download
   */
  public async download(licenseId: string): Promise<{ url: string; expiresIn: number }> {
    return this.http.get(`/marketplace/licenses/${licenseId}/download`);
  }
}
