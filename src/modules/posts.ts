import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { LikePostResponse, PaginatedPostsResponse, PostItem, PostQueryDto } from '../types';

export class PostsModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * List posts with optional filters and pagination.
   * GET /v2/posts
   */
  public async list(query?: PostQueryDto): Promise<PaginatedPostsResponse> {
    return this.http.get<PaginatedPostsResponse>('/v2/posts', {
      params: query as Record<string, string | number | boolean | undefined>,
    });
  }

  /**
   * Get post by slug or ID.
   * GET /v2/posts/:idOrSlug
   */
  public async getBySlug(slug: string): Promise<PostItem> {
    return this.get(slug);
  }

  /**
   * Get post by ID or slug.
   * GET /v2/posts/:idOrSlug
   */
  public async get(idOrSlug: string): Promise<PostItem> {
    const response = await this.http.get<{ success: boolean; data: PostItem }>(`/v2/posts/${idOrSlug}`);
    return response.data || (response as any);
  }

  /**
   * Like / toggle like for a post.
   * POST /v2/posts/:id/like
   */
  public async like(id: string): Promise<LikePostResponse> {
    const response = await this.http.post<LikePostResponse>(`/v2/posts/${id}/like`, {});
    this.events.emit('post:liked', response);
    return response;
  }

  /**
   * Get posts liked by a user (e.g. for user profile favorites tab).
   * GET /v2/posts/user/:userId/liked
   */
  public async getUserLiked(userId: string = 'me', page: number = 1, limit: number = 10): Promise<PaginatedPostsResponse> {
    return this.http.get<PaginatedPostsResponse>(`/v2/posts/user/${userId}/liked`, {
      params: { page, limit },
    });
  }
}
