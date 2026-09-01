# ✍️ Lexical Zengin Metin Motoru (`crafter.utils`)

Crafter CMS, duyuru içeriklerini, ürün açıklamalarını, destek talebi mesajlarını ve forum gönderilerini Meta (Facebook) tarafından geliştirilen açık kaynaklı **Lexical Rich-Text AST** standartlarında saklar ve doğrular.

SDK; [Lexical Resmi Dokümantasyonu](https://lexical.dev/docs/intro) ve [Serileştirme Standartları](https://lexical.dev/docs/serialization) ile **%100 uyumlu**, sıfır bağımlılıklı (zero-dependency) çift yönlü bir Lexical motoru barındırır.

---

## 📌 Metotlar ve Yetenekler

| Metot | Yön | Açıklama |
| :--- | :---: | :--- |
| **`crafter.utils.lexicalToHtml(node, options?)`** | **AST ➔ HTML** | Lexical JSON AST'sini tüm formatları, hizalamaları ve düğüm tiplerini işleyerek semantik HTML'e çevirir. |
| **`crafter.utils.lexicalToText(node)`** | **AST ➔ Metin** | AST'den tüm HTML etiketlerini ayıklar; duyuru özetleri (excerpt), arama ve SEO için temiz metin üretir. |
| **`crafter.utils.htmlToLexical(htmlString)`** | **HTML ➔ AST** | Ham HTML kodunu (tarayıcı DOMParser veya Node.js motoruyla) geçerli Lexical EditorState AST nesnesine dönüştürür. |
| **`crafter.utils.toLexical(content)`** | **Akıllı Çözücü** | Gelen veri ister düz metin ister HTML ister hazır Lexical nesnesi olsun; backend'in beklediği geçerli `SerializedEditorState` çıktısını garanti eder. |
| **`crafter.utils.isLexicalFormat(obj)`** | **Doğrulama** | Bir nesnenin geçerli Lexical kök yapısına (`root: { type: 'root', children: [...] }`) sahip olup olmadığını kontrol eder. |

---

## 🧱 Desteklenen Standart Lexical Düğüm Tipleri

1. **Text (Metin):**
   * Resmi Lexical bitmask formatlayıcısı:
     * `IS_BOLD (1)` ➔ `<strong>`
     * `IS_ITALIC (2)` ➔ `<em>`
     * `IS_STRIKETHROUGH (4)` ➔ `<s>`
     * `IS_UNDERLINE (8)` ➔ `<u>`
     * `IS_CODE (16)` ➔ `<code>`
     * `IS_SUBSCRIPT (32)` ➔ `<sub>`
     * `IS_SUPERSCRIPT (64)` ➔ `<sup>`
     * `IS_HIGHLIGHT (128)` ➔ `<mark>`
   * `style` alanı (özel renk, font boyutu) ➔ `<span style="...">`
2. **Paragraph & Heading:**
   * `h1`, `h2`, `h3`, `h4`, `h5`, `h6`
   * Hizalama formatları: `left`, `center`, `right`, `justify`, `start`, `end`
   * Girinti desteği (`indent`): `padding-left: indent * 24px`
   * Metin yönü (`direction`): `dir="ltr"` / `dir="rtl"`
3. **Listeler (Lists):**
   * Sırasız (`bullet` ➔ `<ul>`)
   * Sıralı (`number` ➔ `<ol start="...">`)
   * **İnteraktif Kontrol Listeleri (`check`):** `data-checked="true/false"` ve `<input type="checkbox" disabled />`
4. **Tablolar (Tables):**
   * `table`, `tablerow`, `tablecell`
   * Başlık hücresi (`th`) ve veri hücresi (`td`) ayrımı
   * `colSpan`, `rowSpan` ve `backgroundColor` desteği
5. **Blok Düğüm Tipleri:**
   * `quote` ➔ `<blockquote>`
   * `code` ➔ `<pre><code class="language-...">` (sözdizimi dili ile)
   * `link` & `autolink` ➔ `<a href="..." target="..." rel="..." title="...">`
   * `image` & `inline-image` ➔ `<img src="..." alt="..." width="..." height="..." />`
   * `horizontalrule` / `hr` ➔ `<hr />`
   * `linebreak` ➔ `<br />`
   * `tab` ➔ `<span style="white-space: pre-wrap;">\t</span>`

---

## 💡 Pratik Kullanım Örnekleri

### 1. AJAX ile Alınan Duyuruyu HTML Olarak Basma
```javascript
const post = await crafter.posts.get('yaz-etkinligi');

// HTML çıktısı üret
const html = crafter.utils.lexicalToHtml(post.content);
document.querySelector('#post-content').innerHTML = html;
```

#### Sınıfsız Semantik Çıktı Modu:
Eğer temanızda Tailwind sınıfları yerine saf HTML (`<p>`, `<h1>`, `<blockquote>`) etiketleri istiyorsanız:
```javascript
const cleanHtml = crafter.utils.lexicalToHtml(post.content, { plainSemantic: true });
```

---

### 2. Özet Metin Çıkarma (`lexicalToText`)
```javascript
const post = await crafter.posts.get('yaz-etkinligi');
const plainText = crafter.utils.lexicalToText(post.content);

// İlk 100 karakteri duyuru kartında göster
document.querySelector('#card-summary').innerText = plainText.slice(0, 100) + '...';
```

---

### 3. HTML Kodunu Lexical AST'ye Dönüştürme (`htmlToLexical`)
Bir WYSIWYG editöründen (TinyMCE, Quill, CKEditor) veya harici bir kaynaktan gelen HTML metnini Lexical AST'ye çevirip backend'e gönderebilirsiniz:

```javascript
const htmlInput = '<h2>Önemli Duyuru</h2><p>Lütfen kurallara <strong>dikkat ediniz</strong>.</p>';
const lexicalState = crafter.utils.htmlToLexical(htmlInput);

// Artık geçerli bir Lexical JSON AST'sidir:
console.log(lexicalState.root.children);
```

---

### 4. Bitmask Sabitlerini Kullanma
Format bitmask'ları doğrudan `crafter.utils.formats` altından veya SDK paketinden import edilebilir:

```javascript
import { IS_BOLD, IS_ITALIC, IS_HIGHLIGHT } from '@crafter-cms/sdk';

if (textNode.format & IS_BOLD) {
  console.log('Bu metin kalın (bold)!');
}
```
