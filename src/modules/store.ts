import { HttpClient } from '../core/http';
import { EventEmitter } from '../core/events';
import { Category, MarketplaceConfig, Product } from '../types';

export class StoreModule {
  constructor(
    private http: HttpClient,
    private events: EventEmitter
  ) {}

  /**
   * List all categories.
   * GET /categories
   */
  public async getCategories(): Promise<Category[]> {
    return this.http.get<Category[]>('/categories');
  }

  /**
   * Get single category by ID.
   * GET /categories/:categoryId
   */
  public async getCategory(categoryId: string): Promise<Category> {
    return this.http.get<Category>(`/categories/${categoryId}`);
  }

  /**
   * List products. With no filter the full catalog is returned.
   * Groups combine; several values in one group match any of them.
   * GET /products
   */
  public async getProducts(filter?: {
    type?: string | string[];
    server?: string | string[];
    category?: string | string[];
    tag?: string | string[];
    q?: string;
    priceMin?: number;
    priceMax?: number;
    available?: boolean;
  }): Promise<Product[]> {
    const params = filter
      ? {
          type: this.joinFilter(filter.type),
          server: this.joinFilter(filter.server),
          category: this.joinFilter(filter.category),
          tag: this.joinFilter(filter.tag),
          q: filter.q || undefined,
          priceMin: filter.priceMin,
          priceMax: filter.priceMax,
          available: filter.available,
        }
      : undefined;
    return this.http.get<Product[]>('/products', params ? { params } : undefined);
  }

  /**
   * Filter groups for a storefront sidebar: price range, category, stock, type, tag and server.
   * GET /products/filters
   */
  public async getFilters(): Promise<{ filters: Array<{ id: string; label: string; type: string; min?: number; max?: number; values?: Array<{ id: string; label: string; count: number }> }> }> {
    return this.http.get('/products/filters');
  }

  private joinFilter(value?: string | string[]): string | undefined {
    if (value == null || value === '') return undefined;
    const joined = (Array.isArray(value) ? value : [value]).filter(Boolean).join(',');
    return joined || undefined;
  }

  /**
   * Get product details by product ID.
   * GET /products/:productId
   */
  public async getProduct(productId: string): Promise<Product> {
    return this.http.get<Product>(`/products/${productId}`);
  }

  /**
   * Get products by category ID.
   * GET /products/by-category/:categoryId
   */
  public async getProductsByCategory(categoryId: string): Promise<Product[]> {
    return this.http.get<Product[]>(`/products/by-category/${categoryId}`);
  }

  /**
   * Get store marketplace settings including bulk discount promotions.
   * GET /config/marketplace
   */
  public async getConfig(): Promise<MarketplaceConfig> {
    return this.http.get<MarketplaceConfig>('/config/marketplace');
  }
}
