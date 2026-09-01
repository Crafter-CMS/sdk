interface CrafterConfig {
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
interface RequestOptions extends RequestInit {
    params?: Record<string, string | number | boolean | undefined>;
    skipAuth?: boolean;
}
interface CrafterApiError {
    statusCode: number;
    message: string | string[];
    error?: string;
    details?: Record<string, any>;
}
interface SignInDto {
    username: string;
    password: string;
    turnstileToken?: string;
}
interface SignUpDto {
    username: string;
    email: string;
    password: string;
    confirm_password: string;
    turnstileToken?: string;
}
interface AuthSuccessResponse {
    success: true;
    accessToken: string;
    refreshToken: string;
}
interface Auth2FaRequiredResponse {
    requires2FA: true;
    methods: Array<'authenticator' | 'email' | 'discord'>;
    primaryMethod: 'authenticator' | 'email' | 'discord' | string;
    tempToken: string;
    message: string;
}
interface AuthEmailVerificationRequiredResponse {
    requiresEmailVerification: true;
    isTempEmail: boolean;
    tempToken: string;
    maskedEmail?: string;
    emailToken?: string;
    message: string;
}
type AuthResponse = AuthSuccessResponse | Auth2FaRequiredResponse | AuthEmailVerificationRequiredResponse | {
    success?: boolean;
    accessToken?: string;
    refreshToken?: string;
    token?: string;
    message?: string;
    [key: string]: any;
};
interface TwoFactorValidateDto {
    tempToken: string;
    code: string;
    method?: 'authenticator' | 'email' | 'discord' | 'recovery_code';
}
interface DisableTwoFactorDto {
    password?: string;
    method?: 'authenticator' | 'email' | 'discord';
}
interface ResetPasswordDto {
    /**
     * Reset token from email.
     * Optional: If omitted in browser environments, it will be automatically extracted from the URL query param (?token=...).
     */
    token?: string;
    new_password: string;
    confirm_password: string;
    turnstileToken?: string;
}
interface InGameAuthDto {
    username: string;
    uuid: string;
    server_id: string;
    hash: string;
}
interface UserRole {
    id: string;
    name: string;
    color?: string;
    permissions?: string[];
}
interface UserProfile {
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
interface LightweightBalanceResponse {
    success: boolean;
    data: {
        userId: string;
        username: string;
        balance: number;
        currency?: string;
    };
}
interface UpdateOwnUserDto {
    email: string;
}
interface SendBalanceParams {
    targetUserId: string;
    amount: number;
    userId?: string;
}
interface SendBalanceResponse {
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
interface ChangePasswordDto {
    currentPassword: string;
    newPassword: string;
}
interface WallMessageReply {
    id: string;
    sender: {
        id: string;
        username: string;
        avatar?: string;
    };
    content: string;
    createdAt: string;
}
interface WallMessage {
    id: string;
    sender: {
        id: string;
        username: string;
        avatar?: string;
    };
    content: string;
    replies?: WallMessageReply[];
    createdAt: string;
}
interface TwoFactorStatusResponse {
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
interface DiscordStatusData {
    isModuleActive: boolean;
    isLinked: boolean;
    discordId?: string;
    discordUsername?: string;
}
interface DiscordStatusResponse {
    success: boolean;
    data: DiscordStatusData;
}
interface Category {
    id: string;
    name: string;
    slug?: string;
    description?: string;
    image?: string;
    order?: number;
    [key: string]: any;
}
interface Product {
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
interface PurchaseDto {
    productIds: string[];
    coupon?: string;
    [key: string]: any;
}
interface PurchaseResponse {
    success: boolean;
    message: string;
    type?: string;
    orderId?: string;
    [key: string]: any;
}
interface BulkDiscountConfig {
    type: 'percentage' | 'fixed' | string;
    amount: number;
    expireDate?: string | null;
    products?: string[];
}
interface MarketplaceConfig {
    bulkDiscount?: BulkDiscountConfig | null;
    [key: string]: any;
}
interface ChestProductSummary {
    id: string;
    name: string;
    server_id?: string;
    [key: string]: any;
}
interface ChestItem {
    id: string;
    product?: ChestProductSummary;
    used: boolean;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: any;
}
interface UseChestItemResponse {
    success: boolean;
    message: string;
    item: {
        id: string;
        used: boolean;
        updatedAt: string;
    };
}
interface GiftChestItemResponse {
    success: boolean;
    message: string;
    newChestItem?: {
        id: string;
        product?: any;
        used: boolean;
    };
}
interface CouponResponse {
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
interface UseRedeemCodeResponse {
    bonus?: number;
    products?: Array<{
        id: string;
        name: string;
    }>;
    success?: boolean;
    message?: string;
    [key: string]: any;
}
interface TicketCategory {
    id: string;
    name: string;
    description?: string;
}
type TicketCategoryDetails = TicketCategory;
interface TicketMessageSender {
    id: string;
    username: string;
    email: string | null;
}
interface TicketMessage {
    id?: string;
    senderId?: string;
    content: Record<string, any> | string;
    createdAt: string;
    sender?: TicketMessageSender;
    authorId?: string;
    authorName?: string;
    message?: string;
}
interface Ticket {
    id: string;
    title: string;
    category?: string;
    categoryDetails?: TicketCategoryDetails;
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REOPENED' | string;
    createdByUserId: string;
    createdByUser?: {
        id: string;
        username: string;
    };
    assignedUsers?: any[];
    messages?: TicketMessage[];
    createdAt: string;
    updatedAt?: string;
    [key: string]: any;
}
interface CreateTicketDto {
    title: string;
    categoryId: string;
    message: Record<string, any> | string;
    [key: string]: any;
}
interface ReplyTicketDto {
    message: Record<string, any> | string;
}
interface PostQueryDto {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    categoryId?: string;
    sortBy?: string;
}
interface PostAuthor {
    id: string;
    username: string;
    avatar?: string;
}
interface PostItem {
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
interface PaginatedPostsResponse {
    success: boolean;
    data: PostItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}
interface SinglePostResponse {
    success: boolean;
    data: PostItem;
}
interface LikePostResponse {
    success: boolean;
    data: {
        liked: boolean;
        likeCount: number;
    };
    message: string;
}
interface PageItem {
    id: string;
    title: string;
    slug: string;
    content: string;
    isPublished?: boolean;
    viewCount?: number;
    updatedAt?: string;
    [key: string]: any;
}
interface ServerStatusItem {
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
interface InitiatePaymentUser {
    name: string;
    email: string;
    phone?: string;
    address?: string;
}
interface InitiatePaymentDto {
    amount: number;
    providerId: string;
    currency?: string;
    websiteId?: string;
    user: InitiatePaymentUser;
    [key: string]: any;
}
interface InitiatePaymentResponse {
    token?: string;
    iframeUrl?: string;
    paymentId?: string;
    paymentUrl?: string;
    [key: string]: any;
}
interface CheckPaymentResponse {
    success: boolean;
    status: 'PENDING' | 'SUCCESS' | 'FAILED' | string;
    paymentId: string;
    amount?: number;
    [key: string]: any;
}
interface PublicPaymentProvider {
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
interface LatestPayment {
    id: string;
    username: string;
    amount: number;
    paymentMethod: string;
    timestamp: string;
}
interface LatestPurchase {
    id: string;
    username: string;
    productName: string;
    serverName: string;
    amount: number;
    timestamp: string;
}
interface LatestSignup {
    id: string;
    username: string;
    timestamp: string;
}
interface TopCreditLoader {
    id: string;
    username: string;
    totalAmount: number;
}
interface SiteStatistics {
    latest: {
        payments: LatestPayment[];
        purchases: LatestPurchase[];
        signups: LatestSignup[];
    };
    topCreditLoaders: TopCreditLoader[];
    totalUsers: number;
    [key: string]: any;
}
interface PunishmentItem {
    id: number | string;
    name: string;
    reason: string;
    operator: string;
    punishmentType: 'ban' | 'mute' | 'kick' | 'warn' | string;
    start: number;
    end: number;
    active: boolean;
}
interface PaginatedPunishmentsResponse {
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
interface VoteProviderItem {
    id: string;
    name: string;
    type?: string;
    url: string;
    cooldownHours: number;
    isActive: boolean;
    [key: string]: any;
}
interface VoteProcessResponse {
    success: boolean;
    message: string;
    canVoteAt?: string;
}
interface LegalDocuments {
    rules?: string;
    privacy_policy?: string;
    terms_of_service?: string;
    [key: string]: any;
}
type ReportType = 'spam' | 'harassment' | 'inappropriate_content' | 'fraud' | 'other';
interface CreateReportDto {
    reportType: ReportType;
    reason: string;
}
interface ReportResponse {
    id: string;
    reporterId: string;
    reportedUserId: string;
    reportType: ReportType;
    reason: string;
    status: 'pending' | 'resolved' | 'dismissed' | string;
    reporter?: {
        id: string;
        username: string;
    };
    reportedUser?: {
        id: string;
        username: string;
    };
    createdAt: string;
    [key: string]: any;
}
interface ForumCategory {
    id: string;
    name: string;
    slug: string;
    description?: string;
    topics?: any[];
    subCategories?: any[];
    [key: string]: any;
}
interface ForumMessageReply {
    id: string;
    authorId: string;
    authorName: string;
    content: string;
    createdAt?: string;
}
interface ForumMessage {
    id: string;
    authorId: string;
    authorName: string;
    content: string;
    replies?: ForumMessageReply[];
    createdAt?: string;
}
interface ForumTopic {
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
interface LikeTopicResponse {
    success: boolean;
    likeCount: number;
    message: string;
}
interface HelpCategoryItem {
    id: string;
    name: string;
    description?: string;
    order?: number;
}
interface HelpArticleItem {
    id: string;
    title: string;
    content?: string;
    categoryId: string;
    category?: {
        id: string;
        name: string;
    };
    order?: number;
}
interface HelpFaqItem {
    id: string;
    question: string;
    answer: string;
    order?: number;
}
interface HelpcenterOverviewResponse {
    categories: HelpCategoryItem[];
    items: HelpArticleItem[];
    faqs: HelpFaqItem[];
}
interface HelpcenterCategoryDetailResponse {
    id: string;
    name: string;
    items: HelpArticleItem[];
    itemCount: number;
}
interface StaffFormInput {
    id: string;
    name: string;
    type: 'text' | 'textarea' | 'number' | 'select' | 'radio' | 'checkbox' | string;
    index: number;
    required?: boolean;
}
interface StaffFormItem {
    id: string;
    title: string;
    description?: string;
    inputs: StaffFormInput[];
    isActive: boolean;
}
interface StaffFormApplicationValue {
    inputId: string;
    value: string;
}
interface StaffFormApplicationResponse {
    id: string;
    userId: string;
    values: StaffFormApplicationValue[];
    status: 'pending' | 'accepted' | 'rejected' | string;
    createdAt: string;
    updatedAt: string;
}
interface SearchResultItem {
    id: string;
    name: string;
    type: 'user' | 'post' | 'ticket' | 'page' | 'product' | string;
    websiteId: string;
    subtitle: string;
    image: string | null;
}
interface WebsiteSeoConfig {
    metaTitleTemplate?: string;
    metaDescriptionTemplate?: string;
    defaultKeywords?: string[];
    ogImage?: string;
    favicon?: string;
    robotsTxt?: string;
    customHeadTags?: string;
    [key: string]: any;
}
interface SitemapUrlItem {
    path: string;
    lastmod: string;
    changefreq: string;
    priority: number;
}
interface LuckPermsPermissionNode {
    permission: string;
    value: number;
    server?: string;
    world?: string;
    expiry?: number;
    contexts?: string;
}
interface LuckPermsPlayerData {
    uuid: string;
    username: string;
    primaryGroup: string;
    inheritedGroups: string[];
    permissions: LuckPermsPermissionNode[];
}
interface WebsitePluginModule {
    isActive: boolean;
    config?: Record<string, any>;
    [key: string]: any;
}
interface WebsiteInfo {
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
interface CrafterEventMap {
    'auth:login': {
        token?: string;
        [key: string]: any;
    };
    'auth:logout': void;
    'auth:token_refreshed': {
        token: string;
    };
    'user:updated': UserProfile;
    'balance:sent': SendBalanceResponse;
    'wall:message_added': {
        userId: string;
        message: WallMessage;
    };
    'wall:reply_added': {
        userId: string;
        wallMessageId: string;
        reply: WallMessageReply;
    };
    '2fa:enabled': {
        method: 'authenticator' | 'email' | 'discord';
        recoveryCodes?: string[];
    };
    '2fa:disabled': {
        method?: string;
    };
    'discord:linked': {
        discordId: string;
        discordUsername: string;
    };
    'discord:unlinked': void;
    'cart:purchased': PurchaseResponse;
    'chest:item_used': {
        itemId: string;
        response: UseChestItemResponse;
    };
    'chest:item_gifted': {
        targetUserId: string;
        itemId: string;
        response: GiftChestItemResponse;
    };
    'ticket:created': Ticket;
    'ticket:replied': {
        ticketId: string;
        response: Ticket;
    };
    'ticket:closed': {
        ticketId: string;
        reason?: string;
        response: Ticket;
    };
    'ticket:opened': {
        ticketId: string;
        response: Ticket;
    };
    'forum:topic_created': ForumTopic;
    'forum:message_added': {
        topicId: string;
        message: any;
    };
    'forum:reply_added': {
        messageId: string;
        reply: any;
    };
    'forum:topic_liked': {
        topicId: string;
        likeCount?: number;
    };
    'forum:topic_unliked': {
        topicId: string;
        likeCount?: number;
    };
    'post:liked': LikePostResponse;
    'redeem:used': UseRedeemCodeResponse;
    'report:created': ReportResponse;
    'vote:success': {
        providerId: string;
        response: any;
    };
    'form:submitted': {
        formId: string;
        response: StaffFormApplicationResponse;
    };
    'payment:initiated': InitiatePaymentResponse;
    'payment:checked': CheckPaymentResponse;
}
type CrafterEventName = keyof CrafterEventMap;

declare class HttpClient {
    readonly mode: 'storefront' | 'direct';
    private config;
    private token;
    private storageKey;
    constructor(config?: CrafterConfig);
    /**
     * Safe getter for stored token from localStorage
     */
    private readTokenFromStorage;
    /**
     * Get current auth token
     */
    getToken(): string | null;
    /**
     * Set or clear auth token
     */
    setToken(token: string | null): void;
    /**
     * Clear active auth token
     */
    clearToken(): void;
    /**
     * Resolves the full URL for an endpoint according to SDK operating mode:
     *
     * Mode 1: 'storefront' (Liquid themes)
     * - Prepends '/api/storefront':
     *   /v2/auth/signin      -> /api/storefront/v2/auth/signin
     *   /products            -> /api/storefront/products
     *
     * Mode 2: 'direct' (Headless apps, external scripts, Node)
     * - Prepends 'https://api.crafter.net.tr/website/{v2/}:websiteId/...':
     *   /v2/auth/signin      -> https://api.crafter.net.tr/website/v2/:websiteId/auth/signin
     *   /products            -> https://api.crafter.net.tr/website/:websiteId/products
     *   /payment/initiate    -> https://api.crafter.net.tr/website/payment/initiate
     */
    buildUrl(path: string, options?: RequestOptions): string;
    private appendParams;
    /**
     * Core request dispatcher with automatic credentials (cookies) & token header
     */
    request<T = any>(endpoint: string, options?: RequestOptions): Promise<T>;
    get<T = any>(endpoint: string, options?: RequestOptions): Promise<T>;
    post<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T>;
    put<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T>;
    patch<T = any>(endpoint: string, body?: any, options?: RequestOptions): Promise<T>;
    delete<T = any>(endpoint: string, options?: RequestOptions): Promise<T>;
}

type EventHandler<T = any> = (payload: T) => void;
declare class EventEmitter {
    private listeners;
    /**
     * Subscribe to an event.
     */
    on<K extends keyof CrafterEventMap>(event: K, handler: EventHandler<CrafterEventMap[K]>): () => void;
    on(event: string, handler: EventHandler): () => void;
    /**
     * Unsubscribe a handler from an event.
     */
    off<K extends keyof CrafterEventMap>(event: K, handler: EventHandler<CrafterEventMap[K]>): void;
    off(event: string, handler: EventHandler): void;
    /**
     * Subscribe to an event and automatically remove the listener after it fires once.
     */
    once<K extends keyof CrafterEventMap>(event: K, handler: EventHandler<CrafterEventMap[K]>): () => void;
    once(event: string, handler: EventHandler): () => void;
    /**
     * Emit an event to all subscribers.
     */
    emit<K extends keyof CrafterEventMap>(event: K, payload: CrafterEventMap[K]): void;
    emit(event: string, payload?: any): void;
    /**
     * Remove all listeners for an event or all events.
     */
    removeAllListeners(event?: string): void;
}

declare class AuthModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Sign in user with username and password.
     * POST /v2/auth/signin
     */
    signin(data: SignInDto): Promise<AuthResponse>;
    /**
     * Alias for signin.
     */
    login(data: SignInDto): Promise<AuthResponse>;
    /**
     * Register a new user.
     * POST /v2/auth/signup
     */
    signup(data: SignUpDto | (Omit<SignUpDto, 'confirm_password'> & {
        confirmPassword: string;
    })): Promise<AuthResponse>;
    /**
     * Alias for signup.
     */
    register(data: SignUpDto | (Omit<SignUpDto, 'confirm_password'> & {
        confirmPassword: string;
    })): Promise<AuthResponse>;
    /**
     * Fast authentication for in-game players clicking web links (e.g. /web command in Minecraft).
     * If parameters are omitted, automatically extracts username, uuid, server_id, and hash from URL query params.
     * POST /v2/auth/ingame
     */
    inGameAuth(data?: Partial<InGameAuthDto>): Promise<AuthResponse>;
    /**
     * Refresh access token using refresh token.
     * POST /v2/auth/refresh-token
     */
    refreshToken(refreshToken: string): Promise<AuthResponse>;
    /**
     * Alias for refreshToken.
     */
    refresh(refreshToken: string): Promise<AuthResponse>;
    /**
     * Request password reset email.
     * POST /v2/auth/forgot-password
     */
    forgotPassword(email: string, turnstileToken?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Get password reset token from current URL query parameters (?token=...).
     * Returns null in SSR/Node environments or if token query param is missing.
     */
    getResetTokenFromUrl(): string | null;
    /**
     * Reset password with reset token.
     * If data.token is omitted, it automatically attempts to read ?token= from the URL (window.location.search).
     * POST /v2/auth/reset-password
     */
    resetPassword(data: ResetPasswordDto | {
        token?: string;
        newPassword?: string;
        new_password?: string;
        confirmPassword?: string;
        confirm_password?: string;
        turnstileToken?: string;
    }): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Verify email OTP code during login or signup.
     * POST /v2/auth/verify-email
     */
    verifyEmail(data: {
        tempToken: string;
        code: string;
    } | string): Promise<any>;
    /**
     * Resend verification email code during login or registration.
     * POST /v2/auth/resend-email
     */
    resendEmail(tempToken: string): Promise<any>;
    /**
     * Alias for resendEmail.
     */
    resendVerification(tempToken: string): Promise<any>;
    /**
     * Validate 2FA code during sign in.
     * POST /v2/auth/2fa/verify
     */
    validate2Fa(data: TwoFactorValidateDto): Promise<AuthResponse>;
    /**
     * Send 2FA verification code to email during login.
     * POST /v2/auth/2fa/send-email-code
     */
    send2FaEmailCode(tempToken: string): Promise<any>;
    /**
     * Send 2FA verification code/push to Discord DM during login.
     * POST /v2/auth/2fa/send-discord-code
     */
    send2FaDiscordCode(tempToken: string): Promise<any>;
    /**
     * Update temporary @temp.com email and send verification code (for players registered in-game).
     * POST /v2/auth/update-temp-email
     */
    updateTempEmail(tempToken: string, email: string): Promise<any>;
    /**
     * Get Discord OAuth redirect URL for login or account connect.
     * GET /v2/auth/discord?action=login|connect&redirectUri=...
     */
    getDiscordAuthUrl(action?: 'login' | 'connect', redirectUri?: string): string;
    /**
     * Sign out user and clear session token.
     * In storefront mode, notifies proxy to delete HttpOnly cookies.
     */
    logout(): Promise<void>;
    isAuthenticated(): boolean;
    getToken(): string | null;
    setToken(token: string | null): void;
}

declare class UsersModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get user profile by ID or current user ('me').
     * GET /v2/users/:userId
     */
    getProfile(userId?: string): Promise<UserProfile>;
    /**
     * High-performance lightweight balance check for theme headers.
     * GET /v2/users/:userId/balance
     */
    getBalance(userId?: string): Promise<LightweightBalanceResponse['data']>;
    /**
     * Search/get user by username.
     * GET /v2/users/@:username
     */
    getByUsername(username: string): Promise<UserProfile>;
    /**
     * Update own user profile.
     * In backend self-update, only email can be updated.
     * PUT /v2/users/:userId
     */
    updateProfile(data: UpdateOwnUserDto, userId?: string): Promise<UserProfile>;
    /**
     * Send balance to another user.
     * POST /v2/users/:sender/balance/send
     */
    sendBalance(params: SendBalanceParams): Promise<SendBalanceResponse>;
    /**
     * Change user password.
     * POST /v2/users/:userId/change-password
     */
    changePassword(data: ChangePasswordDto | {
        currentPassword?: string;
        current_password?: string;
        newPassword?: string;
        new_password?: string;
    }, userId?: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * List wall messages and replies for a user profile.
     * GET /v2/users/:userId/wall
     */
    getWall(userId: string): Promise<WallMessage[]>;
    /**
     * Post a message on a user's wall.
     * POST /v2/users/:userId/wall
     */
    postWallMessage(userId: string, content: string): Promise<any>;
    /**
     * Reply to a wall message.
     * POST /v2/users/:userId/wall/:wallMessageId/reply
     */
    replyWallMessage(userId: string, wallMessageId: string, content: string): Promise<any>;
    /**
     * Check 2FA active methods status.
     * GET /v2/users/me/2fa/status
     */
    get2FaStatus(): Promise<TwoFactorStatusResponse>;
    /**
     * Generate Google Authenticator secret & QR code.
     * POST /v2/users/me/2fa/authenticator/setup
     */
    setupAuthenticator(): Promise<{
        secret: string;
        qrCodeUrl: string;
    }>;
    /**
     * Enable Google Authenticator with 6-digit code.
     * POST /v2/users/me/2fa/authenticator/enable
     */
    enableAuthenticator(code: string): Promise<any>;
    /**
     * Send 2FA confirmation code to registered email.
     * POST /v2/users/me/2fa/email/send-code
     */
    sendEmail2FaCode(): Promise<any>;
    /**
     * Enable Email 2FA with received code.
     * POST /v2/users/me/2fa/email/enable
     */
    enableEmail2Fa(code: string): Promise<any>;
    /**
     * Send 2FA confirmation code to user's Discord DM.
     * POST /v2/users/me/2fa/discord/send-code
     */
    sendDiscord2FaCode(): Promise<any>;
    /**
     * Enable Discord 2FA with received code.
     * POST /v2/users/me/2fa/discord/enable
     */
    enableDiscord2Fa(code: string): Promise<any>;
    /**
     * Disable 2FA.
     * Accepts optional password and specific method to disable.
     * POST /v2/users/me/2fa/disable
     */
    disable2Fa(data?: DisableTwoFactorDto): Promise<any>;
    /**
     * Set primary 2FA method.
     * PUT /v2/users/me/2fa/primary-method
     */
    setPrimary2FaMethod(method: 'authenticator' | 'email' | 'discord'): Promise<any>;
    /**
     * Regenerate 2FA backup recovery codes.
     * POST /v2/users/me/2fa/recovery-codes/regenerate
     */
    regenerateRecoveryCodes(): Promise<{
        recoveryCodes: string[];
    }>;
    /**
     * Get user's linked Discord status.
     * GET /v2/users/me/discord/status
     */
    getDiscordStatus(): Promise<DiscordStatusData>;
    /**
     * Unlink Discord account.
     * POST /v2/users/me/discord/unlink
     */
    unlinkDiscord(): Promise<any>;
}

declare class StoreModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * List all categories.
     * GET /categories
     */
    getCategories(): Promise<Category[]>;
    /**
     * Get single category by ID.
     * GET /categories/:categoryId
     */
    getCategory(categoryId: string): Promise<Category>;
    /**
     * List all products.
     * GET /products
     */
    getProducts(): Promise<Product[]>;
    /**
     * Get product details by product ID.
     * GET /products/:productId
     */
    getProduct(productId: string): Promise<Product>;
    /**
     * Get products by category ID.
     * GET /products/by-category/:categoryId
     */
    getProductsByCategory(categoryId: string): Promise<Product[]>;
    /**
     * Get store marketplace settings including bulk discount promotions.
     * GET /config/marketplace
     */
    getConfig(): Promise<MarketplaceConfig>;
}

declare class CartModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Complete purchase using user balance.
     * POST /marketplace/purchase
     */
    purchase(data: PurchaseDto): Promise<PurchaseResponse>;
}

declare class ChestModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get user's chest items.
     * GET /chest/:userId
     */
    getItems(userId?: string): Promise<ChestItem[]>;
    /**
     * Use an item from the user's chest.
     * POST /chest/:userId/use/:chestItemId
     */
    useItem(chestItemId: string, userId?: string): Promise<any>;
    /**
     * Gift a chest item to another user.
     * POST /chest/:from/gift/:to/:chestItemId
     */
    giftItem(targetUserId: string, chestItemId: string, fromUserId?: string): Promise<any>;
}

declare class TicketsModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * List all tickets for current user.
     * GET /v2/tickets
     */
    list(): Promise<Ticket[]>;
    /**
     * Alias for list.
     */
    getTickets(): Promise<Ticket[]>;
    /**
     * List ticket categories.
     * GET /v2/tickets/categories
     */
    getCategories(): Promise<TicketCategory[]>;
    /**
     * Get single ticket by ID.
     * GET /v2/tickets/:ticketId
     */
    get(ticketId: string): Promise<Ticket>;
    /**
     * Create a new support ticket.
     * Plain text message is automatically transformed to valid Lexical rich-text JSON format.
     * POST /v2/tickets
     */
    create(data: CreateTicketDto): Promise<Ticket>;
    /**
     * Reply to a ticket.
     * Plain text message is automatically transformed to valid Lexical rich-text JSON format.
     * POST /v2/tickets/:ticketId/reply
     */
    reply(ticketId: string, replyData: ReplyTicketDto | string): Promise<Ticket>;
    /**
     * Close a ticket with optional resolution reason.
     * POST /v2/tickets/:ticketId/close
     */
    close(ticketId: string, reason?: string): Promise<Ticket>;
    /**
     * Reopen a closed ticket.
     * POST /v2/tickets/:ticketId/open
     */
    open(ticketId: string): Promise<Ticket>;
    /**
     * Alias for open.
     */
    reopen(ticketId: string): Promise<Ticket>;
}

declare class PostsModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * List posts with optional filters and pagination.
     * GET /v2/posts
     */
    list(query?: PostQueryDto): Promise<PaginatedPostsResponse>;
    /**
     * Get post by slug or ID.
     * GET /v2/posts/:idOrSlug
     */
    getBySlug(slug: string): Promise<PostItem>;
    /**
     * Get post by ID or slug.
     * GET /v2/posts/:idOrSlug
     */
    get(idOrSlug: string): Promise<PostItem>;
    /**
     * Like / toggle like for a post.
     * POST /v2/posts/:id/like
     */
    like(id: string): Promise<LikePostResponse>;
    /**
     * Get posts liked by a user (e.g. for user profile favorites tab).
     * GET /v2/posts/user/:userId/liked
     */
    getUserLiked(userId?: string, page?: number, limit?: number): Promise<PaginatedPostsResponse>;
}

declare class PagesModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * List all published static pages.
     * GET /v2/pages/public
     */
    list(): Promise<PageItem[]>;
    /**
     * Get page details and content by slug.
     * GET /v2/pages/slug/:slug
     */
    getBySlug(slug: string): Promise<PageItem>;
}

declare class CouponsModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Validate and get coupon discount details.
     * GET /coupons/:couponCode
     */
    get(couponCode: string): Promise<CouponResponse>;
}

declare class RedeemCodeModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Redeem gift/promo code.
     * POST /redeem-codes/use
     */
    use(code: string): Promise<UseRedeemCodeResponse>;
}

declare class ServersModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get server list with live player counts and online status.
     * GET /config/servers
     */
    getList(): Promise<ServerStatusItem[]>;
    /**
     * Alias for getList.
     */
    list(): Promise<ServerStatusItem[]>;
}

declare class PaymentsModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get public active payment providers and bonus multipliers.
     * GET /config/payment/public
     */
    getPublicProviders(): Promise<PublicPaymentProvider[]>;
    /**
     * Initiate a payment session (PayTR, Shopier, CrafterPayments etc.).
     * POST /payment/initiate
     */
    initiate(data: InitiatePaymentDto | (Omit<InitiatePaymentDto, 'providerId'> & {
        provider?: string;
        providerId?: string;
    })): Promise<InitiatePaymentResponse>;
    /**
     * Check payment status by payment ID.
     * POST /payment/check
     */
    check(paymentId: string): Promise<CheckPaymentResponse>;
}

declare class StatisticsModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get homepage statistics: latest purchases, payments, signups, leaderboard and total users.
     * GET /v2/statistics?limit=:limit
     */
    get(limit?: number): Promise<SiteStatistics>;
}

declare class PunishmentsModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * List punishments with pagination.
     * GET /v2/punishments
     */
    list(page?: number, limit?: number): Promise<PaginatedPunishmentsResponse>;
    /**
     * Search punishments by player name and optional type (ban, mute etc.).
     * GET /v2/punishments/search?query=:query&type=:type
     */
    search(query: string, type?: 'ban' | 'mute' | 'kick' | 'warn' | string): Promise<PunishmentItem[]>;
}

declare class VoteModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get active vote sites with player cooldowns.
     * GET /config/vote-providers
     */
    getProviders(): Promise<VoteProviderItem[]>;
    /**
     * Process vote request.
     * POST /config/vote-providers/vote
     */
    vote(providerId: string, extraData?: Record<string, any>): Promise<VoteProcessResponse>;
}

declare class LegalModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get legal documents (terms of service, privacy policy, rules, refund policy etc.).
     * GET /config/legal
     */
    getDocuments(): Promise<LegalDocuments>;
}

declare class ReportsModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Report a user to staff.
     * POST /reports/:reportedUserId
     */
    create(reportedUserId: string, data: CreateReportDto): Promise<ReportResponse>;
}

declare class ForumModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get all forum categories.
     * GET /forum/categories
     */
    getCategories(): Promise<ForumCategory[]>;
    /**
     * Get topics under a category.
     * GET /forum/category/:categoryId/topics
     */
    getTopics(categoryId: string): Promise<ForumTopic[]>;
    /**
     * Get topic details and messages.
     * GET /forum/topic/:topicId
     */
    getTopic(topicId: string): Promise<ForumTopic>;
    /**
     * Create a new topic in a category.
     * Plain text content is automatically transformed to valid Lexical rich-text JSON format.
     * POST /forum/category/:categoryId/topic
     */
    createTopic(categoryId: string, data: {
        title: string;
        content: string | Record<string, any>;
    }): Promise<ForumTopic>;
    /**
     * Post a message in a topic.
     * Plain text content is automatically transformed to valid Lexical rich-text JSON format.
     * POST /forum/topic/:topicId/message
     */
    addMessage(topicId: string, content: string | Record<string, any>): Promise<any>;
    /**
     * Reply / quote a forum message.
     * Plain text content is automatically transformed to valid Lexical rich-text JSON format.
     * POST /forum/message/:messageId/reply
     */
    replyMessage(messageId: string, content: string | Record<string, any>): Promise<any>;
    /**
     * Like / toggle like for a topic.
     * POST /forum/topic/:topicId/like
     */
    likeTopic(topicId: string): Promise<any>;
    /**
     * Unlike a topic.
     * DELETE /forum/topic/:topicId/like
     */
    unlikeTopic(topicId: string): Promise<any>;
    /**
     * Get forum statistics (latest topics/replies).
     * GET /forum/statistics
     */
    getStatistics(): Promise<any>;
}

declare class HelpcenterModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get help center overview containing categories, featured items and FAQs.
     * GET /helpcenter
     */
    getOverview(query?: {
        search?: string;
        faqOnly?: boolean;
        page?: number;
        limit?: number;
    }): Promise<HelpcenterOverviewResponse>;
    /**
     * Alias for getOverview.
     */
    getCategories(query?: {
        search?: string;
        faqOnly?: boolean;
        page?: number;
        limit?: number;
    }): Promise<HelpcenterOverviewResponse>;
    /**
     * Get single help category with its articles.
     * GET /helpcenter/category/:categoryId
     */
    getCategory(categoryId: string): Promise<HelpcenterCategoryDetailResponse>;
    /**
     * Get single article details.
     * GET /helpcenter/item/:itemId
     */
    getArticle(itemId: string): Promise<HelpArticleItem>;
}

declare class StaffFormsModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * List open staff application forms.
     * GET /staff-forms
     */
    list(): Promise<StaffFormItem[]>;
    /**
     * Get application form details and fields by ID.
     * GET /staff-forms/:formId
     */
    get(formId: string): Promise<StaffFormItem>;
    /**
     * Submit an application for a staff form.
     * Accepts either an array of { inputId, value } or an object of { [inputId]: value }.
     * POST /staff-forms/:formId/apply
     */
    apply(formId: string, answers: Record<string, any> | Array<{
        inputId: string;
        value: any;
    }>): Promise<any>;
}

declare class SearchModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Global metadata live search across users, posts, tickets, pages, and products.
     * GET /metadata-search?q=:query&limit=:limit
     */
    metadataSearch(query: string, limit?: number): Promise<SearchResultItem[]>;
    /**
     * Alias for metadataSearch.
     */
    query(searchTerm: string, limit?: number): Promise<SearchResultItem[]>;
}

declare class SeoModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get global website SEO configuration (meta tags, keywords, og:image, favicon etc.).
     * GET /v2/seo/config
     */
    getConfig(): Promise<WebsiteSeoConfig>;
    /**
     * Get dynamic sitemap URL entries for all published posts, pages, categories, and products.
     * GET /v2/seo/sitemap-data
     */
    getSitemapData(): Promise<SitemapUrlItem[]>;
}

declare class LuckPermsModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get player's LuckPerms primary group, inherited groups, and active permissions.
     * Identifier can be a player username or Minecraft UUID.
     * GET /v2/modules/luckperms/player/:identifier
     */
    getPlayer(identifier: string): Promise<LuckPermsPlayerData>;
    /**
     * Get list of available LuckPerms groups configured on the server.
     * GET /v2/modules/luckperms/groups
     */
    getGroups(): Promise<string[]>;
}

declare class WebsiteModule {
    private http;
    private events;
    constructor(http: HttpClient, events: EventEmitter);
    /**
     * Get website general info, active plugin modules (discord_bot, authme, luckperms, etc.), and settings.
     * Resolves to GET /api/storefront in storefront mode, or GET /website/:websiteId in direct mode.
     */
    getInfo(): Promise<WebsiteInfo>;
}

/**
 * Official Lexical Format Bitmask Flags
 * @see https://lexical.dev/docs/concepts/nodes
 */
declare const IS_BOLD = 1;
declare const IS_ITALIC = 2;
declare const IS_STRIKETHROUGH = 4;
declare const IS_UNDERLINE = 8;
declare const IS_CODE = 16;
declare const IS_SUBSCRIPT = 32;
declare const IS_SUPERSCRIPT = 64;
declare const IS_HIGHLIGHT = 128;
interface SerializedLexicalNode {
    type: string;
    version: number;
    [key: string]: any;
}
interface SerializedTextNode extends SerializedLexicalNode {
    type: 'text';
    text: string;
    format: number;
    detail: number;
    mode: 'normal' | 'token' | 'segmented';
    style: string;
}
interface SerializedElementNode extends SerializedLexicalNode {
    children: SerializedLexicalNode[];
    direction: 'ltr' | 'rtl' | null;
    format: 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | '';
    indent: number;
}
interface SerializedHeadingNode extends SerializedElementNode {
    type: 'heading';
    tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}
interface SerializedListNode extends SerializedElementNode {
    type: 'list';
    listType: 'bullet' | 'number' | 'check';
    start?: number;
    tag: 'ol' | 'ul';
}
interface SerializedListItemNode extends SerializedElementNode {
    type: 'listitem';
    value?: number;
    checked?: boolean;
}
interface SerializedLinkNode extends SerializedElementNode {
    type: 'link' | 'autolink';
    url: string;
    target?: string | null;
    rel?: string | null;
    title?: string | null;
}
interface SerializedQuoteNode extends SerializedElementNode {
    type: 'quote';
}
interface SerializedCodeNode extends SerializedElementNode {
    type: 'code';
    language?: string | null;
}
interface SerializedTableNode extends SerializedElementNode {
    type: 'table';
}
interface SerializedTableRowNode extends SerializedElementNode {
    type: 'tablerow';
}
interface SerializedTableCellNode extends SerializedElementNode {
    type: 'tablecell';
    colSpan?: number;
    rowSpan?: number;
    width?: number;
    headerState?: number;
    backgroundColor?: string | null;
}
interface SerializedHorizontalRuleNode extends SerializedLexicalNode {
    type: 'horizontalrule';
}
interface SerializedImageNode extends SerializedLexicalNode {
    type: 'image' | 'inline-image';
    src: string;
    altText?: string;
    width?: number | 'inherit';
    height?: number | 'inherit';
    maxWidth?: number;
    caption?: SerializedEditorState;
}
interface SerializedEditorState {
    root: SerializedRootNode;
}
interface SerializedRootNode extends SerializedElementNode {
    type: 'root';
}
interface LexicalHtmlOptions {
    /**
     * If true, generates clean semantic HTML without pre-baked Tailwind/theme utility classes.
     * Default: false (includes standard Crafter storefront theme classes).
     */
    plainSemantic?: boolean;
}
/**
 * Checks if an object conforms to official Lexical serialized EditorState AST format.
 * @see https://lexical.dev/docs/serialization
 */
declare function isLexicalFormat(obj: any): boolean;
/**
 * Converts Lexical AST node format into semantic HTML.
 * Fully compatible with official Lexical specifications and Storefront SSR Liquid filters.
 *
 * Supports:
 * - Text bitmasks: Bold (1), Italic (2), Strikethrough (4), Underline (8), Code (16), Subscript (32), Superscript (64), Highlight (128)
 * - Block alignment: left, center, right, justify, start, end
 * - Block indentation and text direction (ltr, rtl)
 * - Headings (h1-h6)
 * - Lists (bullet, number, and interactive check/todo lists)
 * - Quotes, Code blocks (with syntax language), Links, Images, Tables, Horizontal Rules, Line breaks, and Tabs.
 */
declare function lexicalToHtml(node: any, options?: LexicalHtmlOptions): string;
/**
 * Extracts pure, unformatted text from a Lexical AST.
 * Useful for excerpt cards, notification previews, and meta tags.
 */
declare function lexicalToText(node: any): string;
/**
 * Alias for lexicalToText.
 */
declare const lexicalToPlainText: typeof lexicalToText;
/**
 * Deserializes an HTML string into a valid Lexical EditorState AST.
 * Works seamlessly in browser DOM and in Node.js environments.
 *
 * @see https://lexical.dev/docs/serialization#html---lexical
 */
declare function htmlToLexical(html: string): SerializedEditorState;
/**
 * Automatically wraps plain strings or HTML into a valid Lexical rich-text JSON object.
 * If already a Lexical object, returns it unchanged.
 * Ensures 100% compatibility with backend LexicalFormatValidator.
 */
declare function toLexical(content: string | Record<string, any>): SerializedEditorState;

declare class CrafterError extends Error {
    readonly statusCode: number;
    readonly error?: string;
    readonly details?: Record<string, any>;
    readonly isCrafterError = true;
    constructor(payload: {
        message: string | string[];
        statusCode?: number;
        error?: string;
        details?: Record<string, any>;
    });
    static fromResponse(statusCode: number, data: any): CrafterError;
}
declare function isCrafterError(err: unknown): err is CrafterError;

declare class Crafter {
    readonly config: CrafterConfig;
    readonly http: HttpClient;
    readonly events: EventEmitter;
    readonly auth: AuthModule;
    readonly users: UsersModule;
    readonly store: StoreModule;
    readonly cart: CartModule;
    readonly marketplace: CartModule;
    readonly chest: ChestModule;
    readonly tickets: TicketsModule;
    readonly posts: PostsModule;
    readonly pages: PagesModule;
    readonly coupons: CouponsModule;
    readonly redeemCode: RedeemCodeModule;
    readonly redeemCodes: RedeemCodeModule;
    readonly servers: ServersModule;
    readonly payments: PaymentsModule;
    readonly statistics: StatisticsModule;
    readonly punishments: PunishmentsModule;
    readonly vote: VoteModule;
    readonly legal: LegalModule;
    readonly reports: ReportsModule;
    readonly forum: ForumModule;
    readonly helpcenter: HelpcenterModule;
    readonly staffForms: StaffFormsModule;
    readonly search: SearchModule;
    readonly seo: SeoModule;
    readonly luckperms: LuckPermsModule;
    readonly website: WebsiteModule;
    readonly utils: {
        lexicalToHtml: typeof lexicalToHtml;
        lexicalToText: typeof lexicalToText;
        lexicalToPlainText: typeof lexicalToText;
        toLexical: typeof toLexical;
        htmlToLexical: typeof htmlToLexical;
        isLexicalFormat: typeof isLexicalFormat;
        formats: {
            IS_BOLD: number;
            IS_ITALIC: number;
            IS_STRIKETHROUGH: number;
            IS_UNDERLINE: number;
            IS_CODE: number;
            IS_SUBSCRIPT: number;
            IS_SUPERSCRIPT: number;
            IS_HIGHLIGHT: number;
        };
    };
    static readonly utils: {
        lexicalToHtml: typeof lexicalToHtml;
        lexicalToText: typeof lexicalToText;
        lexicalToPlainText: typeof lexicalToText;
        toLexical: typeof toLexical;
        htmlToLexical: typeof htmlToLexical;
        isLexicalFormat: typeof isLexicalFormat;
        formats: {
            IS_BOLD: number;
            IS_ITALIC: number;
            IS_STRIKETHROUGH: number;
            IS_UNDERLINE: number;
            IS_CODE: number;
            IS_SUBSCRIPT: number;
            IS_SUPERSCRIPT: number;
            IS_HIGHLIGHT: number;
        };
    };
    constructor(config?: CrafterConfig);
    on<K extends keyof CrafterEventMap>(event: K, handler: EventHandler<CrafterEventMap[K]>): () => void;
    on(event: string, handler: EventHandler): () => void;
    off<K extends keyof CrafterEventMap>(event: K, handler: EventHandler<CrafterEventMap[K]>): void;
    off(event: string, handler: EventHandler): void;
    once<K extends keyof CrafterEventMap>(event: K, handler: EventHandler<CrafterEventMap[K]>): () => void;
    once(event: string, handler: EventHandler): void;
    emit<K extends keyof CrafterEventMap>(event: K, payload?: CrafterEventMap[K]): void;
    emit(event: string, payload?: any): void;
}

// @ts-ignore
export = Crafter;
export { type Auth2FaRequiredResponse, type AuthEmailVerificationRequiredResponse, AuthModule, type AuthResponse, type AuthSuccessResponse, type BulkDiscountConfig, CartModule, type Category, type ChangePasswordDto, type CheckPaymentResponse, type ChestItem, ChestModule, type ChestProductSummary, type CouponResponse, CouponsModule, Crafter, type CrafterApiError, type CrafterConfig, CrafterError, type CrafterEventMap, type CrafterEventName, type CreateReportDto, type CreateTicketDto, type DisableTwoFactorDto, type DiscordStatusData, type DiscordStatusResponse, EventEmitter, type EventHandler, type ForumCategory, type ForumMessage, type ForumMessageReply, ForumModule, type ForumTopic, type GiftChestItemResponse, type HelpArticleItem, type HelpCategoryItem, type HelpFaqItem, type HelpcenterCategoryDetailResponse, HelpcenterModule, type HelpcenterOverviewResponse, HttpClient, IS_BOLD, IS_CODE, IS_HIGHLIGHT, IS_ITALIC, IS_STRIKETHROUGH, IS_SUBSCRIPT, IS_SUPERSCRIPT, IS_UNDERLINE, type InGameAuthDto, type InitiatePaymentDto, type InitiatePaymentResponse, type InitiatePaymentUser, type LatestPayment, type LatestPurchase, type LatestSignup, type LegalDocuments, LegalModule, type LexicalHtmlOptions, type LightweightBalanceResponse, type LikePostResponse, type LikeTopicResponse, LuckPermsModule, type LuckPermsPermissionNode, type LuckPermsPlayerData, type MarketplaceConfig, type PageItem, PagesModule, type PaginatedPostsResponse, type PaginatedPunishmentsResponse, PaymentsModule, type PostAuthor, type PostItem, type PostQueryDto, PostsModule, type Product, type PublicPaymentProvider, type PunishmentItem, PunishmentsModule, type PurchaseDto, type PurchaseResponse, RedeemCodeModule, type ReplyTicketDto, type ReportResponse, type ReportType, ReportsModule, type RequestOptions, type ResetPasswordDto, SearchModule, type SearchResultItem, type SendBalanceParams, type SendBalanceResponse, SeoModule, type SerializedCodeNode, type SerializedEditorState, type SerializedElementNode, type SerializedHeadingNode, type SerializedHorizontalRuleNode, type SerializedImageNode, type SerializedLexicalNode, type SerializedLinkNode, type SerializedListItemNode, type SerializedListNode, type SerializedQuoteNode, type SerializedRootNode, type SerializedTableCellNode, type SerializedTableNode, type SerializedTableRowNode, type SerializedTextNode, type ServerStatusItem, ServersModule, type SignInDto, type SignUpDto, type SinglePostResponse, type SiteStatistics, type SitemapUrlItem, type StaffFormApplicationResponse, type StaffFormApplicationValue, type StaffFormInput, type StaffFormItem, StaffFormsModule, StatisticsModule, StoreModule, type Ticket, type TicketCategory, type TicketCategoryDetails, type TicketMessage, type TicketMessageSender, TicketsModule, type TopCreditLoader, type TwoFactorStatusResponse, type TwoFactorValidateDto, type UpdateOwnUserDto, type UseChestItemResponse, type UseRedeemCodeResponse, type UserProfile, type UserRole, UsersModule, VoteModule, type VoteProcessResponse, type VoteProviderItem, type WallMessage, type WallMessageReply, type WebsiteInfo, WebsiteModule, type WebsitePluginModule, type WebsiteSeoConfig, htmlToLexical, isCrafterError, isLexicalFormat, lexicalToHtml, lexicalToPlainText, lexicalToText, toLexical };
