# ⚡ Event Bus & Hata Yönetimi

Crafter SDK, temaların sayfayı yenilemeden reaktif olarak arayüz güncellemesi yapabilmesi için yerleşik bir **Olay Dinleme Sistemi (Event Bus)** ve tutarlı bir **Hata Sınıfı (`CrafterError`)** içerir.

---

## 📌 Reaktif Event Bus (`crafter.on`, `crafter.off`, `crafter.once`)

Kullanıcı bir işlem yaptığında (giriş yapma, satın alma, bakiye gönderme vb.), SDK arka planda global olaylar yayınlar. Temalar bu olayları dinleyerek sepet sayısını, bakiye kutularını veya bildirim pencerelerini anında güncelleyebilir.

### Dinlenebilir Standart Olaylar

| Olay Adı | Tetiklenme Zamanı | Döndürdüğü Veri (`payload`) |
| :--- | :--- | :--- |
| **`auth:login`** | Kullanıcı başarıyla oturum açtığında | `{ token?: string }` |
| **`auth:logout`** | Kullanıcı çıkış yaptığında | `void` |
| **`auth:token_refreshed`** | Access token yenilendiğinde | `{ token: string }` |
| **`user:updated`** | Kullanıcı profilini güncellediğinde | `UserProfile` |
| **`balance:sent`** | Başka bir oyuncuya bakiye transfer edildiğinde | `SendBalanceResponse` |
| **`wall:message_added`** | Profil duvarına yeni mesaj yazıldığında | `{ userId: string, message: WallMessage }` |
| **`wall:reply_added`** | Profil duvarındaki mesaja yanıt verildiğinde | `{ userId: string, wallMessageId: string, reply: WallMessageReply }` |
| **`2fa:enabled`** | 2FA aktif edildiğinde (Authenticator/Email/Discord) | `{ method: string, recoveryCodes?: string[] }` |
| **`2fa:disabled`** | 2FA devre dışı bırakıldığında | `{ method?: string }` |
| **`discord:linked`** | Discord hesabı bağlandığında | `{ discordId: string, discordUsername: string }` |
| **`discord:unlinked`** | Discord hesabı bağlantısı koparıldığında | `void` |
| **`cart:purchased`** | Mağazadan bir ürün satın alındığında | `PurchaseResponse` |
| **`chest:item_used`** | Sandıktan bir eşya oyuna teslim edildiğinde | `{ itemId: string, response: UseChestItemResponse }` |
| **`chest:item_gifted`**| Sandıktan bir eşya arkadaşa hediye edildiğinde | `{ targetUserId: string, itemId: string, response: GiftChestItemResponse }` |
| **`ticket:created`** | Yeni bir destek bileti açıldığında | `Ticket` |
| **`ticket:replied`** | Destek biletine mesaj yazıldığında | `{ ticketId: string, response: Ticket }` |
| **`ticket:closed`** | Destek bileti kapatıldığında | `{ ticketId: string, reason?: string, response: Ticket }` |
| **`ticket:opened`** | Destek bileti yeniden açıldığında | `{ ticketId: string, response: Ticket }` |
| **`forum:topic_created`**| Forumda yeni konu açıldığında | `ForumTopic` |
| **`forum:message_added`**| Forum konusuna yeni mesaj yazıldığında | `{ topicId: string, message: any }` |
| **`forum:reply_added`** | Forum mesajına alıntı yanıt verildiğinde | `{ messageId: string, reply: any }` |
| **`forum:topic_liked`** | Forum konusu beğenildiğinde | `{ topicId: string, likeCount?: number }` |
| **`forum:topic_unliked`**| Forum konusundan beğeni geri çekildiğinde | `{ topicId: string, likeCount?: number }` |
| **`post:liked`** | Bir duyuru beğenildiğinde | `LikePostResponse` |
| **`redeem:used`** | Hediye / promosyon kodu bozdurulduğunda | `UseRedeemCodeResponse` |
| **`report:created`** | Bir oyuncu rapor edildiğinde | `ReportResponse` |
| **`vote:success`** | Sunucuya oy verildiğinde | `{ providerId: string, response: any }` |
| **`form:submitted`** | Yetkili başvuru formu yollandığında | `{ formId: string, response: StaffFormApplicationResponse }` |
| **`payment:initiated`** | Ödeme başlatıldığında (iframe/redirect) | `InitiatePaymentResponse` |
| **`payment:checked`** | Ödeme durumu kontrol edildiğinde | `CheckPaymentResponse` |

### Örnek Kullanım:
```javascript
// Satın alım tamamlandığında header bakiyesini otomatik güncelle
crafter.on('cart:purchased', async (order) => {
  console.log('Satın alma başarılı:', order);
  const data = await crafter.users.getBalance('me');
  document.querySelector('#header-balance').innerText = data.balance;
  showToast('Satın alma başarılı! Eşyanız sandığınıza eklendi.');
});

// Çıkış yapıldığında sayfayı yenile
crafter.on('auth:logout', () => {
  window.location.reload();
});

// Bir kerelik dinleme:
crafter.once('auth:login', () => {
  console.log('İlk kez giriş yapıldı!');
});
```

---

## ⚠️ Hata Yönetimi (`CrafterError`)

Tüm HTTP hataları (400 Bad Request, 401 Unauthorized, 404 Not Found, 500 Server Error) standart bir `CrafterError` nesnesi olarak fırlatılır.

### `CrafterError` Özellikleri
```typescript
class CrafterError extends Error {
  statusCode: number;           // HTTP durum kodu (400, 401, 404, 500 vb.)
  message: string;              // Okunabilir hata mesajı
  error?: string;               // Backend hata tipi (Örn: 'BAD_REQUEST')
  details?: Record<string, any>;// Doğrulama hataları veya detaylar
  isCrafterError: true;
}
```

### Güvenli Hata Yakalama Örneği:
```javascript
try {
  await crafter.cart.purchase({ productIds: ['prod-1'] });
} catch (err) {
  if (err.isCrafterError) {
    if (err.statusCode === 401) {
      alert('Lütfen önce oturum açınız.');
      window.location.href = '/auth/login';
    } else if (err.statusCode === 400) {
      alert('Hata: ' + err.message); // Örn: "Yetersiz bakiye"
    } else {
      alert('Sunucu hatası: ' + err.message);
    }
  } else {
    console.error('Bilinmeyen bir hata oluştu:', err);
  }
}
```

---

## 🌐 Çift Çalışma Modu Mimarisi (Storefront vs Direct)

SDK ortamı otomatik olarak tanır:

1. **`storefront` Modu (Varsayılan):**
   * Liquid temalarda `websiteId` belirtilmezse otomatik aktif olur.
   * Tüm istekler aynı kök dizindeki `/api/storefront` Next.js Proxy'sine iletilir.
   * `websiteId` alan adı (hostname) üzerinden otomatik çözülür.
   * `crafter_token` HttpOnly çerezi otomatik olarak yönetilir.

2. **`direct` Modu (Headless / React / Vue / Mobile / Node.js):**
   * Yapılandırmada `websiteId` verildiğinde otomatik aktif olur.
   * İstekler doğrudan `https://api.crafter.net.tr/website/{v2/}:websiteId/...` adresine gider.
   * JWT token'ı Authorization başlığıyla iletilir.
