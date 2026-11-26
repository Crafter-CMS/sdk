import { CrafterConfig, CrafterEventMap } from './types';
import { HttpClient } from './core/http';
import { EventEmitter, EventHandler } from './core/events';
import { AuthModule } from './modules/auth';
import { UsersModule } from './modules/users';
import { StoreModule } from './modules/store';
import { CartModule } from './modules/cart';
import { ChestModule } from './modules/chest';
import { TicketsModule } from './modules/tickets';
import { PostsModule } from './modules/posts';
import { PagesModule } from './modules/pages';
import { CouponsModule } from './modules/coupons';
import { RedeemCodeModule } from './modules/redeemCode';
import { ServersModule } from './modules/servers';
import { PaymentsModule } from './modules/payments';
import { StatisticsModule } from './modules/statistics';
import { PunishmentsModule } from './modules/punishments';
import { VoteModule } from './modules/vote';
import { LegalModule } from './modules/legal';
import { ReportsModule } from './modules/reports';
import { ForumModule } from './modules/forum';
import { HelpcenterModule } from './modules/helpcenter';
import { StaffFormsModule } from './modules/staffForms';
import { SearchModule } from './modules/search';
import { SeoModule } from './modules/seo';
import { LuckPermsModule } from './modules/luckperms';
import { WebsiteModule } from './modules/website';
import { LicensesModule } from './modules/licenses';
import { CurrenciesModule } from './modules/currencies';
import { MoneyModule } from './modules/money';
import { LocalizationModule } from './modules/localization';
import { SectionsModule } from './modules/sections';
import { CrafterPageContext, readPageContext } from './core/context';
import { DomEvents, DOM_EVENTS } from './core/dom-events';
import { SDK_VERSION } from './version';
import { formatMoney } from './utils/money';
import {
  lexicalToHtml,
  lexicalToText,
  lexicalToPlainText,
  toLexical,
  htmlToLexical,
  isLexicalFormat,
  IS_BOLD,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_UNDERLINE,
  IS_CODE,
  IS_SUBSCRIPT,
  IS_SUPERSCRIPT,
  IS_HIGHLIGHT,
} from './utils/lexical';

/** `crafter.checkout()` seçenekleri */
export interface CheckoutNavigateOptions {
  /** 'cart' (varsayılan): sepet ödemesi; 'balance': bakiye yükleme */
  purpose?: 'cart' | 'balance';
  /** Bakiye yüklemede önerilen tutar (mağaza para biriminde) */
  amount?: number;
  /** false: gezinmez, yalnızca adresi döner */
  navigate?: boolean;
}

/** Headless (direct) modda varsayılan API adresi */
const DIRECT_API_BASE = 'https://api.crafter.net.tr';

/** Önizleme / editör parametreleri checkout'a taşınır (tema önizlemesi doğru mağaza temasıyla açılsın) */
const PREVIEW_PARAMS = ['themeId', 'preview_theme_id', 'preview_ts', 'preview_token'];

export class Crafter {
  public static readonly version = SDK_VERSION;
  public readonly version = SDK_VERSION;
  public readonly config: CrafterConfig;
  public readonly http: HttpClient;
  public readonly events: EventEmitter;
  /** `document` olayları: `crafter.dom.on('cart:updated', fn)` */
  public readonly dom: DomEvents;
  /** Sayfa bağlamı (storefront'un yazdığı `window.__CRAFTER_CONTEXT__`); yoksa null */
  public readonly context: CrafterPageContext | null;
  public readonly money: MoneyModule;
  public readonly localization: LocalizationModule;
  public readonly sections: SectionsModule;

  public readonly auth: AuthModule;
  public readonly users: UsersModule;
  public readonly store: StoreModule;
  public readonly cart: CartModule;
  public readonly marketplace: CartModule;
  public readonly chest: ChestModule;
  public readonly tickets: TicketsModule;
  public readonly posts: PostsModule;
  public readonly pages: PagesModule;
  public readonly coupons: CouponsModule;
  public readonly redeemCode: RedeemCodeModule;
  public readonly redeemCodes: RedeemCodeModule;
  public readonly servers: ServersModule;
  public readonly payments: PaymentsModule;
  public readonly statistics: StatisticsModule;
  public readonly punishments: PunishmentsModule;
  public readonly vote: VoteModule;
  public readonly legal: LegalModule;
  public readonly reports: ReportsModule;
  public readonly forum: ForumModule;
  public readonly helpcenter: HelpcenterModule;
  public readonly staffForms: StaffFormsModule;
  public readonly search: SearchModule;
  public readonly seo: SeoModule;
  public readonly luckperms: LuckPermsModule;
  public readonly website: WebsiteModule;
  public readonly licenses: LicensesModule;
  public readonly currencies: CurrenciesModule;

  public readonly utils = {
    lexicalToHtml,
    lexicalToText,
    lexicalToPlainText,
    toLexical,
    htmlToLexical,
    isLexicalFormat,
    formatMoney,
    formats: {
      IS_BOLD,
      IS_ITALIC,
      IS_STRIKETHROUGH,
      IS_UNDERLINE,
      IS_CODE,
      IS_SUBSCRIPT,
      IS_SUPERSCRIPT,
      IS_HIGHLIGHT,
    },
  };

  public static readonly utils = {
    lexicalToHtml,
    lexicalToText,
    lexicalToPlainText,
    toLexical,
    htmlToLexical,
    isLexicalFormat,
    formatMoney,
    formats: {
      IS_BOLD,
      IS_ITALIC,
      IS_STRIKETHROUGH,
      IS_UNDERLINE,
      IS_CODE,
      IS_SUBSCRIPT,
      IS_SUPERSCRIPT,
      IS_HIGHLIGHT,
    },
  };

  constructor(config: CrafterConfig = {}) {
    // Varsayılan adres moda göre: direct → https://api.crafter.net.tr, storefront → /api/storefront (HttpClient ile aynı kural)
    const mode = config.mode || (config.websiteId ? 'direct' : 'storefront');
    this.config = {
      mode,
      apiBase: mode === 'direct' ? DIRECT_API_BASE : '/api/storefront',
      ...config,
    };

    this.context = this.config.context ?? null;
    this.events = new EventEmitter();
    this.dom = new DomEvents(this.events);
    this.http = new HttpClient(this.config);
    const getContext = () => this.context;
    this.money = new MoneyModule(getContext);
    this.localization = new LocalizationModule(getContext, this.dom);
    this.sections = new SectionsModule();

    this.auth = new AuthModule(this.http, this.events);
    this.users = new UsersModule(this.http, this.events);
    this.store = new StoreModule(this.http, this.events);
    
    // Storefront sepet uçları (#434) bağlamdan; yoksa (headless, eski storefront) localStorage
    const cartModule = new CartModule(this.http, this.events, this.config, {
      dom: this.dom,
      storeCurrency: () => this.money.storeCurrency,
      cartApi: this.context?.routes?.cartApi ?? null,
      locale: () => this.context?.locale,
    });
    this.cart = cartModule;
    this.marketplace = cartModule;

    this.chest = new ChestModule(this.http, this.events);
    this.tickets = new TicketsModule(this.http, this.events);
    this.posts = new PostsModule(this.http, this.events);
    this.pages = new PagesModule(this.http, this.events);
    this.coupons = new CouponsModule(this.http, this.events);

    const redeemModule = new RedeemCodeModule(this.http, this.events);
    this.redeemCode = redeemModule;
    this.redeemCodes = redeemModule;

    this.servers = new ServersModule(this.http, this.events);
    this.payments = new PaymentsModule(this.http, this.events, this.config);
    this.statistics = new StatisticsModule(this.http, this.events);
    this.punishments = new PunishmentsModule(this.http, this.events);
    this.vote = new VoteModule(this.http, this.events);
    this.legal = new LegalModule(this.http, this.events);
    this.reports = new ReportsModule(this.http, this.events);
    this.forum = new ForumModule(this.http, this.events);
    this.helpcenter = new HelpcenterModule(this.http, this.events);
    this.staffForms = new StaffFormsModule(this.http, this.events);
    this.search = new SearchModule(this.http, this.events);
    this.seo = new SeoModule(this.http, this.events);
    this.luckperms = new LuckPermsModule(this.http, this.events);
    this.website = new WebsiteModule(this.http, this.events);
    this.licenses = new LicensesModule(this.http, this.events);
    this.currencies = new CurrenciesModule(this.http, this.events, this.config);
  }

  /**
   * Checkout sayfasına gider (#447). Sepet için `/checkout?purpose=cart`; checkout dil önekiyle açılmaz,
   * dili gelinen sayfadan okur. Adres sayfa bağlamından (`routes.checkout`) gelir.
   */
  public checkout(options: CheckoutNavigateOptions = {}): string {
    const params = new URLSearchParams();
    params.set('purpose', options.purpose === 'balance' ? 'balance' : 'cart');
    if (options.purpose === 'balance' && Number(options.amount) > 0) params.set('amount', String(options.amount));
    const hasWindow = typeof window !== 'undefined' && !!window.location;
    if (hasWindow) {
      const current = new URLSearchParams(window.location.search);
      for (const key of PREVIEW_PARAMS) {
        const value = current.get(key);
        if (value) params.set(key, value);
      }
    }
    const base = this.context?.routes?.checkout || '/checkout';
    const url = `${base}?${params.toString()}`;
    if (options.navigate !== false && hasWindow) window.location.assign(url);
    return url;
  }

  /**
   * Tarayıcı derlemesinin (IIFE) otomatik başlatması (#447). Sayfada `window.__CRAFTER_CONTEXT__` varsa
   * `window.Crafter` bu bağlamla kurulmuş örnek olur ve `document`'a `crafter:ready` yayılır; yoksa null döner
   * (`window.Crafter` sınıf olarak kalır, `new Crafter({...})` eskisi gibi çalışır). İkinci çağrı aynı örneği döner.
   */
  public static autoInit(win: any = typeof window !== 'undefined' ? window : undefined): Crafter | null {
    const context = readPageContext(win);
    if (!win || !context) return null;
    if (win.Crafter instanceof Crafter) return win.Crafter;
    const crafter = new Crafter({
      mode: 'storefront',
      apiBase: context.apiBase || '/api/storefront',
      websiteId: context.websiteId,
      context,
    });
    win.Crafter = crafter;
    const doc = win.document;
    if (doc && typeof doc.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
      doc.dispatchEvent(new CustomEvent(DOM_EVENTS.ready, { detail: crafter }));
    }
    return crafter;
  }

  // ===================== Event Shorthands =====================

  public on<K extends keyof CrafterEventMap>(event: K, handler: EventHandler<CrafterEventMap[K]>): () => void;
  public on(event: string, handler: EventHandler): () => void;
  public on(event: string, handler: EventHandler): () => void {
    return this.events.on(event, handler);
  }

  public off<K extends keyof CrafterEventMap>(event: K, handler: EventHandler<CrafterEventMap[K]>): void;
  public off(event: string, handler: EventHandler): void;
  public off(event: string, handler: EventHandler): void {
    this.events.off(event, handler);
  }

  public once<K extends keyof CrafterEventMap>(event: K, handler: EventHandler<CrafterEventMap[K]>): () => void;
  public once(event: string, handler: EventHandler): void;
  public once(event: string, handler: EventHandler): () => void {
    return this.events.once(event, handler);
  }

  public emit<K extends keyof CrafterEventMap>(event: K, payload?: CrafterEventMap[K]): void;
  public emit(event: string, payload?: any): void;
  public emit(event: string, payload?: any): void {
    this.events.emit(event, payload);
  }
}

// Exports
export default Crafter;
export * from './types';
export * from './core/errors';
export * from './core/events';
export * from './core/http';
export * from './modules/auth';
export * from './modules/users';
export * from './modules/store';
export * from './modules/cart';
export * from './modules/chest';
export * from './modules/tickets';
export * from './modules/posts';
export * from './modules/pages';
export * from './modules/coupons';
export * from './modules/redeemCode';
export * from './modules/servers';
export * from './modules/payments';
export * from './modules/statistics';
export * from './modules/punishments';
export * from './modules/vote';
export * from './modules/legal';
export * from './modules/reports';
export * from './modules/forum';
export * from './modules/helpcenter';
export * from './modules/staffForms';
export * from './modules/search';
export * from './modules/seo';
export * from './modules/luckperms';
export * from './modules/website';
export * from './modules/licenses';
export * from './modules/currencies';
export * from './modules/money';
export * from './modules/localization';
export * from './modules/sections';
export * from './modules/cart-store';
export * from './modules/cart-server';
export * from './core/context';
export * from './core/dom-events';
export * from './version';
export * from './utils/money';
export * from './utils/lexical';
