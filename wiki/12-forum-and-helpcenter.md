# 💬 Forum & Help Center (`crafter.forum` & `crafter.helpcenter`)

Handles community discussions, guides, opening topics, messaging and help center FAQ articles.

---

## 📌 Forum Module (`crafter.forum`)

### 1. `getCategories()`
Fetches the forum's main categories and subcategories.

* **HTTP Route:** `GET /forum/categories`
* **Returns:** `ForumCategory[]` (`id, name, slug, description, topics, subCategories`)
* **Example:**
  ```javascript
  const categories = await crafter.forum.getCategories();
  categories.forEach(cat => {
    console.log(`[Category] ${cat.name} (${cat.topics?.length || 0} topics)`);
  });
  ```

---

### 2. `getTopics(categoryId)` & `getTopic(topicId)`
Fetches the topics in a category or all messages (replies) of a specific topic.

* **HTTP Route:** `GET /forum/category/:categoryId/topics` & `GET /forum/topic/:topicId`
* **Returns:** `ForumTopic`
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
Opens a new topic in the given category.

* **HTTP Route:** `POST /forum/category/:categoryId/topic`
* **Input:** `{ title: string, content: string }`
* **Example:**
  ```javascript
  const topic = await crafter.forum.createTopic('guides-category-id', {
    title: 'SkyBlock Island Level-Up Guide',
    content: 'In this guide I explain how to grow your island as fast as possible...'
  });
  console.log('Topic opened:', topic.id);
  ```

---

### 4. `addMessage(topicId, content)` & `replyMessage(messageId, content)`
Sends a new reply to a topic or a quoted reply to a specific reply.

* **HTTP Route:** `POST /forum/topic/:topicId/message` and `POST /forum/message/:messageId/reply`
* **Example:**
  ```javascript
  await crafter.forum.addMessage('topic-123', 'Great work, this guide is really helpful.');
  ```

---

### 5. `likeTopic(topicId)` & `unlikeTopic(topicId)`
Likes the topic or removes the like.

* **HTTP Route:** `POST /forum/topic/:topicId/like` & `DELETE /forum/topic/:topicId/like`
* **Example:**
  ```javascript
  // Like:
  await crafter.forum.likeTopic('topic-123');

  // Remove the like:
  await crafter.forum.unlikeTopic('topic-123');
  ```

---

## ❓ Help Center Module (`crafter.helpcenter`)

Fetches the knowledge base articles about the server and the FAQ (frequently asked questions) list.

### 6. `getOverview(query?)` / `getCategories(query?)`
Fetches the help center home page showcase (categories, featured articles and FAQ) in one go.

* **HTTP Route:** `GET /helpcenter`
* **Returns:**
  ```typescript
  interface HelpcenterOverviewResponse {
    categories: Array<{ id: string; name: string; description?: string }>;
    items: Array<{ id: string; title: string; categoryId: string }>;
    faqs: Array<{ id: string; question: string; answer: string }>;
  }
  ```
* **Example:**
  ```javascript
  const overview = await crafter.helpcenter.getOverview();

  // Print the frequently asked questions
  overview.faqs.forEach(faq => {
    console.log(`Q: ${faq.question}\nA: ${faq.answer}`);
  });
  ```

---

### 7. `getCategory(categoryId)` & `getArticle(itemId)`
Fetches all articles of a specific help category or the details of a single article.

* **HTTP Route:** `GET /helpcenter/category/:categoryId` & `GET /helpcenter/item/:itemId`
* **Example:**
  ```javascript
  const article = await crafter.helpcenter.getArticle('item-123');
  document.querySelector('#article-content').innerHTML = article.content;
  ```
