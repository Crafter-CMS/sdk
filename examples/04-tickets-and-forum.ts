/**
 * Crafter SDK - Tickets & Forum Workflow Example
 * 
 * Demonstrates:
 * 1. Creating and replying to support tickets (with auto-Lexical transformation).
 * 2. Forum topic creation, message posting, and liking.
 * 3. Listening to reactive events.
 * 
 * Run with: npx tsx examples/04-tickets-and-forum.ts
 */

import { Crafter } from '../src';

async function main() {
  console.log('🎫 Crafter Destek ve Forum İş Akışı Başlatılıyor...\n');

  const crafter = new Crafter({
    mode: 'direct',
    websiteId: '00000000-0000-0000-0000-000000000000',
    token: 'sample-auth-token-or-empty',
  });

  // 1. Reaktif Event Dinleyicilerini Kur
  crafter.on('ticket:created', (ticket) => {
    console.log(`⚡ [EVENT] Yeni Destek Talebi Açıldı: #${ticket.id.slice(0, 8)} - ${ticket.title}`);
  });

  crafter.on('ticket:closed', (event) => {
    console.log(`⚡ [EVENT] Destek Talebi Kapatıldı: #${event.ticketId.slice(0, 8)} (Sebep: ${event.reason || 'Yok'})`);
  });

  crafter.on('forum:topic_created', (topic) => {
    console.log(`⚡ [EVENT] Forumda Yeni Konu Açıldı: [${topic.title}]`);
  });

  crafter.on('forum:topic_liked', (event) => {
    console.log(`⚡ [EVENT] Konu Beğenildi! ID: ${event.topicId} (Toplam Beğeni: ${event.likeCount})`);
  });

  try {
    // 2. Destek Kategorilerini Listele
    console.log('📌 1. Destek Departmanları Alınıyor:');
    const categories = await crafter.tickets.getCategories();
    console.log(`   - Bulunan Kategori Sayısı: ${categories.length}`);
    categories.forEach((c) => console.log(`     * [${c.name}] - ID: ${c.id}`));
    console.log();

    // 3. Yeni Destek Talebi Açma (Düz string metin otomatik Lexical formatına sarılır)
    console.log('📌 2. Yeni Destek Talebi Gönderiliyor:');
    const newTicket = await crafter.tickets.create({
      title: 'Hesap Güvenliği Hakkında',
      categoryId: categories[0]?.id || 'cat-general',
      // Düz string metin gönderiyoruz; SDK bunu arka planda Lexical AST'sine çevirir!
      message: 'Merhaba yetkili ekibi,\nHesabımda iki adımlı doğrulamayı açmak istiyorum fakat Discord kodum gelmedi.\nYardımcı olabilir misiniz?',
    });
    console.log(`   - Bilet Oluşturuldu: #${newTicket.id}`);
    console.log();

    // 4. Bilete Yanıt Gönderme
    console.log('📌 3. Bilete Yanıt Ekleniyor:');
    await crafter.tickets.reply(newTicket.id, 'Ek bilgi: Discord kullanıcı adım Steve#1234.');
    console.log('   - Yanıt başarıyla iletildi.');
    console.log();

    // 5. Bileti Kapatma
    console.log('📌 4. Bilet Kapatılıyor:');
    await crafter.tickets.close(newTicket.id, 'Sorun çözüldü.');
    console.log('   - Bilet kapatıldı.');
    console.log();

    // 6. Forum Kategorileri ve Konu Açma
    console.log('📌 5. Forum Kategorileri Alınıyor:');
    const forumCategories = await crafter.forum.getCategories();
    if (forumCategories.length > 0) {
      const firstCat = forumCategories[0];
      console.log(`   - Seçilen Kategori: ${firstCat.name}`);

      // Yeni Konu Açma
      console.log('   - Yeni Konu Açılıyor:');
      const topic = await crafter.forum.createTopic(firstCat.id, {
        title: 'Klan Savaşı Stratejileri',
        content: 'Bu konuda en iyi klan savaş dizilimlerini tartışıyoruz.\nSizce en iyi savunma nasıl olmalı?',
      });

      // Konuyu Beğenme
      console.log('   - Konu Beğeniliyor:');
      await crafter.forum.likeTopic(topic.id);
    }

  } catch (err: any) {
    console.warn('ℹ️ API Çağrısı Sonucu (Beklenen kimlik doğrulama veya demo yanıtı):', err.message);
  }
}

main().catch(console.error);
