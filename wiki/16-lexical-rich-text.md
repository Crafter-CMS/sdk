# ✍️ Lexical Rich Text Engine (`crafter.utils`)

Crafter stores and validates post contents, product descriptions, support ticket messages and forum posts in the open-source **Lexical Rich-Text AST** standard developed by Meta (Facebook).

The SDK ships a zero-dependency, two-way Lexical engine that is **100% compatible** with the [official Lexical documentation](https://lexical.dev/docs/intro) and the [serialization standards](https://lexical.dev/docs/serialization).

---

## 📌 Methods and Capabilities

| Method | Direction | Description |
| :--- | :---: | :--- |
| **`crafter.utils.lexicalToHtml(node, options?)`** | **AST ➔ HTML** | Converts a Lexical JSON AST to semantic HTML, handling all formats, alignments and node types. |
| **`crafter.utils.lexicalToText(node)`** | **AST ➔ Text** | Strips all HTML tags from the AST; produces clean text for post excerpts, search and SEO. |
| **`crafter.utils.htmlToLexical(htmlString)`** | **HTML ➔ AST** | Converts raw HTML (with the browser DOMParser or a Node.js engine) into a valid Lexical EditorState AST object. |
| **`crafter.utils.toLexical(content)`** | **Smart resolver** | Whether the input is plain text, HTML or a ready Lexical object, guarantees the valid `SerializedEditorState` output the backend expects. |
| **`crafter.utils.isLexicalFormat(obj)`** | **Validation** | Checks whether an object has a valid Lexical root structure (`root: { type: 'root', children: [...] }`). |

---

## 🧱 Supported Standard Lexical Node Types

1. **Text:**
   * Official Lexical bitmask formatter:
     * `IS_BOLD (1)` ➔ `<strong>`
     * `IS_ITALIC (2)` ➔ `<em>`
     * `IS_STRIKETHROUGH (4)` ➔ `<s>`
     * `IS_UNDERLINE (8)` ➔ `<u>`
     * `IS_CODE (16)` ➔ `<code>`
     * `IS_SUBSCRIPT (32)` ➔ `<sub>`
     * `IS_SUPERSCRIPT (64)` ➔ `<sup>`
     * `IS_HIGHLIGHT (128)` ➔ `<mark>`
   * `style` field (custom color, font size) ➔ `<span style="...">`
2. **Paragraph & Heading:**
   * `h1`, `h2`, `h3`, `h4`, `h5`, `h6`
   * Alignment formats: `left`, `center`, `right`, `justify`, `start`, `end`
   * Indent support (`indent`): `padding-left: indent * 24px`
   * Text direction (`direction`): `dir="ltr"` / `dir="rtl"`
3. **Lists:**
   * Unordered (`bullet` ➔ `<ul>`)
   * Ordered (`number` ➔ `<ol start="...">`)
   * **Interactive checklists (`check`):** `data-checked="true/false"` and `<input type="checkbox" disabled />`
4. **Tables:**
   * `table`, `tablerow`, `tablecell`
   * Header cell (`th`) and data cell (`td`) distinction
   * `colSpan`, `rowSpan` and `backgroundColor` support
5. **Block Node Types:**
   * `quote` ➔ `<blockquote>`
   * `code` ➔ `<pre><code class="language-...">` (with the syntax language)
   * `link` & `autolink` ➔ `<a href="..." target="..." rel="..." title="...">`
   * `image` & `inline-image` ➔ `<img src="..." alt="..." width="..." height="..." />`
   * `horizontalrule` / `hr` ➔ `<hr />`
   * `linebreak` ➔ `<br />`
   * `tab` ➔ `<span style="white-space: pre-wrap;">\t</span>`

---

## 💡 Practical Usage Examples

### 1. Rendering a Post Fetched via AJAX as HTML
```javascript
const post = await crafter.posts.get('summer-event');

// Produce the HTML output
const html = crafter.utils.lexicalToHtml(post.content);
document.querySelector('#post-content').innerHTML = html;
```

#### Classless Semantic Output Mode:
If you want plain HTML (`<p>`, `<h1>`, `<blockquote>`) tags in your theme instead of Tailwind classes:
```javascript
const cleanHtml = crafter.utils.lexicalToHtml(post.content, { plainSemantic: true });
```

---

### 2. Extracting an Excerpt (`lexicalToText`)
```javascript
const post = await crafter.posts.get('yaz-etkinligi');
const plainText = crafter.utils.lexicalToText(post.content);

// Show the first 100 characters on the post card
document.querySelector('#card-summary').innerText = plainText.slice(0, 100) + '...';
```

---

### 3. Converting HTML to a Lexical AST (`htmlToLexical`)
You can convert HTML text from a WYSIWYG editor (TinyMCE, Quill, CKEditor) or an external source into a Lexical AST and send it to the backend:

```javascript
const htmlInput = '<h2>Important Notice</h2><p>Please <strong>pay attention</strong> to the rules.</p>';
const lexicalState = crafter.utils.htmlToLexical(htmlInput);

// It is now a valid Lexical JSON AST:
console.log(lexicalState.root.children);
```

---

### 4. Bitmask Sabitlerini Kullanma
Format bitmasks can be imported directly from `crafter.utils.formats` or from the SDK package:

```javascript
import { IS_BOLD, IS_ITALIC, IS_HIGHLIGHT } from '@crafter-cms/sdk';

if (textNode.format & IS_BOLD) {
  console.log('This text is bold!');
}
```
