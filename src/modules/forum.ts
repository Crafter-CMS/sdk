import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { ForumCategory, ForumTopic } from '../types';
import { toLexical } from '../utils/lexical';

export class ForumModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Get all forum categories.
   * GET /forum/categories
   */
  public async getCategories(): Promise<ForumCategory[]> {
    return this.http.get<ForumCategory[]>('/forum/categories');
  }

  /**
   * Get topics under a category.
   * GET /forum/category/:categoryId/topics
   */
  public async getTopics(categoryId: string): Promise<ForumTopic[]> {
    return this.http.get<ForumTopic[]>(`/forum/category/${categoryId}/topics`);
  }

  /**
   * Get topic details and messages.
   * GET /forum/topic/:topicId
   */
  public async getTopic(topicId: string): Promise<ForumTopic> {
    return this.http.get<ForumTopic>(`/forum/topic/${topicId}`);
  }

  /**
   * Create a new topic in a category.
   * Plain text content is automatically transformed to valid Lexical rich-text JSON format.
   * POST /forum/category/:categoryId/topic
   */
  public async createTopic(
    categoryId: string,
    data: { title: string; content: string | Record<string, any> }
  ): Promise<ForumTopic> {
    const payload = {
      title: data.title,
      content: toLexical(data.content),
    };
    const topic = await this.http.post<ForumTopic>(`/forum/category/${categoryId}/topic`, payload);
    this.events.emit('forum:topic_created', topic);
    return topic;
  }

  /**
   * Post a message in a topic.
   * Plain text content is automatically transformed to valid Lexical rich-text JSON format.
   * POST /forum/topic/:topicId/message
   */
  public async addMessage(topicId: string, content: string | Record<string, any>): Promise<any> {
    const res = await this.http.post(`/forum/topic/${topicId}/message`, { content: toLexical(content) });
    this.events.emit('forum:message_added', { topicId, message: res });
    return res;
  }

  /**
   * Reply / quote a forum message.
   * Plain text content is automatically transformed to valid Lexical rich-text JSON format.
   * POST /forum/message/:messageId/reply
   */
  public async replyMessage(messageId: string, content: string | Record<string, any>): Promise<any> {
    const res = await this.http.post(`/forum/message/${messageId}/reply`, { content: toLexical(content) });
    this.events.emit('forum:reply_added', { messageId, reply: res });
    return res;
  }

  /**
   * Like / toggle like for a topic.
   * POST /forum/topic/:topicId/like
   */
  public async likeTopic(topicId: string): Promise<any> {
    const res = await this.http.post<any>(`/forum/topic/${topicId}/like`, {});
    this.events.emit('forum:topic_liked', { topicId, likeCount: res?.likeCount ?? res?.data?.likeCount });
    return res;
  }

  /**
   * Unlike a topic.
   * DELETE /forum/topic/:topicId/like
   */
  public async unlikeTopic(topicId: string): Promise<any> {
    const res = await this.http.delete<any>(`/forum/topic/${topicId}/like`);
    this.events.emit('forum:topic_unliked', { topicId, likeCount: res?.likeCount ?? res?.data?.likeCount });
    return res;
  }

  /**
   * Get forum statistics (latest topics/replies).
   * GET /forum/statistics
   */
  public async getStatistics(): Promise<any> {
    return this.http.get<any>('/forum/statistics');
  }
}
