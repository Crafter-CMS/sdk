# 📰 Duyurular & Sayfalar (`crafter.posts` & `crafter.pages`)

Haberler, güncellemeler, blog yazıları ve statik CMS sayfalarının (Kurallar, Hakkımızda vb.) listelenmesi ve detaylarının görüntülenmesini yönetir.

---

## 📌 Duyurular Modülü (`crafter.posts`)

### 1. `list(query?)`
Duyuruları sayfalanmış, filtrelenmiş ve sıralanmış olarak getirir.

* **HTTP Rota:** `GET /v2/posts`
* **Sorgu Parametreleri:**
  ```typescript
  interface PostQueryDto {
    page?: number;        // Varsayılan: 1
    limit?: number;       // Varsayılan: 10
    search?: string;      // Başlıkta arama
    categoryId?: string;
    sortBy?: string;
  }
  ```
* **Dönüş:**
  ```typescript
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
  ```
* **Örnek Kullanım:**
  ```javascript
  const res = await crafter.posts.list({ page: 1, limit: 6 });
  res.data.forEach(post => {
    console.log(`[${post.title}] - Beğeni: ${post.likeCount}, Görüntülenme: ${post.viewCount}`);
  });
  ```

---

### 2. `get(idOrSlug)` & `getBySlug(slug)`
Tek bir duyurunun tüm içeriğini getirir. Backend ID ve slug'ı aynı endpoint üzerinden otomatik çözümler. Görüntülenme sayacı backend tarafından otomatik artırılır.

* **HTTP Rota:** `GET /v2/posts/:idOrSlug`
* **Dönüş:** Doğrudan `PostItem` nesnesi (SDK tarafından `res.data` otomatik çıkarılır).
  ```typescript
  interface PostItem {
    id: string;
    slug: string;
    title: string;
    content: string;
    featuredImage?: string;
    coverImage?: string;
    likeCount?: number;
    viewCount?: number;
    isPinned?: boolean;
    isHot?: boolean;
    author?: { id: string; username: string; avatar?: string };
    createdAt: string;
  }
  ```
* **Örnek Kullanım:**
  ```javascript
  const post = await crafter.posts.get('yeni-sezon-acildi');
  document.querySelector('#post-title').innerText = post.title;
  document.querySelector('#post-content').innerHTML = post.content;
  ```

---

### 3. `like(postId)`
Duyuruyu beğenir veya var olan beğeniyi geri alır (Toggle Like).

* **HTTP Rota:** `POST /v2/posts/:id/like`
* **Dönüş:** `{ success: true, data: { liked: boolean, likeCount: number }, message: string }`
* **Örnek:**
  ```javascript
  const res = await crafter.posts.like('post-uuid-123');
  document.querySelector('#like-count').innerText = res.data.likeCount;
  ```

---

### 4. `getUserLiked(userId?, page?, limit?)`
Bir kullanıcının beğendiği duyuruları listeler (Örn: Profil sayfasında "Beğendiklerim" sekmesi).

* **HTTP Rota:** `GET /v2/posts/user/:userId/liked`
* **Varsayılan:** `userId = 'me'`
* **Örnek:**
  ```javascript
  const liked = await crafter.posts.getUserLiked('me', 1, 10);
  console.log('Beğendiğim post sayısı:', liked.pagination.total);
  ```

---

## 📄 Sabit Sayfalar Modülü (`crafter.pages`)

Yöneticinin CMS üzerinden oluşturduğu özel sayfaları (Örn: `/sayfa/hakkimizda`, `/sayfa/yetkili-ekibi`) listeler.

### 5. `list()`
Yalnızca yayında olan (`isPublished: true`) sayfaları listeler.

* **HTTP Rota:** `GET /v2/pages/public`
* **Dönüş:** `PageItem[]`
* **Örnek:**
  ```javascript
  const pages = await crafter.pages.list();
  pages.forEach(p => {
    console.log(`${p.title} -> /sayfa/${p.slug}`);
  });
  ```

---

### 6. `getBySlug(slug)`
Sayfanın başlığını ve HTML içeriğini slug ile çeker.

* **HTTP Rota:** `GET /v2/pages/slug/:slug`
* **Dönüş:** `PageItem` (`id, title, slug, content, isPublished, viewCount`)
* **Örnek:**
  ```javascript
  const page = await crafter.pages.getBySlug('hakkimizda');
  document.title = page.title;
  document.querySelector('#page-body').innerHTML = page.content;
  ```
