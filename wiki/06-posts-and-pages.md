# 📰 Posts & Pages (`crafter.posts` & `crafter.pages`)

Handles listing and showing news, updates, blog posts and static CMS pages (rules, about us, etc.).

---

## 📌 Posts Module (`crafter.posts`)

### 1. `list(query?)`
Fetches posts paginated, filtered and sorted.

* **HTTP Route:** `GET /v2/posts`
* **Query parameters:**
  ```typescript
  interface PostQueryDto {
    page?: number;        // Default: 1
    limit?: number;       // Default: 10
    search?: string;      // Search in the title
    categoryId?: string;
    sortBy?: string;
  }
  ```
* **Returns:**
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
* **Example usage:**
  ```javascript
  const res = await crafter.posts.list({ page: 1, limit: 6 });
  res.data.forEach(post => {
    console.log(`[${post.title}] - Likes: ${post.likeCount}, Views: ${post.viewCount}`);
  });
  ```

---

### 2. `get(idOrSlug)` & `getBySlug(slug)`
Fetches the full content of a single post. The backend resolves the ID and the slug on the same endpoint automatically. The view counter is incremented by the backend automatically.

* **HTTP Route:** `GET /v2/posts/:idOrSlug`
* **Returns:** A `PostItem` object directly (the SDK unwraps `res.data` automatically).
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
* **Example usage:**
  ```javascript
  const post = await crafter.posts.get('new-season-is-open');
  document.querySelector('#post-title').innerText = post.title;
  document.querySelector('#post-content').innerHTML = post.content;
  ```

---

### 3. `like(postId)`
Likes the post or removes an existing like (toggle like).

* **HTTP Route:** `POST /v2/posts/:id/like`
* **Returns:** `{ success: true, data: { liked: boolean, likeCount: number }, message: string }`
* **Example:**
  ```javascript
  const res = await crafter.posts.like('post-uuid-123');
  document.querySelector('#like-count').innerText = res.data.likeCount;
  ```

---

### 4. `getUserLiked(userId?, page?, limit?)`
Lists the posts a user liked (e.g. a "My likes" tab on the profile page).

* **HTTP Route:** `GET /v2/posts/user/:userId/liked`
* **Default:** `userId = 'me'`
* **Example:**
  ```javascript
  const liked = await crafter.posts.getUserLiked('me', 1, 10);
  console.log('Posts I liked:', liked.pagination.total);
  ```

---

## 📄 Static Pages Module (`crafter.pages`)

Lists the custom pages the admin created in the CMS (e.g. `/page/about-us`, `/page/staff-team`).

### 5. `list()`
Lists only published (`isPublished: true`) pages.

* **HTTP Route:** `GET /v2/pages/public`
* **Returns:** `PageItem[]`
* **Example:**
  ```javascript
  const pages = await crafter.pages.list();
  pages.forEach(p => {
    console.log(`${p.title} -> /page/${p.slug}`);
  });
  ```

---

### 6. `getBySlug(slug)`
Fetches the page title and HTML content by slug.

* **HTTP Route:** `GET /v2/pages/slug/:slug`
* **Returns:** `PageItem` (`id, title, slug, content, isPublished, viewCount`)
* **Example:**
  ```javascript
  const page = await crafter.pages.getBySlug('hakkimizda');
  document.title = page.title;
  document.querySelector('#page-body').innerHTML = page.content;
  ```
