import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { CreateReportDto, ReportResponse } from '../types';

export class ReportsModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Report a user to staff.
   * POST /reports/:reportedUserId
   */
  public async create(reportedUserId: string, data: CreateReportDto): Promise<ReportResponse> {
    const response = await this.http.post<ReportResponse>(`/reports/${reportedUserId}`, data);
    this.events.emit('report:created', response);
    return response;
  }
}
