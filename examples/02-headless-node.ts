/**
 * Crafter SDK - Headless / Node.js Direct Mode Example
 * 
 * Demonstrates using the SDK in backend services, Discord bots,
 * CLI tools, or headless mobile/desktop integrations.
 * 
 * Run with: npx tsx examples/02-headless-node.ts
 */

import { Crafter, CrafterError } from '../src';

async function main() {
  console.log('🚀 Crafter SDK Headless Direct Mode Başlatılıyor...\n');

  // 1. Direct Mode İstemcisi Oluşturma
  const crafter = new Crafter({
    mode: 'direct',
    websiteId: '00000000-0000-0000-0000-000000000000', // Mağaza Tenant UUID
    apiBase: 'https://api.crafter.net.tr', // Varsayılan backend API
    token: process.env.CRAFTER_TOKEN, // Opsiyonel JWT oturum token'ı
  });

  try {
    // 2. Genel Site Bilgisi ve Aktif Modülleri Çekme
    console.log('📌 1. Site Bilgisi ve Aktif Eklentiler:');
    const siteInfo = await crafter.website.getInfo();
    console.log(`   - Site Adı: ${siteInfo.name}`);
    console.log(`   - Para Birimi: ${siteInfo.currency}`);
    console.log(`   - Aktif Eklentiler:`, Object.keys(siteInfo.pluginModules || {}));
    console.log();

    // 3. Mağaza Kategorilerini ve Ürünleri Çekme
    console.log('📌 2. Mağaza Ürün Katalogları:');
    const categories = await crafter.store.getCategories();
    console.log(`   - Toplam Kategori Sayısı: ${categories.length}`);

    const products = await crafter.store.getProducts();
    console.log(`   - Toplam Ürün Sayısı: ${products.length}`);
    products.slice(0, 3).forEach((p) => {
      console.log(`     * [${p.name}] - Fiyat: ${p.price} TL (Stok: ${p.stock === -1 ? 'Sınırsız' : p.stock})`);
    });
    console.log();

    // 4. LuckPerms Oyuncu Rütbesi & Yetkileri Sorgulama
    console.log('📌 3. LuckPerms Oyun İçi Rank Sorgulama:');
    try {
      const playerData = await crafter.luckperms.getPlayer('oyuncu_adi');
      console.log(`   - Oyuncu: ${playerData.username} (${playerData.uuid})`);
      console.log(`   - Ana Rütbe: ${playerData.primaryGroup}`);
      console.log(`   - Tanımlı Yetki Sayısı: ${playerData.permissions?.length || 0}`);
    } catch (err: any) {
      console.log(`   - Oyuncu verisi (Beklenen durum): ${err.message}`);
    }
    console.log();

    // 5. SEO Sitemap URL Verilerini Çekme
    console.log('📌 4. Dinamik Sitemap URL Listesi:');
    const sitemapData = await crafter.seo.getSitemapData();
    console.log(`   - Sitedeki Toplam İndekslenebilir URL Sayısı: ${sitemapData.length}`);
    sitemapData.slice(0, 3).forEach((item) => {
      console.log(`     * ${item.path} (Priority: ${item.priority}, ChangeFreq: ${item.changefreq})`);
    });
    console.log();

    // 6. Discord OAuth Bağlantısı Üretme (Örn: Discord Botu veya Panel)
    const loginUrl = crafter.auth.getDiscordAuthUrl('login', 'https://sunucum.com/auth/callback');
    console.log('📌 5. Discord OAuth Giriş URL:');
    console.log(`   - ${loginUrl}`);
    console.log();

  } catch (error) {
    if (error instanceof CrafterError) {
      console.error(`❌ Crafter API Hatası [HTTP ${error.statusCode}]: ${error.message}`);
      if (error.details) {
        console.error('   Hata Detayları:', error.details);
      }
    } else {
      console.error('❌ Beklenmeyen Sistem Hatası:', error);
    }
  }
}

main().catch(console.error);
