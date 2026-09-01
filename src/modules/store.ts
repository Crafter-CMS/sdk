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
   * List all products.
   * GET /products
   */
  public async getProducts(): Promise<Product[]> {
    return this.http.get<Product[]>('/products');
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
