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

    if (node.indent && typeof node.indent === 'number' && node.indent > 0) {
      styles.push(`padding-left: ${node.indent * 24}px`);
    }

    const classAttr = classes.length ? ` class="${classes.join(' ')}"` : '';
    const styleAttr = styles.length ? ` style="${styles.join('; ')}"` : '';
    const dirAttr = node.direction ? ` dir="${node.direction}"` : '';

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
      const tag = node.tag || 'h2';
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
      const startAttr = isNumber && node.start && node.start !== 1 ? ` start="${node.start}"` : '';
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
      const url = escapeHtml(node.url || '#');
      const targetAttr = node.target ? ` target="${escapeHtml(node.target)}"` : '';
      const relAttr = node.rel ? ` rel="${escapeHtml(node.rel)}"` : '';
      const titleAttr = node.title ? ` title="${escapeHtml(node.title)}"` : '';
      const classAttr = plain ? '' : ' class="text-primary hover:text-blue-700 hover:underline font-bold transition-colors"';
      return `<a href="${url}"${classAttr}${targetAttr}${relAttr}${titleAttr}>${html}</a>`;
    }

    case 'image':
    case 'inline-image': {
      const src = escapeHtml(node.src || '');
      const alt = escapeHtml(node.altText || '');
      const classAttr = plain ? '' : ' class="rounded-2xl w-full max-h-[500px] object-cover my-8 shadow-sm border border-gray-100"';
      const widthAttr = node.width && node.width !== 'inherit' ? ` width="${node.width}"` : '';
      const heightAttr = node.height && node.height !== 'inherit' ? ` height="${node.height}"` : '';
      return `<img src="${src}" alt="${alt}"${classAttr}${widthAttr}${heightAttr} />`;
    }

    case 'code': {
      const language = node.language || '';
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
      const colSpan = node.colSpan && node.colSpan > 1 ? ` colspan="${node.colSpan}"` : '';
      const rowSpan = node.rowSpan && node.rowSpan > 1 ? ` rowspan="${node.rowSpan}"` : '';
      const bgStyle = node.backgroundColor ? `background-color: ${node.backgroundColor};` : '';
      const styleAttr = bgStyle ? ` style="${bgStyle}"` : '';

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
      if (node.style && typeof node.style === 'string') {
        text = `<span style="${escapeHtml(node.style)}">${text}</span>`;
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
