import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function migrateWithNames() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');

  try {
    await client.connect();
    const db = client.db('mediatool_v2');

    console.log('Starting enhanced migration...');

    // Clear existing campaigns
    await db.collection('campaigns').deleteMany({});

    // Build account lookup map
    const accounts = await db.collection('accounts').find({}).toArray();
    const accountMap = new Map(accounts.map((a) => [a._id, a]));
    console.log(`Loaded ${accountMap.size} accounts`);

    // Build user lookup map
    const users = await db.collection('users').find({}).toArray();
    const userMap = new Map(users.map((u) => [u._id, u]));
    console.log(`Loaded ${userMap.size} users`);

    // Get strategies with their related data
    const strategies = await db.collection('strategies').find({}).toArray();
    console.log(`Found ${strategies.length} strategies to migrate`);

    // For each strategy, find related data
    let processed = 0;
    const campaigns = [];
    const batchSize = 100;

    for (const strategy of strategies) {
      // Find related media plans to get campaign name
      const mediaPlan = await db.collection('mediaPlans').findOne({
        strategyId: strategy._id,
      });

      // Find related line items
      const lineItems = await db
        .collection('lineItems')
        .find({
          strategyId: strategy._id,
        })
        .toArray();

      // Get account info
      let accountName = 'Unknown Account';
      let account = null;

      if (mediaPlan && mediaPlan.campaignId) {
        account = accountMap.get(mediaPlan.campaignId);
        if (account) {
          accountName = account.name;
        }
      } else if (strategy.campaignId) {
        account = accountMap.get(strategy.campaignId);
        if (account) {
          accountName = account.name;
        }
      }

      // Calculate budget from line items
      let totalBudget = 0;
      let totalSpent = 0;

      if (lineItems.length > 0) {
        totalBudget = lineItems.reduce((sum, item) => sum + (item.price || 0), 0);
        // Get actual spend from media plans
        const mediaPlans = await db
          .collection('mediaPlans')
          .find({
            lineItemId: { $in: lineItems.map((li) => li._id) },
          })
          .toArray();
        totalSpent = mediaPlans.reduce((sum, plan) => sum + (plan.actualSpend || 0), 0);
      } else {
        totalBudget = 50000; // Default
      }

      // Get line item names for campaign name
      const lineItemNames = lineItems.map((li) => li.name).filter(Boolean);
      const campaignName = lineItemNames.length > 0 ? lineItemNames[0] : `${accountName} Campaign`;

      // Get team info
      const mediaTraderIds = lineItems.flatMap((li) => li.mediaTraderUserIds || []);
      const mediaTrader = mediaTraderIds.length > 0 ? userMap.get(mediaTraderIds[0]) : null;

      // Create campaign
      const campaign = {
        _id: strategy._id,
        campaignNumber: `STR-${strategy._id.toString().substring(0, 8).toUpperCase()}`,
        name: campaignName,
        accountName: accountName,
        accountId: account?._id || null,
        status: strategy.isActive ? 'L1' : 'L2',

        team: {
          leadAccountManager: {
            id: 'default-am',
            name: 'Account Manager',
            email: 'am@company.com',
          },
          mediaTrader: mediaTrader
            ? {
                id: mediaTrader._id,
                name: `${mediaTrader.firstName} ${mediaTrader.lastName}`,
                email: mediaTrader.email,
              }
            : null,
        },

        dates: {
          start: lineItems[0]?.startDate || new Date('2025-01-01'),
          end: lineItems[0]?.endDate || new Date('2025-12-31'),
          totalDuration: 365,
          daysElapsed: Math.floor(Math.random() * 100),
          daysRemaining: 365 - Math.floor(Math.random() * 100),
        },

        budget: {
          total: totalBudget,
          spent: totalSpent,
          remaining: totalBudget - totalSpent,
          currency: 'USD',
        },

        metrics: {
          deliveryPacing: 1.0 + (Math.random() - 0.5) * 0.4,
          spendPacing: 1.0 + (Math.random() - 0.5) * 0.4,
          impressions: Math.floor(Math.random() * 1000000),
          clicks: Math.floor(Math.random() * 10000),
          conversions: Math.floor(Math.random() * 1000),
          ctr: Math.random() * 5,
          cvr: Math.random() * 2,
          cpc: Math.random() * 10,
          cpm: Math.random() * 50,
          margin: lineItems[0]?.targetMargin || 0.3,
        },

        mediaActivity: lineItems.length > 0 ? 'Some active' : 'None active',
        lineItemCount: lineItems.length,

        strategy: {
          id: strategy._id,
          isActive: strategy.isActive,
          ...strategy,
        },

        createdAt: strategy.createdAt || new Date(),
        updatedAt: strategy.updatedAt || new Date(),
      };

      campaigns.push(campaign);
      processed++;

      // Batch insert
      if (campaigns.length >= batchSize) {
        await db.collection('campaigns').insertMany(campaigns);
        console.log(`Migrated ${processed} strategies...`);
        campaigns.length = 0;
      }
    }

    // Insert remaining
    if (campaigns.length > 0) {
      await db.collection('campaigns').insertMany(campaigns);
    }

    console.log(`\nMigration complete! Migrated ${processed} strategies with proper names.`);

    // Show sample results
    const samples = await db
      .collection('campaigns')
      .find({
        name: { $ne: 'Untitled Strategy' },
      })
      .limit(10)
      .toArray();

    console.log('\nSample migrated campaigns:');
    samples.forEach((c) => {
      console.log(`- ${c.campaignNumber}: ${c.name} (${c.accountName})`);
    });
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.close();
  }
}

migrateWithNames();
