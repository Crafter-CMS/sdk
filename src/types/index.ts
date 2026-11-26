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

  /**
   * Stripe publishable key (pk_test_... / pk_live_...). Used for the Payment Element when the seller is an LLC.
   * If the backend returns a key in the payment response, that one takes precedence. Not secret.
   */
  stripePublishableKey?: string;

  /**
   * Page context (#447): the storefront's `window.__CRAFTER_CONTEXT__` object. Money display, language choice and the
   * checkout URL are read from it. On theme pages the SDK provides it by itself.
   */
  context?: import('../core/context').CrafterPageContext;
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
}

export interface CrafterApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
  /** Backend error code (ErrorType), e.g. 'out_of_stock' */
  type?: string;
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
  type?: 'in_game' | 'digital' | 'downloadable';
  serverIds?: string[];
  deliveries?: { serverId: string; commands: string[] }[];
  fileUrl?: string | null;
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

export interface PurchaseItemDto {
  /** Product UUID. */
  productId: string;
  /** Quantity to purchase. */
  quantity: number;
}

export interface PurchaseDto {
  /** List of product UUIDs to purchase. */
  productIds?: string[];
  /** Optional coupon code to apply. */
  coupon?: string;
  /**
   * Per-product quantity list (alternative to `quantities`).
   * Each entry specifies a productId and the desired quantity.
   */
  items?: PurchaseItemDto[];
  /**
   * Product quantities as a map of productId → quantity.
   * Alternative to `items`.
   */
  quantities?: Record<string, number>;
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
  /**
   * The server decides the currency (the store currency). Only the locked quote's (`quoteId`) currency
   * may be sent; any other value returns 400 `payment_currency_mismatch`. If not given the field is not sent.
   */
  currency?: string;
  /** Locked rate quote (`payments.quote`); if not given, payment is in the store currency */
  quoteId?: string;
  websiteId?: string;
  user: InitiatePaymentUser;
  /** Buyer's country (ISO 3166-1 alpha-2); the Stripe Tax location when the seller is an LLC */
  billingCountry?: string;
  /** Postal code for the US / Canada (Stripe Tax) */
  billingPostalCode?: string;
  [key: string]: any;
}

/** Backend payment initiation response type. `stripe`: seller LLC + CrafterPayments (Payment Element). */
export type PaymentSessionType = 'iframe' | 'redirect' | 'kuveytturk_init' | 'stripe' | (string & {});

/** Stripe Tax line (country / state, tax type, rate and amount). */
export interface PaymentTaxLine {
  country: string | null;
  state: string | null;
  /** 'vat' | 'sales_tax' | 'gst' | 'hst' | 'pst' | 'qst' ... */
  taxType: string | null;
  /** Rate as a percentage (e.g. 19 = 19%) */
  rate: number;
  amount: number;
}

/** Tax breakdown and total (only when the backend returns `subtotal`, i.e. when Stripe Tax was calculated). */
export interface PaymentTaxBreakdown {
  /** Amount excluding tax */
  subtotal: number;
  /** Total tax */
  taxAmount: number;
  /** Total to charge (including tax) */
  total: number;
  currency: string;
  lines: PaymentTaxLine[];
}

/**
 * CrafterPayments payment when the seller is an LLC: completed on the page with the Stripe Payment Element.
 * Stripe.js is not bundled in the SDK; the theme developer loads it (see wiki/07-payments.md).
 */
export interface StripePaymentSession {
  paymentId: string;
  /** PaymentIntent client secret: `stripe.elements({ clientSecret })` */
  clientSecret: string;
  /**
   * Stripe publishable key. From the backend response if present, otherwise from `CrafterConfig.stripePublishableKey`.
   * null if neither exists (the theme must use its own key).
   */
  publishableKey: string | null;
  /** Total to charge (including tax) */
  amount: number;
  currency: string;
  merchantOid?: string;
  /** Stripe Tax breakdown; null if the backend returned no tax info */
  tax: PaymentTaxBreakdown | null;
  /** Store amount and rate for a payment in the customer currency; absent for a payment in the store currency */
  presentment?: PaymentPresentment;
}

/** Rate quote kind: cart payment or balance top-up */
export type PresentmentQuoteKind = 'cart' | 'top_up';

/** `POST /payment/quote` body */
export interface PresentmentQuoteRequest {
  /** Verilmezse `CrafterConfig.websiteId` */
  websiteId?: string;
  kind: PresentmentQuoteKind;
  /** Currency chosen by the customer (a suggestion); the server decides by settings and country */
  currency?: string;
  /** kind = top_up: top-up amount (in the store currency) */
  amount?: number;
  /** kind = cart: the same cart fields as `cart.checkout` */
  coupon?: string;
  productIds?: string[];
  items?: { productId: string; quantity: number }[];
  quantities?: Record<string, number>;
}

/** Locked rate quote (valid ~30 min); payment starts with `quoteId` */
export interface PresentmentQuote {
  quoteId: string;
  kind: PresentmentQuoteKind;
  storeCurrency: string;
  storeAmount: number;
  /** Currency and amount the customer will pay */
  currency: string;
  amount: number;
  /** 1 store unit = rate customer units (including the FX margin) */
  rate: number;
  baseRate?: number;
  markupPercent?: number;
  rateDate?: string;
  rateSource?: string;
  /** ISO tarih */
  expiresAt: string;
}

/** Customer currency info in the payment response (when paying with a quote) */
export interface PaymentPresentment {
  quoteId: string;
  currency: string;
  amount: number;
  rate: number;
  rateDate?: string;
  storeCurrency: string;
  storeAmount: number;
}

/** Customer currency setting: automatic, selected currencies or disabled */
export type CustomerCurrencyMode = 'auto' | 'selected' | 'off' | (string & {});

/** How the customer currency was chosen: selection (cookie / parameter), country or store currency */
export type CustomerCurrencySource = 'choice' | 'country' | 'store' | (string & {});

/** `GET /payment/currencies`: context for price display and the currency selector */
export interface CustomerCurrencyContext {
  storeCurrency: string;
  mode: CustomerCurrencyMode;
  /** Whether currencies other than the store currency can be shown */
  enabled: boolean;
  /** Currencies in the selector; the store currency comes first */
  currencies: string[];
  /** The customer's currency */
  currency: string;
  source: CustomerCurrencySource;
  /** 1 store unit = rate customer units (including the FX margin) */
  rate: number;
  /** Rates of the allowed currencies (for instant conversion in the selector) */
  rates: Record<string, number>;
  markupPercent: number;
  rateDate: string | null;
  rateSource: string | null;
}

/** `POST /payment/currencies/convert`: amounts in the customer currency, in request order */
export interface CurrencyConversion {
  storeCurrency: string;
  currency: string;
  source: CustomerCurrencySource;
  rate: number;
  rateDate: string | null;
  rateSource: string | null;
  amounts: number[];
}

/**
 * Payment in the customer currency (optional): a locked quote is fetched first, payment starts with `quoteId`.
 * If the quote expired / the cart changed, a new quote is fetched once; if the store disabled the customer
 * currency (`customer_currency_not_allowed`), payment starts in the store currency.
 */
export interface CustomerCurrencyOptions {
  useCustomerCurrency?: boolean;
  /** Currency suggestion for the quote; if not given the server decides from the cookie / country */
  customerCurrency?: string;
}

export interface InitiatePaymentResponse {
  token?: string;
  iframeUrl?: string;
  paymentId?: string;
  paymentUrl?: string;
  success?: boolean;
  type?: PaymentSessionType;
  /** The backend's raw field; the SDK also returns it as `paymentId` */
  payment_id?: string;
  payment_url?: string;
  redirectUrl?: string;
  iframeHtml?: string;
  /** type = kuveytturk_init: 3D formu */
  html?: string;
  merchant_oid?: string;
  amount?: number | string;
  currency?: string;
  /** type = stripe: PaymentIntent client secret */
  clientSecret?: string;
  /** type = stripe: amount excluding tax, total tax and lines (raw fields) */
  subtotal?: number;
  taxAmount?: number;
  taxes?: PaymentTaxLine[];
  /** If the cart was paid entirely with balance, the items have been delivered; no provider redirect */
  delivered?: boolean;
  /** Added by the SDK: everything needed for the Payment Element if type = stripe, absent otherwise */
  stripe?: StripePaymentSession;
  /** Added by the SDK: tax breakdown (null if absent) */
  tax?: PaymentTaxBreakdown | null;
  /**
   * Store amount and rate when paying with a quote (in the customer currency). In this case `amount`, `currency`, `subtotal`,
   * `taxAmount` and `taxes` are in the customer currency.
   */
  presentment?: PaymentPresentment;
  /** Added by the SDK (`useCustomerCurrency`): the customer currency is disabled, payment is in the store currency */
  customerCurrencyDisabled?: boolean;
  [key: string]: any;
}

/** Cart payment (`cart.checkout`) response; same shape as the payment initiation response. */
export type CheckoutPaymentResponse = InitiatePaymentResponse;

/** Backend payment record status (public status endpoint). */
export type PaymentRecordStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELED' | 'REFUNDED' | (string & {});

/** Delivery summary returned by the public status endpoint; null for an old backend or a payment without delivery. */
export type PublicDeliveryState = 'pending' | 'delivered' | 'failed' | 'refunded' | null;

/**
 * Delivery status (same names as the backend's `deliveryStatus` values).
 * - NEEDS_REVIEW: payment received but delivery failed / is under review; a store admin must step in.
 * - REFUNDED: could not be delivered because the product sold out, and the payment was refunded automatically.
 */
export type PaymentDeliveryStatus = 'PENDING' | 'DELIVERED' | 'NEEDS_REVIEW' | 'REFUNDED';

/** Result shown to the buyer after payment. */
export type PaymentOutcome = 'processing' | 'success' | 'pending' | 'failed' | 'refunded' | 'needs_review';

export interface PaymentStatusResult {
  paymentId: string;
  status: PaymentRecordStatus;
  /** The backend's raw delivery summary */
  delivery: PublicDeliveryState;
  /** Delivery status; null if there is no delivery info */
  deliveryStatus: PaymentDeliveryStatus | null;
  /** Combined payment + delivery result */
  outcome: PaymentOutcome;
  /** Whether the result is final (polling can stop) */
  final: boolean;
}

export interface WaitForPaymentOptions {
  /** Number of attempts (default 20) */
  attempts?: number;
  /** Wait between attempts, ms (default 1500) */
  intervalMs?: number;
  signal?: AbortSignal;
}

/** Site balance top-up conditions: `GET /payment/balance-top-up/policy` */
export interface BalanceTopUpPolicy {
  /** Whether balance top-up is enabled */
  enabled: boolean;
  /** Seller LLC: closed-loop balance rules and limits apply */
  closedLoop: boolean;
  /** Added by the SDK: whether the balance terms text should be shown on the top-up screen (same as closedLoop) */
  showTerms: boolean;
  /** Store currency */
  currency: string;
  /** Maximum per top-up (USD) */
  maxSingleUsd: number;
  /** Paid balance cap per store (USD) */
  maxPaidUsd: number;
  /** Store currency equivalents; null if there is no rate or in TR mode */
  maxSingleAmount: number | null;
  remainingAmount: number | null;
  /** Total balance = paid + bonus */
  balance: number;
  paidBalance: number;
  bonusBalance: number;
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
  'cart:checkout': CheckoutPaymentResponse;
  /** Cart changed (add / update / remove / another tab); `crafter:cart:updated` on `document` */
  'cart:updated': import('../modules/cart').CartState;
  /** Language / currency chosen; `crafter:localization:changed` on `document` */
  'localization:changed': { language: string; currency: string; url: string };
  'license:verified': { valid: boolean; productId?: string; type?: string; downloadable?: boolean };

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
  'payment:status': PaymentStatusResult;
  'payment:quoted': PresentmentQuote;
}

export type CrafterEventName = keyof CrafterEventMap;
