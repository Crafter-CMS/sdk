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
  console.log('🎫 Starting the Crafter support and forum workflow...\n');

  const crafter = new Crafter({
    mode: 'direct',
    websiteId: '00000000-0000-0000-0000-000000000000',
    token: 'sample-auth-token-or-empty',
  });

  // 1. Reaktif Event Dinleyicilerini Kur
  crafter.on('ticket:created', (ticket) => {
    console.log(`⚡ [EVENT] New support ticket opened: #${ticket.id.slice(0, 8)} - ${ticket.title}`);
  });

  crafter.on('ticket:closed', (event) => {
    console.log(`⚡ [EVENT] Support ticket closed: #${event.ticketId.slice(0, 8)} (Reason: ${event.reason || 'None'})`);
  });

  crafter.on('forum:topic_created', (topic) => {
    console.log(`⚡ [EVENT] New forum topic opened: [${topic.title}]`);
  });

  crafter.on('forum:topic_liked', (event) => {
    console.log(`⚡ [EVENT] Topic liked! ID: ${event.topicId} (Total likes: ${event.likeCount})`);
  });

  try {
    // 2. List support categories
    console.log('📌 1. Fetching support departments:');
    const categories = await crafter.tickets.getCategories();
    console.log(`   - Categories found: ${categories.length}`);
    categories.forEach((c) => console.log(`     * [${c.name}] - ID: ${c.id}`));
    console.log();

    // 3. Open a new support ticket (plain string text is wrapped into Lexical format automatically)
    console.log('📌 2. Sending a new support ticket:');
    const newTicket = await crafter.tickets.create({
      title: 'About Account Security',
      categoryId: categories[0]?.id || 'cat-general',
      // We send plain string text; the SDK converts it into a Lexical AST behind the scenes!
      message: 'Hello staff team,\nI want to enable two-factor authentication on my account but my Discord code never arrived.\nCould you help?',
    });
    console.log(`   - Ticket created: #${newTicket.id}`);
    console.log();

    // 4. Reply to the ticket
    console.log('📌 3. Adding a reply to the ticket:');
    await crafter.tickets.reply(newTicket.id, 'Additional info: my Discord username is Steve#1234.');
    console.log('   - Reply sent.');
    console.log();

    // 5. Close the ticket
    console.log('📌 4. Closing the ticket:');
    await crafter.tickets.close(newTicket.id, 'Issue resolved.');
    console.log('   - Ticket closed.');
    console.log();

    // 6. Forum categories and opening a topic
    console.log('📌 5. Fetching forum categories:');
    const forumCategories = await crafter.forum.getCategories();
    if (forumCategories.length > 0) {
      const firstCat = forumCategories[0];
      console.log(`   - Selected category: ${firstCat.name}`);

      // Open a new topic
      console.log('   - Opening a new topic:');
      const topic = await crafter.forum.createTopic(firstCat.id, {
        title: 'Clan War Strategies',
        content: 'In this topic we discuss the best clan war formations.\nWhat do you think the best defense looks like?',
      });

      // Like the topic
      console.log('   - Liking the topic:');
      await crafter.forum.likeTopic(topic.id);
    }

  } catch (err: any) {
    console.warn('ℹ️ API call result (expected authentication or demo response):', err.message);
  }
}

main().catch(console.error);
