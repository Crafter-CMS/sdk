/**
 * Official Lexical Format Bitmask Flags
 * @see https://lexical.dev/docs/concepts/nodes
 */
export const IS_BOLD = 1; // 1 << 0
export const IS_ITALIC = 2; // 1 << 1
export const IS_STRIKETHROUGH = 4; // 1 << 2
export const IS_UNDERLINE = 8; // 1 << 3
export const IS_CODE = 16; // 1 << 4
export const IS_SUBSCRIPT = 32; // 1 << 5
export const IS_SUPERSCRIPT = 64; // 1 << 6
export const IS_HIGHLIGHT = 128; // 1 << 7

// ===================== Lexical AST Types =====================

export interface SerializedLexicalNode {
  type: string;
  version: number;
  [key: string]: any;
}

export interface SerializedTextNode extends SerializedLexicalNode {
  type: 'text';
  text: string;
  format: number;
  detail: number;
  mode: 'normal' | 'token' | 'segmented';
  style: string;
}

export interface SerializedElementNode extends SerializedLexicalNode {
  children: SerializedLexicalNode[];
  direction: 'ltr' | 'rtl' | null;
  format: 'left' | 'start' | 'center' | 'right' | 'end' | 'justify' | '';
  indent: number;
}

export interface SerializedHeadingNode extends SerializedElementNode {
  type: 'heading';
  tag: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export interface SerializedListNode extends SerializedElementNode {
  type: 'list';
  listType: 'bullet' | 'number' | 'check';
  start?: number;
  tag: 'ol' | 'ul';
}

export interface SerializedListItemNode extends SerializedElementNode {
  type: 'listitem';
  value?: number;
  checked?: boolean;
}

export interface SerializedLinkNode extends SerializedElementNode {
  type: 'link' | 'autolink';
  url: string;
  target?: string | null;
  rel?: string | null;
  title?: string | null;
}

export interface SerializedQuoteNode extends SerializedElementNode {
  type: 'quote';
}

export interface SerializedCodeNode extends SerializedElementNode {
  type: 'code';
  language?: string | null;
}

export interface SerializedTableNode extends SerializedElementNode {
  type: 'table';
}

export interface SerializedTableRowNode extends SerializedElementNode {
  type: 'tablerow';
}

export interface SerializedTableCellNode extends SerializedElementNode {
  type: 'tablecell';
  colSpan?: number;
  rowSpan?: number;
  width?: number;
  headerState?: number;
  backgroundColor?: string | null;
}

export interface SerializedHorizontalRuleNode extends SerializedLexicalNode {
  type: 'horizontalrule';
}

export interface SerializedImageNode extends SerializedLexicalNode {
  type: 'image' | 'inline-image';
  src: string;
  altText?: string;
  width?: number | 'inherit';
  height?: number | 'inherit';
  maxWidth?: number;
  caption?: SerializedEditorState;
}

export interface SerializedEditorState {
  root: SerializedRootNode;
}

export interface SerializedRootNode extends SerializedElementNode {
  type: 'root';
}

export interface LexicalHtmlOptions {
  /**
   * If true, generates clean semantic HTML without pre-baked Tailwind/theme utility classes.
   * Default: false (includes standard Crafter storefront theme classes).
   */
  plainSemantic?: boolean;
}

// ===================== Lexical Verification =====================

/**
 * Checks if an object conforms to official Lexical serialized EditorState AST format.
 * @see https://lexical.dev/docs/serialization
 */
export function isLexicalFormat(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (!obj.root || typeof obj.root !== 'object') return false;
  if (obj.root.type !== 'root') return false;
  if (!Array.isArray(obj.root.children)) return false;
  return true;
}

// ===================== AST -> HTML Converter =====================

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
export function lexicalToHtml(node: any, options?: LexicalHtmlOptions): string {
  if (!node) return '';

  if (typeof node === 'string') {
    try {
      node = JSON.parse(node);
    } catch {
      return escapeHtml(node);
    }
  }

  // Root wrapper
  if (node.root) {
    return lexicalToHtml(node.root, options);
  }

  // Arrays of children
  if (Array.isArray(node)) {
    return node.map((n) => lexicalToHtml(n, options)).join('');
  }

  const type = node.type;
  let html = '';

  if (node.children) {
    html = lexicalToHtml(node.children, options);
  }

  const plain = options?.plainSemantic === true;

  // Style attributes helper (alignment, indent, direction)
  const getBlockAttributes = (defaultClasses: string = ''): { classAttr: string; styleAttr: string; dirAttr: string } => {
    const styles: string[] = [];
    const classes: string[] = plain ? [] : defaultClasses ? [defaultClasses] : [];

    if (node.format) {
      if (node.format === 'center') {
        plain ? styles.push('text-align: center') : classes.push('text-center');
      } else if (node.format === 'right') {
        plain ? styles.push('text-align: right') : classes.push('text-right');
      } else if (node.format === 'justify') {
        plain ? styles.push('text-align: justify') : classes.push('text-justify');
      } else if (node.format === 'left' || node.format === 'start') {
        plain ? styles.push('text-align: left') : classes.push('text-left');
      }
    }

    const indent = toPositiveInt(node.indent, 20);
    if (indent) {
      styles.push(`padding-left: ${indent * 24}px`);
    }

    const classAttr = classes.length ? ` class="${classes.join(' ')}"` : '';
    const styleAttr = styles.length ? ` style="${styles.join('; ')}"` : '';
    // Only the two values Lexical emits; anything else is dropped (attribute injection guard)
    const dirAttr = node.direction === 'ltr' || node.direction === 'rtl' ? ` dir="${node.direction}"` : '';

    return { classAttr, styleAttr, dirAttr };
  };

  switch (type) {
    case 'root':
      return html;

    case 'paragraph': {
      const { classAttr, styleAttr, dirAttr } = getBlockAttributes(
        'mb-4 text-gray-700 leading-relaxed text-[15px]'
      );
      return `<p${classAttr}${styleAttr}${dirAttr}>${html}</p>`;
    }

    case 'heading': {
      // The tag is interpolated into markup, so it must come from a fixed allowlist
      const tag = HEADING_TAGS.includes(node.tag) ? node.tag : 'h2';
      const defaultClasses =
        tag === 'h1'
          ? 'text-3xl font-black mb-6 mt-8 tracking-tight text-gray-900'
          : tag === 'h2'
          ? 'text-2xl font-bold mb-4 mt-6 tracking-tight text-gray-900'
          : tag === 'h3'
          ? 'text-xl font-bold mb-3 mt-5 text-gray-900'
          : 'text-lg font-bold mb-3 mt-4 text-gray-900';

      const { classAttr, styleAttr, dirAttr } = getBlockAttributes(defaultClasses);
      return `<${tag}${classAttr}${styleAttr}${dirAttr}>${html}</${tag}>`;
    }

    case 'list': {
      const isCheckList = node.listType === 'check';
      const isNumber = node.listType === 'number';
      const listTag = isNumber ? 'ol' : 'ul';

      const defaultClasses = isCheckList
        ? 'space-y-2 mb-5 list-none'
        : isNumber
        ? 'list-decimal list-inside mb-5 space-y-2 text-gray-700'
        : 'list-disc list-inside mb-5 space-y-2 text-gray-700';

      const { classAttr, styleAttr, dirAttr } = getBlockAttributes(defaultClasses);
      const start = toPositiveInt(node.start);
      const startAttr = isNumber && start && start !== 1 ? ` start="${start}"` : '';
      return `<${listTag}${classAttr}${styleAttr}${dirAttr}${startAttr}>${html}</${listTag}>`;
    }

    case 'listitem': {
      if (node.checked !== undefined) {
        // Checklist item
        const isChecked = Boolean(node.checked);
        const checkbox = `<input type="checkbox" disabled ${isChecked ? 'checked ' : ''}class="mr-2 inline-block rounded" />`;
        const content = plain ? html : `<span class="${isChecked ? 'line-through text-gray-400' : 'text-gray-700'}">${html}</span>`;
        return `<li class="flex items-center space-x-2 my-1" data-checked="${isChecked}">${checkbox}${content}</li>`;
      }
      return `<li>${html}</li>`;
    }

    case 'quote': {
      const { classAttr, styleAttr, dirAttr } = getBlockAttributes(
        'border-l-4 border-primary pl-5 italic my-6 text-gray-600 bg-blue-50/50 py-3 pr-4 rounded-r-2xl'
      );
      return `<blockquote${classAttr}${styleAttr}${dirAttr}>${html}</blockquote>`;
    }

    case 'link':
    case 'autolink': {
      const url = escapeHtml(sanitizeUrl(node.url, 'link') ?? '#');
      const target = typeof node.target === 'string' ? node.target.trim().toLowerCase() : '';
      const safeTarget = LINK_TARGETS.includes(target) ? target : '';
      const targetAttr = safeTarget ? ` target="${safeTarget}"` : '';
      const rel = buildRel(node.rel, safeTarget === '_blank');
      const relAttr = rel ? ` rel="${escapeHtml(rel)}"` : '';
      const titleAttr = node.title ? ` title="${escapeHtml(String(node.title))}"` : '';
      const classAttr = plain ? '' : ' class="text-primary hover:text-blue-700 hover:underline font-bold transition-colors"';
      return `<a href="${url}"${classAttr}${targetAttr}${relAttr}${titleAttr}>${html}</a>`;
    }

    case 'image':
    case 'inline-image': {
      const safeSrc = sanitizeUrl(node.src, 'image');
      // An image with an unsafe or missing source is not rendered at all
      if (!safeSrc) return '';
      const src = escapeHtml(safeSrc);
      const alt = escapeHtml(node.altText || '');
      const classAttr = plain ? '' : ' class="rounded-2xl w-full max-h-[500px] object-cover my-8 shadow-sm border border-gray-100"';
      const width = toPositiveInt(node.width);
      const height = toPositiveInt(node.height);
      const widthAttr = width ? ` width="${width}"` : '';
      const heightAttr = height ? ` height="${height}"` : '';
      return `<img src="${src}" alt="${alt}"${classAttr}${widthAttr}${heightAttr} />`;
    }

    case 'code': {
      const language = typeof node.language === 'string' && /^[A-Za-z0-9_+#.-]{1,32}$/.test(node.language) ? node.language : '';
      const langClass = language ? ` class="language-${escapeHtml(language)}"` : '';
      const preClass = plain ? '' : ' class="bg-gray-900 text-gray-100 p-5 rounded-2xl overflow-x-auto my-6 text-sm font-mono shadow-lg"';
      return `<pre${preClass}><code${langClass}>${html}</code></pre>`;
    }

    case 'code-highlight': {
      return html;
    }

    case 'table': {
      const tableClass = plain ? '' : ' class="w-full my-6 border-collapse border border-gray-200 shadow-sm rounded-lg overflow-hidden"';
      return `<div class="overflow-x-auto"><table${tableClass}><tbody>${html}</tbody></table></div>`;
    }

    case 'tablerow': {
      const trClass = plain ? '' : ' class="border-b border-gray-200 even:bg-gray-50/50"';
      return `<tr${trClass}>${html}</tr>`;
    }

    case 'tablecell': {
      const isHeader = Boolean(node.headerState && node.headerState > 0);
      const cellTag = isHeader ? 'th' : 'td';
      const colSpanValue = toPositiveInt(node.colSpan, 1000);
      const rowSpanValue = toPositiveInt(node.rowSpan, 65534);
      const colSpan = colSpanValue && colSpanValue > 1 ? ` colspan="${colSpanValue}"` : '';
      const rowSpan = rowSpanValue && rowSpanValue > 1 ? ` rowspan="${rowSpanValue}"` : '';
      const bgColor = sanitizeCssColor(node.backgroundColor);
      const styleAttr = bgColor ? ` style="${escapeHtml(`background-color: ${bgColor};`)}"` : '';

      const cellClass = plain
        ? ''
        : isHeader
        ? ' class="px-4 py-3 text-left font-bold text-gray-900 bg-gray-100 border border-gray-200"'
        : ' class="px-4 py-3 text-gray-700 border border-gray-200"';

      return `<${cellTag}${cellClass}${colSpan}${rowSpan}${styleAttr}>${html}</${cellTag}>`;
    }

    case 'horizontalrule':
    case 'hr': {
      const hrClass = plain ? '' : ' class="my-8 border-t border-gray-200"';
      return `<hr${hrClass} />`;
    }

    case 'linebreak':
      return `<br />`;

    case 'tab':
      return `<span style="white-space: pre-wrap;">\t</span>`;

    case 'text': {
      let text = escapeHtml(node.text || '');

      const format = node.format || 0;

      // Lexical official bitmask operators:
      if (format & IS_BOLD) {
        text = plain ? `<strong>${text}</strong>` : `<strong class="font-bold text-gray-900">${text}</strong>`;
      }
      if (format & IS_ITALIC) {
        text = `<em>${text}</em>`;
      }
      if (format & IS_STRIKETHROUGH) {
        text = `<s>${text}</s>`;
      }
      if (format & IS_UNDERLINE) {
        text = `<u>${text}</u>`;
      }
      if (format & IS_CODE) {
        text = plain
          ? `<code>${text}</code>`
          : `<code class="bg-gray-100 text-pink-600 px-1.5 py-0.5 rounded-lg text-sm font-mono border border-gray-200">${text}</code>`;
      }
      if (format & IS_SUBSCRIPT) {
        text = `<sub>${text}</sub>`;
      }
      if (format & IS_SUPERSCRIPT) {
        text = `<sup>${text}</sup>`;
      }
      if (format & IS_HIGHLIGHT) {
        text = `<mark class="bg-yellow-200 px-1 rounded">${text}</mark>`;
      }

      // Inline styles (e.g. custom color or font size)
      const style = sanitizeInlineStyle(node.style);
      if (style) {
        text = `<span style="${escapeHtml(style)}">${text}</span>`;
      }

      return text;
    }

    default:
      return html || escapeHtml(node.text || '');
  }
}

// ===================== AST -> Plain Text Extractor =====================

/**
 * Extracts pure, unformatted text from a Lexical AST.
 * Useful for excerpt cards, notification previews, and meta tags.
 */
export function lexicalToText(node: any): string {
  if (!node) return '';

  if (typeof node === 'string') {
    try {
      node = JSON.parse(node);
    } catch {
      return node;
    }
  }

  if (node.root) {
    return lexicalToText(node.root);
  }

  if (Array.isArray(node)) {
    return node.map((n) => lexicalToText(n)).join('');
  }

  const type = node.type;
  let text = '';

  if (node.children) {
    text = lexicalToText(node.children);
  }

  switch (type) {
    case 'text':
      return node.text || '';
    case 'paragraph':
    case 'heading':
    case 'listitem':
    case 'quote':
      return text ? text + ' ' : '';
    case 'tablerow':
      return text ? text + '\n' : '';
    case 'linebreak':
      return '\n';
    case 'tab':
      return '\t';
    default:
      return text || node.text || '';
  }
}

/**
 * Alias for lexicalToText.
 */
export const lexicalToPlainText = lexicalToText;

// ===================== HTML -> Lexical AST Deserializer =====================

/**
 * Deserializes an HTML string into a valid Lexical EditorState AST.
 * Works seamlessly in browser DOM and in Node.js environments.
 *
 * @see https://lexical.dev/docs/serialization#html---lexical
 */
export function htmlToLexical(html: string): SerializedEditorState {
  if (!html || typeof html !== 'string') {
    return createEmptyLexicalRoot();
  }

  // 1. In browser environments: use native DOMParser for 100% precision
  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    try {
      const parser = new window.DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const children: SerializedLexicalNode[] = [];

      for (let i = 0; i < doc.body.childNodes.length; i++) {
        const node = domNodeToLexicalNode(doc.body.childNodes[i]);
        if (node) {
          if (Array.isArray(node)) {
            children.push(...node);
          } else {
            children.push(node);
          }
        }
      }

      return {
        root: {
          type: 'root',
          format: '',
          indent: 0,
          version: 1,
          direction: null,
          children: children.length ? children : [createEmptyParagraph()],
        },
      };
    } catch {
      // fallback to regex parser below
    }
  }

  // 2. Headless/Node.js fallback: Clean tag-based AST conversion
  return fallbackHtmlToLexical(html);
}

// ===================== Universal String -> Lexical Wrapper =====================

/**
 * Automatically wraps plain strings or HTML into a valid Lexical rich-text JSON object.
 * If already a Lexical object, returns it unchanged.
 * Ensures 100% compatibility with backend LexicalFormatValidator.
 */
export function toLexical(content: string | Record<string, any>): SerializedEditorState {
  if (isLexicalFormat(content)) {
    return content as SerializedEditorState;
  }

  const raw = String(content ?? '');

  // If content contains HTML tags, deserialize using htmlToLexical
  if (/<[a-z][\s\S]*>/i.test(raw)) {
    return htmlToLexical(raw);
  }

  // Otherwise, split lines into standard Lexical paragraphs
  const lines = raw.split('\n');

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: null,
      children: lines.map((line) => ({
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: null,
        children: [
          {
            type: 'text',
            text: line,
            detail: 0,
            format: 0,
            mode: 'normal',
            style: '',
            version: 1,
          },
        ],
      })),
    },
  };
}

// ===================== Internal Helpers =====================

const HEADING_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
const LINK_TARGETS = ['_blank', '_self', '_parent', '_top'];
const LINK_SCHEMES = ['http', 'https', 'mailto', 'tel'];
const IMAGE_SCHEMES = ['http', 'https'];

/** Decodes numeric (`&#58;`, `&#x3a;`) and common named HTML entities, as a browser would in an attribute. */
function decodeEntities(str: string): string {
  const named: Record<string, string> = {
    colon: ':', tab: '\t', newline: '\n', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", sol: '/', nbsp: '\u00a0',
  };
  let out = str;
  // Repeat to defeat double encoding such as `&amp;#58;`
  for (let i = 0; i < 3; i++) {
    const next = out.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, ent: string) => {
      if (ent[0] === '#') {
        const code = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
        return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
      }
      const v = named[ent.toLowerCase()];
      return v !== undefined ? v : m;
    });
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * Returns a URL that is safe to place in `href` / `src`, or `null` when it must be dropped.
 * Allowed: http(s) (plus mailto/tel for links), protocol-relative `//host`, relative paths, `?query` and `#anchors`.
 * Anything with another scheme (`javascript:`, `data:`, `vbscript:`, `file:` ...) is rejected. The check runs on a
 * normalized copy: entities decoded, whitespace / control characters removed, lowercased, so `JaVaScRiPt:`,
 * `\tjavascript:`, `java\nscript:` and `javascript&#58;` are all caught. The original (trimmed) value is returned.
 */
function sanitizeUrl(value: unknown, kind: 'link' | 'image' = 'link'): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.replace(/^[\u0000-\u0020\u007f-\u009f\u00a0\u1680\u2000-\u200f\u2028\u2029\u202f\u205f\u3000\ufeff]+|[\u0000-\u0020\u007f-\u009f]+$/g, '');
  if (!trimmed) return null;

  let normalized = decodeEntities(trimmed);
  try {
    // Percent-encoded scheme characters are not decoded by browsers, but decode anyway to be strict
    normalized = decodeURIComponent(normalized);
  } catch {
    // keep as is
  }
  // Browsers strip tab/newline anywhere in a URL and ignore leading control/space characters
  normalized = normalized.replace(/[\u0000-\u0020\u007f-\u009f\u00a0\u1680\u2000-\u200f\u2028\u2029\u202f\u205f\u3000\ufeff]/g, '').toLowerCase();
  if (!normalized) return null;

  const schemeMatch = normalized.match(/^([a-z][a-z0-9+.-]*):/);
  if (schemeMatch) {
    const allowed = kind === 'image' ? IMAGE_SCHEMES : LINK_SCHEMES;
    return allowed.includes(schemeMatch[1]) ? trimmed : null;
  }
  // No scheme: a colon before the first / ? # would make it look like one to a browser after decoding
  const firstColon = normalized.indexOf(':');
  if (firstColon !== -1) {
    const firstDelim = normalized.search(/[/?#\\]/);
    if (firstDelim === -1 || firstColon < firstDelim) return null;
  }
  return trimmed;
}

/** Parses a non-negative integer (number or numeric string) within `max`; anything else yields 0. */
function toPositiveInt(value: unknown, max = 100000): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\s*\d+\s*$/.test(value) ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), max);
}

/** Merges a user rel with `noopener noreferrer` when the link opens a new browsing context. */
function buildRel(rel: unknown, newWindow: boolean): string {
  const tokens = typeof rel === 'string' ? rel.toLowerCase().split(/\s+/).filter((t) => /^[a-z-]+$/.test(t)) : [];
  if (newWindow) {
    if (!tokens.includes('noopener')) tokens.push('noopener');
    if (!tokens.includes('noreferrer')) tokens.push('noreferrer');
  }
  return Array.from(new Set(tokens)).join(' ');
}

/** Accepts only plain CSS colors: hex, rgb()/rgba()/hsl()/hsla() with numeric arguments, or a keyword. */
function sanitizeCssColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(v)) return v;
  if (/^(rgb|rgba|hsl|hsla)\(\s*[\d.%\s,/+-]+\)$/i.test(v)) return v;
  if (/^[a-z]{3,30}$/i.test(v)) return v;
  return null;
}

const STYLE_PROPERTIES: Record<string, 'color' | 'length' | 'keyword' | 'family'> = {
  color: 'color',
  'background-color': 'color',
  'font-size': 'length',
  'line-height': 'length',
  'letter-spacing': 'length',
  'font-family': 'family',
  'font-weight': 'keyword',
  'font-style': 'keyword',
  'text-decoration': 'keyword',
  'text-transform': 'keyword',
  'white-space': 'keyword',
};

/**
 * Keeps only a small set of typographic declarations (the ones the Lexical editor writes for text) with strictly
 * validated values. Drops everything else, including `url()`, `expression()`, `position`, `@import` and escapes.
 */
function sanitizeInlineStyle(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  // Reject CSS escapes and comments outright: they can hide any of the checks below
  if (/[\\<>]|\/\*/.test(value)) return '';
  const out: string[] = [];
  for (const decl of value.split(';')) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    const kind = STYLE_PROPERTIES[prop];
    if (!kind || !val) continue;
    let ok = false;
    if (kind === 'color') ok = sanitizeCssColor(val) !== null;
    else if (kind === 'length') ok = /^(\d+(\.\d+)?)(px|em|rem|%|pt)?$|^normal$/i.test(val);
    else if (kind === 'keyword') ok = /^[a-z0-9 -]{1,40}$/i.test(val);
    else if (kind === 'family') ok = /^[a-z0-9 ,"'_-]{1,100}$/i.test(val);
    if (ok) out.push(`${prop}: ${val}`);
  }
  return out.join('; ');
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function createEmptyParagraph(): SerializedElementNode {
  return {
    type: 'paragraph',
    format: '',
    indent: 0,
    version: 1,
    direction: null,
    children: [],
  };
}

function createEmptyLexicalRoot(): SerializedEditorState {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: null,
      children: [createEmptyParagraph()],
    },
  };
}

/**
 * Maps a browser DOM Node into a Lexical Serialized Node.
 */
function domNodeToLexicalNode(domNode: Node, currentFormat: number = 0): SerializedLexicalNode | SerializedLexicalNode[] | null {
  if (domNode.nodeType === Node.TEXT_NODE) {
    const text = domNode.textContent || '';
    if (!text) return null;
    return {
      type: 'text',
      text,
      format: currentFormat,
      detail: 0,
      mode: 'normal',
      style: '',
      version: 1,
    } as SerializedTextNode;
  }

  if (domNode.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const el = domNode as HTMLElement;
  const tagName = el.tagName.toLowerCase();

  // Text formatting wrappers (accumulate bitmasks)
  let format = currentFormat;
  if (tagName === 'strong' || tagName === 'b') format |= IS_BOLD;
  if (tagName === 'em' || tagName === 'i') format |= IS_ITALIC;
  if (tagName === 's' || tagName === 'del' || tagName === 'strike') format |= IS_STRIKETHROUGH;
  if (tagName === 'u') format |= IS_UNDERLINE;
  if (tagName === 'code' && el.parentElement?.tagName.toLowerCase() !== 'pre') format |= IS_CODE;
  if (tagName === 'sub') format |= IS_SUBSCRIPT;
  if (tagName === 'sup') format |= IS_SUPERSCRIPT;
  if (tagName === 'mark') format |= IS_HIGHLIGHT;

  if (
    ['strong', 'b', 'em', 'i', 's', 'del', 'strike', 'u', 'sub', 'sup', 'mark'].includes(tagName) ||
    (tagName === 'code' && el.parentElement?.tagName.toLowerCase() !== 'pre') ||
    tagName === 'span'
  ) {
    const inlineChildren: SerializedLexicalNode[] = [];
    for (let i = 0; i < el.childNodes.length; i++) {
      const child = domNodeToLexicalNode(el.childNodes[i], format);
      if (child) {
        if (Array.isArray(child)) inlineChildren.push(...child);
        else inlineChildren.push(child);
      }
    }
    return inlineChildren;
  }

  // Process children for block elements
  const children: SerializedLexicalNode[] = [];
  for (let i = 0; i < el.childNodes.length; i++) {
    const child = domNodeToLexicalNode(el.childNodes[i], format);
    if (child) {
      if (Array.isArray(child)) children.push(...child);
      else children.push(child);
    }
  }

  // Heading Node
  if (/^h[1-6]$/.test(tagName)) {
    return {
      type: 'heading',
      tag: tagName as any,
      format: '',
      indent: 0,
      direction: null,
      version: 1,
      children,
    } as SerializedHeadingNode;
  }

  // List Node
  if (tagName === 'ul' || tagName === 'ol') {
    return {
      type: 'list',
      listType: tagName === 'ol' ? 'number' : 'bullet',
      tag: tagName,
      format: '',
      indent: 0,
      direction: null,
      version: 1,
      children,
    } as SerializedListNode;
  }

  // List Item Node
  if (tagName === 'li') {
    return {
      type: 'listitem',
      value: 1,
      format: '',
      indent: 0,
      direction: null,
      version: 1,
      children,
    } as SerializedListItemNode;
  }

  // Quote Node
  if (tagName === 'blockquote') {
    return {
      type: 'quote',
      format: '',
      indent: 0,
      direction: null,
      version: 1,
      children,
    } as SerializedQuoteNode;
  }

  // Link Node
  if (tagName === 'a') {
    return {
      type: 'link',
      url: el.getAttribute('href') || '',
      target: el.getAttribute('target'),
      rel: el.getAttribute('rel'),
      title: el.getAttribute('title'),
      format: '',
      indent: 0,
      direction: null,
      version: 1,
      children,
    } as SerializedLinkNode;
  }

  // Pre / Code Block
  if (tagName === 'pre') {
    const codeEl = el.querySelector('code');
    const lang = codeEl?.className.match(/language-(\w+)/)?.[1] || null;
    const textContent = codeEl ? codeEl.textContent || '' : el.textContent || '';
    return {
      type: 'code',
      language: lang,
      format: '',
      indent: 0,
      direction: null,
      version: 1,
      children: [
        {
          type: 'text',
          text: textContent,
          format: 0,
          detail: 0,
          mode: 'normal',
          style: '',
          version: 1,
        },
      ],
    } as SerializedCodeNode;
  }

  // Image Node
  if (tagName === 'img') {
    return {
      type: 'image',
      src: el.getAttribute('src') || '',
      altText: el.getAttribute('alt') || '',
      version: 1,
    } as SerializedImageNode;
  }

  // Horizontal Rule
  if (tagName === 'hr') {
    return {
      type: 'horizontalrule',
      version: 1,
    } as SerializedHorizontalRuleNode;
  }

  // Line break
  if (tagName === 'br') {
    return {
      type: 'linebreak',
      version: 1,
    };
  }

  // Default Paragraph Node
  return {
    type: 'paragraph',
    format: '',
    indent: 0,
    direction: null,
    version: 1,
    children,
  } as SerializedElementNode;
}

/**
 * Fallback regex-based HTML to Lexical AST parser for headless / Node.js environments.
 */
function fallbackHtmlToLexical(html: string): SerializedEditorState {
  const clean = html
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .replace(/<\/?(html|head|body)[^>]*>/gi, '')
    .trim();

  const blockRegex = /<(p|h[1-6]|ul|ol|blockquote|pre)[\s\S]*?<\/\1>/gi;
  const blocks = clean.match(blockRegex);

  if (!blocks || !blocks.length) {
    const stripped = clean.replace(/<[^>]+>/g, '');
    return {
      root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        direction: null,
        children: [
          {
            type: 'paragraph',
            format: '',
            indent: 0,
            version: 1,
            direction: null,
            children: [
              {
                type: 'text',
                text: stripped,
                format: 0,
                detail: 0,
                mode: 'normal',
                style: '',
                version: 1,
              },
            ],
          },
        ],
      },
    };
  }

  const children: SerializedLexicalNode[] = blocks.map((block) => {
    const match = block.match(/^<([a-z0-9]+)[^>]*>([\s\S]*?)<\/\1>$/i);
    if (!match) {
      return createEmptyParagraph();
    }
    const tag = match[1].toLowerCase();
    const innerHtml = match[2];

    if (/^h[1-6]$/.test(tag)) {
      return {
        type: 'heading',
        tag: tag as any,
        format: '',
        indent: 0,
        direction: null,
        version: 1,
        children: [
          {
            type: 'text',
            text: innerHtml.replace(/<[^>]+>/g, ''),
            format: 0,
            detail: 0,
            mode: 'normal',
            style: '',
            version: 1,
          },
        ],
      } as SerializedHeadingNode;
    }

    if (tag === 'blockquote') {
      return {
        type: 'quote',
        format: '',
        indent: 0,
        direction: null,
        version: 1,
        children: [
          {
            type: 'text',
            text: innerHtml.replace(/<[^>]+>/g, ''),
            format: 0,
            detail: 0,
            mode: 'normal',
            style: '',
            version: 1,
          },
        ],
      } as SerializedQuoteNode;
    }

    // Default paragraph
    return {
      type: 'paragraph',
      format: '',
      indent: 0,
      direction: null,
      version: 1,
      children: [
        {
          type: 'text',
          text: innerHtml.replace(/<[^>]+>/g, ''),
          format: 0,
          detail: 0,
          mode: 'normal',
          style: '',
          version: 1,
        },
      ],
    } as SerializedElementNode;
  });

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: null,
      children,
    },
  };
}
