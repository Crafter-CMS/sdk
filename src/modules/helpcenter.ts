import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import {
  HelpArticleItem,
  HelpcenterCategoryDetailResponse,
  HelpcenterOverviewResponse,
} from '../types';

export class HelpcenterModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * Get help center overview containing categories, featured items and FAQs.
   * GET /helpcenter
   */
  public async getOverview(query?: { search?: string; faqOnly?: boolean; page?: number; limit?: number }): Promise<HelpcenterOverviewResponse> {
    return this.http.get<HelpcenterOverviewResponse>('/helpcenter', {
      params: query as Record<string, string | number | boolean | undefined>,
    });
  }

  /**
   * Alias for getOverview.
   */
  public async getCategories(query?: { search?: string; faqOnly?: boolean; page?: number; limit?: number }): Promise<HelpcenterOverviewResponse> {
    return this.getOverview(query);
  }

  /**
   * Get single help category with its articles.
   * GET /helpcenter/category/:categoryId
   */
  public async getCategory(categoryId: string): Promise<HelpcenterCategoryDetailResponse> {
    return this.http.get<HelpcenterCategoryDetailResponse>(`/helpcenter/category/${categoryId}`);
  }

  /**
   * Get single article details.
   * GET /helpcenter/item/:itemId
   */
  public async getArticle(itemId: string): Promise<HelpArticleItem> {
    return this.http.get<HelpArticleItem>(`/helpcenter/item/${itemId}`);
  }
}
