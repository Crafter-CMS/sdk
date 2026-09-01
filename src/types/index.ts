export interface CrafterConfig {
  /**
   * Operating mode:
   * - 'storefront' (default in Liquid themes): Requests go through same-origin '/api/storefront' proxy.
   * - 'direct' (headless apps, mobile, external scripts): Requests go directly to 'https://api.crafter.net.tr/website/{v2/}...'.
   * Auto-detected: defaults to 'direct' if websiteId is provided; otherwise defaults to 'storefront'.
   */
  mode?: 'storefront' | 'direct';

  /**
   * Base API URL / path prefix.
   * In 'storefront' mode, defaults to '/api/storefront'.
   * In 'direct' mode, defaults to 'https://api.crafter.net.tr'.
   */
  apiBase?: string;

  /**
   * Website ID (Tenant ID).
   * Required in 'direct' mode.
   * Optional in Liquid themes (Storefront proxy auto-resolves tenant by hostname).
   */
  websiteId?: string;

  /**
   * Optional initial authentication token (JWT).
   */
  token?: string;

  /**
   * Key used to store/retrieve token in localStorage if client-side storage is used.
   * Defaults to 'crafter_token'
   */
  storageKey?: string;

  /**
   * Custom headers to include in every request.
   */
  headers?: Record<string, string>;

  /**
   * Callback fired when token is updated or cleared.
   */
  onTokenChange?: (token: string | null) => void;
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
}

export interface CrafterApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
  details?: Record<string, any>;
}

// ===================== 1. Auth Types =====================

export interface SignInDto {
  username: string;
  password: string;
  turnstileToken?: string;
}

export interface SignUpDto {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
  turnstileToken?: string;
}

export interface AuthSuccessResponse {
  success: true;
  accessToken: string;
  refreshToken: string;
}

export interface Auth2FaRequiredResponse {
  requires2FA: true;
  methods: Array<'authenticator' | 'email' | 'discord'>;
  primaryMethod: 'authenticator' | 'email' | 'discord' | string;
  tempToken: string;
  message: string;
}

export interface AuthEmailVerificationRequiredResponse {
  requiresEmailVerification: true;
  isTempEmail: boolean;
  tempToken: string;
  maskedEmail?: string;
  emailToken?: string;
  message: string;
}

export type AuthResponse =
  | AuthSuccessResponse
  | Auth2FaRequiredResponse
  | AuthEmailVerificationRequiredResponse
  | {
      success?: boolean;
      accessToken?: string;
      refreshToken?: string;
      token?: string;
      message?: string;
      [key: string]: any;
    };

export interface TwoFactorValidateDto {
  tempToken: string;
  code: string;
  method?: 'authenticator' | 'email' | 'discord' | 'recovery_code';
}

export interface DisableTwoFactorDto {
  password?: string;
  method?: 'authenticator' | 'email' | 'discord';
}

export interface ResetPasswordDto {
  /**
   * Reset token from email.
   * Optional: If omitted in browser environments, it will be automatically extracted from the URL query param (?token=...).
   */
  token?: string;
  new_password: string;
  confirm_password: string;
  turnstileToken?: string;
}

export interface InGameAuthDto {
  username: string;
  uuid: string;
  server_id: string;
  hash: string;
}

// ===================== 2. User & Profile Types =====================

export interface UserRole {
  id: string;
  name: string;
  color?: string;
  permissions?: string[];
}

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  balance?: number;
  credit?: number;
  avatar?: string;
  isOnline?: boolean;
  playTime?: number;
  averagePlayTime?: number;
  role?: UserRole | string;
  discordId?: string;
  discordUsername?: string;
  twoFactorEnabled?: boolean;
  likes?: string[];
  comments?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface LightweightBalanceResponse {
  success: boolean;
  data: {
    userId: string;
    username: string;
    balance: number;
    currency?: string;
  };
}

export interface UpdateOwnUserDto {
  email: string;
}

export interface SendBalanceParams {
  targetUserId: string;
  amount: number;
  userId?: string;
}

export interface SendBalanceResponse {
  success: boolean;
  message: string;
  transfer?: {
    from: {
      userId: string;
      email?: string;
      oldBalance: number;
      newBalance: number;
    };
    to: {
      userId: string;
      email?: string;
      oldBalance: number;
      newBalance: number;
    };
    amount: number;
  };
  [key: string]: any;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface WallMessageReply {
  id: string;
  sender: { id: string; username: string; avatar?: string };
  content: string;
  createdAt: string;
}

export interface WallMessage {
  id: string;
  sender: { id: string; username: string; avatar?: string };
  content: string;
  replies?: WallMessageReply[];
  createdAt: string;
}

export interface TwoFactorStatusResponse {
  enabled: boolean;
  methods: string[];
  primaryMethod: 'authenticator' | 'email' | 'discord' | string | null;
  hasRecoveryCodes: boolean;
  recoveryCodesCount: number;
  discordLinked: boolean;
  discordUsername?: string;
  isEmailVerified: boolean;
  [key: string]: any;
}

export interface DiscordStatusData {
  isModuleActive: boolean;
  isLinked: boolean;
  discordId?: string;
  discordUsername?: string;
}

export interface DiscordStatusResponse {
  success: boolean;
  data: DiscordStatusData;
}

// ===================== 3. Store, Products & Categories Types =====================

export interface Category {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  image?: string;
  order?: number;
  [key: string]: any;
}

export interface Product {
  id: string;
  name: string;
  slug?: string;
  price: number;
  discountPrice?: number;
  category: string;
  server_id: string;
  images: string[];
  stock: number;
  discountType?: 'percentage' | 'fixed' | null;
  discountValue?: number;
  server_commands?: string[];
  give_role_id?: string | null;
  description?: Record<string, any> | string;
  [key: string]: any;
}

// ===================== 4. Marketplace / Checkout Types =====================

export interface PurchaseDto {
  productIds: string[];
  coupon?: string;
  [key: string]: any;
}

export interface PurchaseResponse {
  success: boolean;
  message: string;
  type?: string;
  orderId?: string;
  [key: string]: any;
}

export interface BulkDiscountConfig {
  type: 'percentage' | 'fixed' | string;
  amount: number;
  expireDate?: string | null;
  products?: string[];
}

export interface MarketplaceConfig {
  bulkDiscount?: BulkDiscountConfig | null;
  [key: string]: any;
}

// ===================== 5. Chest Types =====================

export interface ChestProductSummary {
  id: string;
  name: string;
  server_id?: string;
  [key: string]: any;
}

export interface ChestItem {
  id: string;
  product?: ChestProductSummary;
  used: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface UseChestItemResponse {
  success: boolean;
  message: string;
  item: {
    id: string;
    used: boolean;
    updatedAt: string;
  };
}

export interface GiftChestItemResponse {
  success: boolean;
  message: string;
  newChestItem?: {
    id: string;
    product?: any;
    used: boolean;
  };
}

// ===================== 6. Coupons & Redeem Codes Types =====================

export interface CouponResponse {
  id?: string;
  code: string;
  type?: string;
  minCartValue?: number;
  productId?: string | null;
  discountValue: number;
  discountType: 'percentage' | 'fixed' | string;
  freeProductId?: string | null;
  isActive: boolean;
  [key: string]: any;
}

export interface UseRedeemCodeResponse {
  bonus?: number;
  products?: Array<{ id: string; name: string }>;
  success?: boolean;
  message?: string;
  [key: string]: any;
}

// ===================== 7. Ticket Types =====================

export interface TicketCategory {
  id: string;
  name: string;
  description?: string;
}

export type TicketCategoryDetails = TicketCategory;

export interface TicketMessageSender {
  id: string;
  username: string;
  email: string | null;
}

export interface TicketMessage {
  id?: string;
  senderId?: string;
  content: Record<string, any> | string;
  createdAt: string;
  sender?: TicketMessageSender;
  // Aliases for backwards compatibility
  authorId?: string;
  authorName?: string;
  message?: string;
}

export interface Ticket {
  id: string;
  title: string;
  category?: string;
  categoryDetails?: TicketCategoryDetails;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REOPENED' | string;
  createdByUserId: string;
  createdByUser?: { id: string; username: string };
  assignedUsers?: any[];
  messages?: TicketMessage[];
  createdAt: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface CreateTicketDto {
  title: string;
  categoryId: string;
  message: Record<string, any> | string;
  [key: string]: any;
}

export interface ReplyTicketDto {
  message: Record<string, any> | string;
}

// ===================== 8. Posts Types =====================

export interface PostQueryDto {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  categoryId?: string;
  sortBy?: string;
}

export interface PostAuthor {
  id: string;
  username: string;
  avatar?: string;
}

export interface PostItem {
  id: string;
  slug: string;
  title: string;
  content: Record<string, any> | string;
  featuredImage?: string;
  coverImage?: string;
  likeCount?: number;
  viewCount?: number;
  isPinned?: boolean;
  isHot?: boolean;
  author?: PostAuthor;
  createdAt: string;
  [key: string]: any;
}

export interface PaginatedPostsResponse {
  success: boolean;
  data: PostItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface SinglePostResponse {
  success: boolean;
  data: PostItem;
}

export interface LikePostResponse {
  success: boolean;
  data: {
    liked: boolean;
    likeCount: number;
  };
  message: string;
}

// ===================== 9. Pages Types =====================

export interface PageItem {
  id: string;
  title: string;
  slug: string;
  content: string;
  isPublished?: boolean;
  viewCount?: number;
  updatedAt?: string;
  [key: string]: any;
}

// ===================== 10. Servers Types =====================

export interface ServerStatusItem {
  id: string;
  name: string;
  ip: string;
  port: number;
  image?: string;
  isListed?: boolean;
  slug?: string;
  onlinePlayers?: number;
  maxPlayers?: number;
  isOnline?: boolean;
  ping?: number;
  [key: string]: any;
}

// ===================== 11. Payments Types =====================

export interface InitiatePaymentUser {
  name: string;
  email: string;
  phone?: string;
  address?: string;
}

export interface InitiatePaymentDto {
  amount: number;
  providerId: string;
  currency?: string;
  websiteId?: string;
  user: InitiatePaymentUser;
  [key: string]: any;
}

export interface InitiatePaymentResponse {
  token?: string;
  iframeUrl?: string;
  paymentId?: string;
  paymentUrl?: string;
  [key: string]: any;
}

export interface CheckPaymentResponse {
  success: boolean;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | string;
  paymentId: string;
  amount?: number;
  [key: string]: any;
}

export interface PublicPaymentProvider {
  id: string;
  provider: string;
  name: string;
  isActive: boolean;
  priority?: number;
  description?: string;
  minAmount: number;
  maxAmount: number;
  creditMultipler: number;
  addFeeToCustomer?: boolean;
  commissionRate?: number;
  feePercentage?: number;
  [key: string]: any;
}

// ===================== 12. Site Statistics Types =====================

export interface LatestPayment {
  id: string;
  username: string;
  amount: number;
  paymentMethod: string;
  timestamp: string;
}

export interface LatestPurchase {
  id: string;
  username: string;
  productName: string;
  serverName: string;
  amount: number;
  timestamp: string;
}

export interface LatestSignup {
  id: string;
  username: string;
  timestamp: string;
}

export interface TopCreditLoader {
  id: string;
  username: string;
  totalAmount: number;
}

export interface SiteStatistics {
  latest: {
    payments: LatestPayment[];
    purchases: LatestPurchase[];
    signups: LatestSignup[];
  };
  topCreditLoaders: TopCreditLoader[];
  totalUsers: number;
  [key: string]: any;
}

// ===================== 13. Punishments Types =====================

export interface PunishmentItem {
  id: number | string;
  name: string;
  reason: string;
  operator: string;
  punishmentType: 'ban' | 'mute' | 'kick' | 'warn' | string;
  start: number;
  end: number;
  active: boolean;
}

export interface PaginatedPunishmentsResponse {
  punishments: PunishmentItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ===================== 14. Vote Providers Types =====================

export interface VoteProviderItem {
  id: string;
  name: string;
  type?: string;
  url: string;
  cooldownHours: number;
  isActive: boolean;
  [key: string]: any;
}

export interface VoteProcessResponse {
  success: boolean;
  message: string;
  canVoteAt?: string;
}

// ===================== 15. Legal Documents Types =====================

export interface LegalDocuments {
  rules?: string;
  privacy_policy?: string;
  terms_of_service?: string;
  [key: string]: any;
}

// ===================== 16. Reports Types =====================

export type ReportType = 'spam' | 'harassment' | 'inappropriate_content' | 'fraud' | 'other';

export interface CreateReportDto {
  reportType: ReportType;
  reason: string;
}

export interface ReportResponse {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reportType: ReportType;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed' | string;
  reporter?: { id: string; username: string };
  reportedUser?: { id: string; username: string };
  createdAt: string;
  [key: string]: any;
}

// ===================== 17. Forum Types =====================

export interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  topics?: any[];
  subCategories?: any[];
  [key: string]: any;
}

export interface ForumMessageReply {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt?: string;
}

export interface ForumMessage {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  replies?: ForumMessageReply[];
  createdAt?: string;
}

export interface ForumTopic {
  id: string;
  title: string;
  slug: string;
  authorId: string;
  authorName: string;
  likeCount?: number;
  replyCount?: number;
  messages?: ForumMessage[];
  createdAt?: string;
  [key: string]: any;
}

export interface LikeTopicResponse {
  success: boolean;
  likeCount: number;
  message: string;
}

// ===================== 18. Help Center Types =====================

export interface HelpCategoryItem {
  id: string;
  name: string;
  description?: string;
  order?: number;
}

export interface HelpArticleItem {
  id: string;
  title: string;
  content?: string;
  categoryId: string;
  category?: { id: string; name: string };
  order?: number;
}

export interface HelpFaqItem {
  id: string;
  question: string;
  answer: string;
  order?: number;
}

export interface HelpcenterOverviewResponse {
  categories: HelpCategoryItem[];
  items: HelpArticleItem[];
  faqs: HelpFaqItem[];
}

export interface HelpcenterCategoryDetailResponse {
  id: string;
  name: string;
  items: HelpArticleItem[];
  itemCount: number;
}

// ===================== 19. Staff Forms Types =====================

export interface StaffFormInput {
  id: string;
  name: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox' | string;
  index: number;
  required?: boolean;
}

export interface StaffFormItem {
  id: string;
  title: string;
  description?: string;
  inputs: StaffFormInput[];
  isActive: boolean;
}

export interface StaffFormApplicationValue {
  inputId: string;
  value: string;
}

export interface StaffFormApplicationResponse {
  id: string;
  userId: string;
  values: StaffFormApplicationValue[];
  status: 'pending' | 'accepted' | 'rejected' | string;
  createdAt: string;
  updatedAt: string;
}

// ===================== 20. Global Search Types =====================

export interface SearchResultItem {
  id: string;
  name: string;
  type: 'user' | 'post' | 'ticket' | 'page' | 'product' | string;
  websiteId: string;
  subtitle: string;
  image: string | null;
}

// ===================== 21. SEO & Sitemap Types =====================

export interface WebsiteSeoConfig {
  metaTitleTemplate?: string;
  metaDescriptionTemplate?: string;
  defaultKeywords?: string[];
  ogImage?: string;
  favicon?: string;
  robotsTxt?: string;
  customHeadTags?: string;
  [key: string]: any;
}

export interface SitemapUrlItem {
  path: string;
  lastmod: string;
  changefreq: string;
  priority: number;
}

// ===================== 22. LuckPerms Types =====================

export interface LuckPermsPermissionNode {
  permission: string;
  value: number;
  server?: string;
  world?: string;
  expiry?: number;
  contexts?: string;
}

export interface LuckPermsPlayerData {
  uuid: string;
  username: string;
  primaryGroup: string;
  inheritedGroups: string[];
  permissions: LuckPermsPermissionNode[];
}

// ===================== 23. Website Info Types =====================

export interface WebsitePluginModule {
  isActive: boolean;
  config?: Record<string, any>;
  [key: string]: any;
}

export interface WebsiteInfo {
  id: string;
  name: string;
  domain?: string;
  currency: string;
  logo?: string;
  favicon?: string;
  pluginModules?: Record<string, WebsitePluginModule>;
  marketplace?: MarketplaceConfig;
  servers?: ServerStatusItem[];
  [key: string]: any;
}

// ===================== Reactive Event Maps =====================

export interface CrafterEventMap {
  // ================= Auth =================
  'auth:login': { token?: string; [key: string]: any };
  'auth:logout': void;
  'auth:token_refreshed': { token: string };

  // ================= User & Profile =================
  'user:updated': UserProfile;
  'balance:sent': SendBalanceResponse;
  'wall:message_added': { userId: string; message: WallMessage };
  'wall:reply_added': { userId: string; wallMessageId: string; reply: WallMessageReply };

  // ================= 2FA & Discord =================
  '2fa:enabled': { method: 'authenticator' | 'email' | 'discord'; recoveryCodes?: string[] };
  '2fa:disabled': { method?: string };
  'discord:linked': { discordId: string; discordUsername: string };
  'discord:unlinked': void;

  // ================= Store & Cart =================
  'cart:purchased': PurchaseResponse;

  // ================= Chest =================
  'chest:item_used': { itemId: string; response: UseChestItemResponse };
  'chest:item_gifted': { targetUserId: string; itemId: string; response: GiftChestItemResponse };

  // ================= Tickets =================
  'ticket:created': Ticket;
  'ticket:replied': { ticketId: string; response: Ticket };
  'ticket:closed': { ticketId: string; reason?: string; response: Ticket };
  'ticket:opened': { ticketId: string; response: Ticket };

  // ================= Forum =================
  'forum:topic_created': ForumTopic;
  'forum:message_added': { topicId: string; message: any };
  'forum:reply_added': { messageId: string; reply: any };
  'forum:topic_liked': { topicId: string; likeCount?: number };
  'forum:topic_unliked': { topicId: string; likeCount?: number };

  // ================= Posts =================
  'post:liked': LikePostResponse;

  // ================= Redeem, Report, Vote & Staff Forms =================
  'redeem:used': UseRedeemCodeResponse;
  'report:created': ReportResponse;
  'vote:success': { providerId: string; response: any };
  'form:submitted': { formId: string; response: StaffFormApplicationResponse };

  // ================= Payments =================
  'payment:initiated': InitiatePaymentResponse;
  'payment:checked': CheckPaymentResponse;
}

export type CrafterEventName = keyof CrafterEventMap;
