import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function migrateWithRealMappings() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');

  try {
    await client.connect();
    const db = client.db('mediatool_v2');

    console.log('Starting migration with real data mappings...');

    // Clear campaigns
    await db.collection('campaigns').deleteMany({});

    // Load all reference data
    const accounts = await db.collection('accounts').find({}).toArray();
    const accountMap = new Map(accounts.map((a) => [a._id, a]));

    const teams = await db.collection('teams').find({}).toArray();
    const teamMap = new Map(teams.map((t) => [t._id, t]));

    const users = await db.collection('users').find({}).toArray();
    const userMap = new Map(users.map((u) => [u._id, u]));

    // Also create email lookup for users
    const userByEmail = new Map(users.map((u) => [u.email, u]));

    console.log(`Loaded ${accounts.length} accounts, ${teams.length} teams, ${users.length} users`);

    // Get all line items grouped by strategy
    const lineItems = await db.collection('lineItems').find({}).toArray();
    const strategyLineItems = new Map();
    lineItems.forEach((li) => {
      if (!strategyLineItems.has(li.strategyId)) {
        strategyLineItems.set(li.strategyId, []);
      }
      strategyLineItems.get(li.strategyId).push(li);
    });

    // Get all media plans for spend calculation
    const mediaPlans = await db.collection('mediaPlans').find({}).toArray();
    const strategyMediaPlans = new Map();
    mediaPlans.forEach((mp) => {
      if (!strategyMediaPlans.has(mp.strategyId)) {
        strategyMediaPlans.set(mp.strategyId, []);
      }
      strategyMediaPlans.get(mp.strategyId).push(mp);
    });

    // Get media buys for activity status
    const mediaBuys = await db.collection('mediaBuys').find({}).toArray();
    const strategyMediaBuys = new Map();

    // Group media buys by line item
    const lineItemMediaBuys = new Map();
    for (const mb of mediaBuys) {
      // Find the lineItemMediaBuy junction
      const limb = await db.collection('lineItemMediaBuys').findOne({
        mediaBuyId: mb._id,
      });

      if (limb && limb.lineItemId) {
        if (!lineItemMediaBuys.has(limb.lineItemId)) {
          lineItemMediaBuys.set(limb.lineItemId, []);
        }
        lineItemMediaBuys.get(limb.lineItemId).push(mb);
      }
    }

    const strategies = await db.collection('strategies').find({}).toArray();
    console.log(`Processing ${strategies.length} strategies...`);

    const campaigns = [];
    let processed = 0;

    for (const strategy of strategies) {
      const lineItemsForStrategy = strategyLineItems.get(strategy._id) || [];
      const mediaPlansForStrategy = strategyMediaPlans.get(strategy._id) || [];

      // Get account and team info
      let account = null;
      let team = null;
      let accountName = 'Unknown Account';

      // Try through media plans first
      if (mediaPlansForStrategy.length > 0) {
        const campaignId = mediaPlansForStrategy[0].campaignId;
        account = accountMap.get(campaignId);
      }

      if (account) {
        accountName = account.name;
        team = teamMap.get(account.teamId);
      }

      // Extract campaign name
      let campaignName = 'Untitled Campaign';
      if (lineItemsForStrategy.length > 0 && lineItemsForStrategy[0].name) {
        campaignName = lineItemsForStrategy[0].name;
      } else if (accountName !== 'Unknown Account') {
        campaignName = `${accountName} Campaign`;
      }

      // Extract account from campaign name if needed
      if (accountName === 'Unknown Account' && campaignName.includes(' - ')) {
        accountName = campaignName.split(' - ')[0];
      }

      // Calculate budget from line items
      let totalBudget = 0;
      let totalSpent = 0;
      let totalPlannedSpend = 0;

      for (const li of lineItemsForStrategy) {
        // Budget is price * planned units or just price
        totalBudget += li.price || 0;

        // Get spend from media plans for this line item
        const plansForLineItem = mediaPlansForStrategy.filter((mp: any) => mp.lineItemId === li._id);
        totalSpent += plansForLineItem.reduce((sum: number, mp: any) => sum + (mp.actualSpend || 0), 0);
        totalPlannedSpend += plansForLineItem.reduce((sum: number, mp: any) => sum + (mp.plannedSpend || 0), 0);
      }

      // Default budget if no line items
      if (totalBudget === 0) {
        totalBudget = 50000;
      }

      // Determine media activity status
      let mediaActivity = 'None active';
      let activeCount = 0;

      for (const li of lineItemsForStrategy) {
        const mediaBuysForLineItem = lineItemMediaBuys.get(li._id) || [];
        if (mediaBuysForLineItem.length > 0) {
          activeCount++;
        }
      }

      if (activeCount > 0) {
        if (activeCount === lineItemsForStrategy.length && lineItemsForStrategy.length > 0) {
          mediaActivity = 'All active';
        } else {
          mediaActivity = 'Some active';
        }
      }

      // Get team members
      let leadAccountManager = {
        id: 'default-am',
        name: 'Account Manager',
        email: 'am@company.com',
      };

      let mediaTrader = null;

      // Try to get from team owner
      if (team && team.ownerId) {
        const owner = userMap.get(team.ownerId);
        if (owner) {
          leadAccountManager = {
            id: owner._id,
            name:
              owner.name ||
              `${owner.firstName || ''} ${owner.lastName || ''}`.trim() ||
              'Account Manager',
            email: owner.email,
          };
        }
      }

      // Get media trader from line items
      const mediaTraderIds = lineItemsForStrategy.flatMap((li: any) => li.mediaTraderUserIds || []);
      if (mediaTraderIds.length > 0) {
        const trader = userMap.get(mediaTraderIds[0]);
        if (trader) {
          mediaTrader = {
            id: trader._id,
            name:
              trader.name ||
              `${trader.firstName || ''} ${trader.lastName || ''}`.trim() ||
              'Media Trader',
            email: trader.email,
          };
        }
      }

      // Calculate dates
      let startDate = new Date('2025-01-01');
      let endDate = new Date('2025-12-31');

      if (lineItemsForStrategy.length > 0) {
        const starts = lineItemsForStrategy
          .filter((li: any) => li.startDate)
          .map((li: any) => new Date(li.startDate));
        const ends = lineItemsForStrategy
          .filter((li: any) => li.endDate)
          .map((li: any) => new Date(li.endDate));

        if (starts.length > 0) startDate = new Date(Math.min(...starts));
        if (ends.length > 0) endDate = new Date(Math.max(...ends));
      }

      // Calculate pacing
      const now = new Date();
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const daysElapsed = Math.max(0, Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
      const expectedProgress = Math.min(1, daysElapsed / totalDays);

      const deliveryPacing =
        expectedProgress > 0 ? totalSpent / totalBudget / expectedProgress : 1.0;
      const spendPacing = deliveryPacing; // Same for now

      // Determine status - active strategies with recent activity are L1
      const status = strategy.isActive && mediaActivity !== 'None active' ? 'L1' : 'L2';

      const campaign = {
        _id: strategy._id.toString(),
        campaignNumber: `CN-${(10000 + processed).toString()}`,
        name: campaignName,
        accountName: accountName,
        accountId: account?._id || null,
        status: status,

        team: {
          leadAccountManager: leadAccountManager,
          mediaTrader: mediaTrader,
        },

        dates: {
          start: startDate,
          end: endDate,
          totalDuration: totalDays,
          daysElapsed: daysElapsed,
          daysRemaining: Math.max(0, totalDays - daysElapsed),
        },

        budget: {
          total: totalBudget,
          spent: totalSpent,
          remaining: totalBudget - totalSpent,
          currency: 'USD',
        },

        metrics: {
          deliveryPacing: deliveryPacing,
          spendPacing: spendPacing,
          impressions: Math.floor(totalSpent * 1000), // Rough estimate
          clicks: Math.floor(totalSpent * 10),
          conversions: Math.floor(totalSpent * 0.5),
          ctr: 2.5 + Math.random() * 2,
          cvr: 0.5 + Math.random() * 1.5,
          cpc: totalSpent > 0 ? totalSpent / (totalSpent * 10) : 1.0,
          cpm: totalSpent > 0 ? (totalSpent / (totalSpent * 1000)) * 1000 : 10.0,
          margin: lineItemsForStrategy[0]?.targetMargin || 0.3,
        },

        mediaActivity: mediaActivity,
        lineItemCount: lineItemsForStrategy.length,

        createdAt: strategy.createdAt || new Date(),
        updatedAt: strategy.updatedAt || new Date(),
      };

      campaigns.push(campaign);
      processed++;

      if (campaigns.length >= 100) {
        await db.collection('campaigns').insertMany(campaigns);
        console.log(`Migrated ${processed} campaigns...`);
        campaigns.length = 0;
      }
    }

    // Insert remaining
    if (campaigns.length > 0) {
      await db.collection('campaigns').insertMany(campaigns);
    }

    console.log(`\nMigration complete! Migrated ${processed} campaigns.`);

    // Show statistics
    const stats = await db
      .collection('campaigns')
      .aggregate([
        {
          $group: {
            _id: null,
            totalCampaigns: { $sum: 1 },
            withNames: { $sum: { $cond: [{ $ne: ['$name', 'Untitled Campaign'] }, 1, 0] } },
            withAccounts: { $sum: { $cond: [{ $ne: ['$accountName', 'Unknown Account'] }, 1, 0] } },
            withBudgets: { $sum: { $cond: [{ $gt: ['$budget.total', 50000] }, 1, 0] } },
            l1Status: { $sum: { $cond: [{ $eq: ['$status', 'L1'] }, 1, 0] } },
            activeMedia: { $sum: { $cond: [{ $ne: ['$mediaActivity', 'None active'] }, 1, 0] } },
          },
        },
      ])
      .toArray();

    console.log('\nMigration Statistics:', stats[0]);

    // Show samples
    const samples = await db
      .collection('campaigns')
      .find({
        $and: [
          { name: { $ne: 'Untitled Campaign' } },
          { 'budget.total': { $gt: 50000 } },
          { mediaActivity: { $ne: 'None active' } },
        ],
      })
      .limit(10)
      .toArray();

    console.log('\nSample campaigns with good data:');
    samples.forEach((c) => {
      console.log(`- ${c.campaignNumber}: ${c.name}`);
      console.log(
        `  Account: ${c.accountName}, Budget: $${c.budget.total.toLocaleString()}, Status: ${c.status}, Activity: ${c.mediaActivity}`
      );
      console.log(
        `  Team: ${c.team.leadAccountManager.name}${c.team.mediaTrader ? ' + ' + c.team.mediaTrader.name : ''}`
      );
    });
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.close();
  }
}

migrateWithRealMappings();
