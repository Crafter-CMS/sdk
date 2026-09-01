import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { LegalDocuments } from '../types';

export class LegalModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Get legal documents (terms of service, privacy policy, rules, refund policy etc.).
   * GET /config/legal
   */
  public async getDocuments(): Promise<LegalDocuments> {
    return this.http.get<LegalDocuments>('/config/legal');
  }
}
