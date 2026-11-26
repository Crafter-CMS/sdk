/**
 * Crafter SDK - Headless / Node.js Direct Mode Example
 * 
 * Demonstrates using the SDK in backend services, Discord bots,
 * CLI tools, or headless mobile/desktop integrations.
 * 
 * Run with: npx tsx examples/02-headless-node.ts
 */

import { Crafter, CrafterError, formatMoney } from '../src';

async function main() {
  console.log('🚀 Starting Crafter SDK headless direct mode...\n');

  // 1. Create a direct mode client
  const crafter = new Crafter({
    mode: 'direct',
    websiteId: '00000000-0000-0000-0000-000000000000', // Store tenant UUID
    apiBase: 'https://api.crafter.net.tr', // Default backend API
    token: process.env.CRAFTER_TOKEN, // Optional JWT session token
  });

  try {
    // 2. Fetch general site info and active modules
    console.log('📌 1. Site info and active add-ons:');
    const siteInfo = await crafter.website.getInfo();
    console.log(`   - Site name: ${siteInfo.name}`);
    console.log(`   - Para Birimi: ${siteInfo.currency}`);
    console.log(`   - Active add-ons:`, Object.keys(siteInfo.pluginModules || {}));
    console.log();

    // 3. Fetch store categories and products
    console.log('📌 2. Store product catalogs:');
    const categories = await crafter.store.getCategories();
    console.log(`   - Total categories: ${categories.length}`);

    const { currency } = await crafter.website.getInfo(); // store currency
    const products = await crafter.store.getProducts();
    console.log(`   - Total products: ${products.length}`);
    products.slice(0, 3).forEach((p) => {
      console.log(`     * [${p.name}] - Price: ${formatMoney(p.price, currency)} (Stock: ${p.stock === -1 ? 'Unlimited' : p.stock})`);
    });
    console.log();

    // 4. Look up a player's LuckPerms rank & permissions
    console.log('📌 3. LuckPerms in-game rank lookup:');
    try {
      const playerData = await crafter.luckperms.getPlayer('player_name');
      console.log(`   - Player: ${playerData.username} (${playerData.uuid})`);
      console.log(`   - Primary rank: ${playerData.primaryGroup}`);
      console.log(`   - Permissions defined: ${playerData.permissions?.length || 0}`);
    } catch (err: any) {
      console.log(`   - Player data (expected outcome): ${err.message}`);
    }
    console.log();

    // 5. Fetch SEO sitemap URL data
    console.log('📌 4. Dynamic sitemap URL list:');
    const sitemapData = await crafter.seo.getSitemapData();
    console.log(`   - Total indexable URLs on the site: ${sitemapData.length}`);
    sitemapData.slice(0, 3).forEach((item) => {
      console.log(`     * ${item.path} (Priority: ${item.priority}, ChangeFreq: ${item.changefreq})`);
    });
    console.log();

    // 6. Build a Discord OAuth link (e.g. for a Discord bot or panel)
    const loginUrl = crafter.auth.getDiscordAuthUrl('login', 'https://example.com/auth/callback');
    console.log('📌 5. Discord OAuth login URL:');
    console.log(`   - ${loginUrl}`);
    console.log();

  } catch (error) {
    if (error instanceof CrafterError) {
      console.error(`❌ Crafter API error [HTTP ${error.statusCode}]: ${error.message}`);
      if (error.details) {
        console.error('   Error details:', error.details);
      }
    } else {
      console.error('❌ Unexpected system error:', error);
    }
  }
}

main().catch(console.error);
