# 💬 Forum & Yardım Merkezi (`crafter.forum` & `crafter.helpcenter`)

Topluluk tartışmaları, rehberler, konu açma, mesajlaşma ve yardım merkezi SSS makalelerini yönetir.

---

## 📌 Forum Modülü (`crafter.forum`)

### 1. `getCategories()`
Forum ana kategorilerini ve alt kategorilerini getirir.

* **HTTP Rota:** `GET /forum/categories`
* **Dönüş:** `ForumCategory[]` (`id, name, slug, description, topics, subCategories`)
* **Örnek:**
  ```javascript
  const categories = await crafter.forum.getCategories();
  categories.forEach(cat => {
    console.log(`[Kategori] ${cat.name} (${cat.topics?.length || 0} Konu)`);
  });
  ```

---

### 2. `getTopics(categoryId)` & `getTopic(topicId)`
Bir kategorideki konuları veya belirli bir konunun tüm mesajlarını (replies) çeker.

* **HTTP Rota:** `GET /forum/category/:categoryId/topics` & `GET /forum/topic/:topicId`
* **Dönüş:** `ForumTopic`
  ```typescript
  interface ForumTopic {
    id: string;
    title: string;
    slug: string;
    authorId: string;
    authorName: string;
    likeCount?: number;
    replyCount?: number;
    messages?: Array<{
      id: string;
      authorId: string;
      authorName: string;
      content: string;
      createdAt?: string;
    }>;
  }
  ```

---

### 3. `createTopic(categoryId, data)`
Belirtilen kategoriye yeni bir konu açar.

* **HTTP Rota:** `POST /forum/category/:categoryId/topic`
* **Girdi:** `{ title: string, content: string }`
* **Örnek:**
  ```javascript
  const topic = await crafter.forum.createTopic('rehberler-kategori-id', {
    title: 'SkyBlock Ada Seviyesi Atlama Rehberi',
    content: 'Bu rehberde adanızı en hızlı nasıl geliştireceğinizi anlatıyorum...'
  });
  console.log('Konu açıldı:', topic.id);
  ```

---

### 4. `addMessage(topicId, content)` & `replyMessage(messageId, content)`
Konuya yeni bir cevap veya belirli bir cevaba alıntı yanıt gönderir.

* **HTTP Rota:** `POST /forum/topic/:topicId/message` ve `POST /forum/message/:messageId/reply`
* **Örnek:**
  ```javascript
  await crafter.forum.addMessage('topic-123', 'Eline sağlık çok faydalı bir rehber olmuş.');
  ```

---

### 5. `likeTopic(topicId)` & `unlikeTopic(topicId)`
Konuyu beğenir veya beğeniyi geri çeker.

* **HTTP Rota:** `POST /forum/topic/:topicId/like` & `DELETE /forum/topic/:topicId/like`
* **Örnek:**
  ```javascript
  // Beğen:
  await crafter.forum.likeTopic('topic-123');

  // Beğeniyi geri al:
  await crafter.forum.unlikeTopic('topic-123');
  ```

---

## ❓ Yardım Merkezi Modülü (`crafter.helpcenter`)

Sunucu hakkında bilgi veren bilgi bankası makalelerini ve SSS (Sıkça Sorulan Sorular) listesini çeker.

### 6. `getOverview(query?)` / `getCategories(query?)`
Yardım merkezinin ana sayfa vitrinini (kategoriler, öne çıkan makaleler ve SSS) tek seferde çeker.

* **HTTP Rota:** `GET /helpcenter`
* **Dönüş:**
  ```typescript
  interface HelpcenterOverviewResponse {
    categories: Array<{ id: string; name: string; description?: string }>;
    items: Array<{ id: string; title: string; categoryId: string }>;
    faqs: Array<{ id: string; question: string; answer: string }>;
  }
  ```
* **Örnek:**
  ```javascript
  const overview = await crafter.helpcenter.getOverview();

  // Sıkça Sorulan Soruları Ekrana Bas
  overview.faqs.forEach(faq => {
    console.log(`Q: ${faq.question}\nA: ${faq.answer}`);
  });
  ```

---

### 7. `getCategory(categoryId)` & `getArticle(itemId)`
Belirli bir yardım kategorisinin tüm makalelerini veya tek bir makalenin detayını getirir.

* **HTTP Rota:** `GET /helpcenter/category/:categoryId` & `GET /helpcenter/item/:itemId`
* **Örnek:**
  ```javascript
  const article = await crafter.helpcenter.getArticle('item-123');
  document.querySelector('#article-content').innerHTML = article.content;
  ```
