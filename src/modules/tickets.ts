import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { CreateTicketDto, ReplyTicketDto, Ticket, TicketCategory } from '../types';
import { toLexical } from '../utils/lexical';

export class TicketsModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * List all tickets for current user.
   * GET /v2/tickets
   */
  public async list(): Promise<Ticket[]> {
    return this.http.get<Ticket[]>('/v2/tickets');
  }

  /**
   * Alias for list.
   */
  public async getTickets(): Promise<Ticket[]> {
    return this.list();
  }

  /**
   * List ticket categories.
   * GET /v2/tickets/categories
   */
  public async getCategories(): Promise<TicketCategory[]> {
    return this.http.get<TicketCategory[]>('/v2/tickets/categories');
  }

  /**
   * Get single ticket by ID.
   * GET /v2/tickets/:ticketId
   */
  public async get(ticketId: string): Promise<Ticket> {
    return this.http.get<Ticket>(`/v2/tickets/${ticketId}`);
  }

  /**
   * Create a new support ticket.
   * Plain text message is automatically transformed to valid Lexical rich-text JSON format.
   * POST /v2/tickets
   */
  public async create(data: CreateTicketDto): Promise<Ticket> {
    const payload = {
      ...data,
      message: toLexical(data.message),
    };
    const ticket = await this.http.post<Ticket>('/v2/tickets', payload);
    this.events.emit('ticket:created', ticket);
    return ticket;
  }

  /**
   * Reply to a ticket.
   * Plain text message is automatically transformed to valid Lexical rich-text JSON format.
   * POST /v2/tickets/:ticketId/reply
   */
  public async reply(ticketId: string, replyData: ReplyTicketDto | string): Promise<Ticket> {
    const rawMessage = typeof replyData === 'string' ? replyData : replyData.message;
    const payload = { message: toLexical(rawMessage) };
    const response = await this.http.post<Ticket>(`/v2/tickets/${ticketId}/reply`, payload);
    this.events.emit('ticket:replied', { ticketId, response });
    return response;
  }

  /**
   * Close a ticket with optional resolution reason.
   * POST /v2/tickets/:ticketId/close
   */
  public async close(ticketId: string, reason?: string): Promise<Ticket> {
    const response = await this.http.post<Ticket>(`/v2/tickets/${ticketId}/close`, { reason });
    this.events.emit('ticket:closed', { ticketId, reason, response });
    return response;
  }

  /**
   * Reopen a closed ticket.
   * POST /v2/tickets/:ticketId/open
   */
  public async open(ticketId: string): Promise<Ticket> {
    const response = await this.http.post<Ticket>(`/v2/tickets/${ticketId}/open`, {});
    this.events.emit('ticket:opened', { ticketId, response });
    return response;
  }

  /**
   * Alias for open.
   */
  public async reopen(ticketId: string): Promise<Ticket> {
    return this.open(ticketId);
  }
}
