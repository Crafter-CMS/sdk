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

export class Crafter {
  public readonly config: CrafterConfig;
  public readonly http: HttpClient;
  public readonly events: EventEmitter;

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

  public readonly utils = {
    lexicalToHtml,
    lexicalToText,
    lexicalToPlainText,
    toLexical,
    htmlToLexical,
    isLexicalFormat,
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
    this.config = {
      apiBase: '/api/storefront',
      ...config,
    };

    this.events = new EventEmitter();
    this.http = new HttpClient(this.config);

    this.auth = new AuthModule(this.http, this.events);
    this.users = new UsersModule(this.http, this.events);
    this.store = new StoreModule(this.http, this.events);
    
    const cartModule = new CartModule(this.http, this.events);
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
    this.payments = new PaymentsModule(this.http, this.events);
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
export * from './utils/lexical';
