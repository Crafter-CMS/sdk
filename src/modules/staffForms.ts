import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { StaffFormItem } from '../types';

export class StaffFormsModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * List open staff application forms.
   * GET /staff-forms
   */
  public async list(): Promise<StaffFormItem[]> {
    return this.http.get<StaffFormItem[]>('/staff-forms');
  }

  /**
   * Get application form details and fields by ID.
   * GET /staff-forms/:formId
   */
  public async get(formId: string): Promise<StaffFormItem> {
    return this.http.get<StaffFormItem>(`/staff-forms/${formId}`);
  }


  /**
   * Submit an application for a staff form.
   * Accepts either an array of { inputId, value } or an object of { [inputId]: value }.
   * POST /staff-forms/:formId/apply
   */
  public async apply(
    formId: string,
    answers: Record<string, any> | Array<{ inputId: string; value: any }>
  ): Promise<any> {
    const values = Array.isArray(answers)
      ? answers.map((item) => ({ inputId: item.inputId, value: String(item.value) }))
      : Object.entries(answers).map(([inputId, value]) => ({
          inputId,
          value: value !== undefined && value !== null ? String(value) : '',
        }));

    const response = await this.http.post<any>(`/staff-forms/${formId}/apply`, { values });
    this.events.emit('form:submitted', { formId, response });
    return response;
  }
}
