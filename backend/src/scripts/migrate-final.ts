import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function migrateFinal() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('mediatool_v2');
    
    console.log('Starting final migration with enhanced name resolution...');
    
    // Clear campaigns
    await db.collection('campaigns').deleteMany({});
    
    // Preload all data for performance
    console.log('Loading reference data...');
    const accounts = await db.collection('accounts').find({}).toArray();
    const accountMap = new Map(accounts.map(a => [a._id, a]));
    
    const users = await db.collection('users').find({}).toArray();
    const userMap = new Map(users.map(u => [u._id, u]));
    
    // Create a map of strategy to line items
    const lineItems = await db.collection('lineItems').find({}).toArray();
    const strategyToLineItems = new Map();
    lineItems.forEach(li => {
      if (!strategyToLineItems.has(li.strategyId)) {
        strategyToLineItems.set(li.strategyId, []);
      }
      strategyToLineItems.get(li.strategyId).push(li);
    });
    
    // Create a map of strategy to media plans
    const mediaPlans = await db.collection('mediaPlans').find({}).toArray();
    const strategyToMediaPlans = new Map();
    mediaPlans.forEach(mp => {
      if (!strategyToMediaPlans.has(mp.strategyId)) {
        strategyToMediaPlans.set(mp.strategyId, []);
      }
      strategyToMediaPlans.get(mp.strategyId).push(mp);
    });
    
    console.log(`Loaded ${accounts.length} accounts, ${users.length} users, ${lineItems.length} line items`);
    
    // Get all strategies
    const strategies = await db.collection('strategies').find({}).toArray();
    console.log(`Processing ${strategies.length} strategies...`);
    
    const campaigns = [];
    let processed = 0;
    let namedCount = 0;
    
    for (const strategy of strategies) {
      const strategyLineItems = strategyToLineItems.get(strategy._id) || [];
      const strategyMediaPlans = strategyToMediaPlans.get(strategy._id) || [];
      
      // Try to find account through multiple paths
      let account = null;
      let accountName = 'Unknown Account';
      
      // Path 1: Through media plans campaignId
      if (strategyMediaPlans.length > 0) {
        const campaignIds = [...new Set(strategyMediaPlans.map(mp => mp.campaignId).filter(Boolean))];
        for (const campaignId of campaignIds) {
          account = accountMap.get(campaignId);
          if (account) break;
        }
      }
      
      // Path 2: Through strategy campaignId
      if (!account && strategy.campaignId) {
        account = accountMap.get(strategy.campaignId);
      }
      
      if (account) {
        accountName = account.name;
      }
      
      // Get campaign name from line items or create from account
      let campaignName = 'Untitled Campaign';
      
      if (strategyLineItems.length > 0) {
        // Use first line item name
        campaignName = strategyLineItems[0].name;
        namedCount++;
      } else if (account) {
        // Create from account name
        campaignName = `${account.name} - Strategy ${strategy._id.substring(0, 6)}`;
      }
      
      // Calculate totals
      const totalBudget = strategyLineItems.reduce((sum, li) => sum + (li.price || 0), 0) || 50000;
      const totalSpent = strategyMediaPlans.reduce((sum, mp) => sum + (mp.actualSpend || 0), 0);
      
      // Get dates from line items
      let startDate = new Date('2025-01-01');
      let endDate = new Date('2025-12-31');
      
      if (strategyLineItems.length > 0) {
        const dates = strategyLineItems
          .filter(li => li.startDate)
          .map(li => new Date(li.startDate));
        if (dates.length > 0) {
          startDate = new Date(Math.min(...dates));
        }
        
        const endDates = strategyLineItems
          .filter(li => li.endDate)
          .map(li => new Date(li.endDate));
        if (endDates.length > 0) {
          endDate = new Date(Math.max(...endDates));
        }
      }
      
      // Get team info
      const mediaTraderIds = strategyLineItems.flatMap(li => li.mediaTraderUserIds || []);
      const mediaTrader = mediaTraderIds.length > 0 ? userMap.get(mediaTraderIds[0]) : null;
      
      const campaign = {
        _id: strategy._id,
        campaignNumber: `CN-${(10000 + processed).toString()}`,
        name: campaignName,
        accountName: accountName,
        accountId: account?._id || null,
        status: strategy.isActive ? 'L1' : 'L2',
        
        team: {
          leadAccountManager: {
            id: account?.teamId || 'default-am',
            name: 'Account Manager',
            email: 'am@bravomedia.com'
          },
          mediaTrader: mediaTrader ? {
            id: mediaTrader._id,
            name: `${mediaTrader.firstName} ${mediaTrader.lastName}`,
            email: mediaTrader.email
          } : null
        },
        
        dates: {
          start: startDate,
          end: endDate,
          totalDuration: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)),
          daysElapsed: Math.floor(Math.random() * 100),
          daysRemaining: Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24))
        },
        
        budget: {
          total: totalBudget,
          spent: totalSpent,
          remaining: totalBudget - totalSpent,
          currency: 'USD'
        },
        
        metrics: {
          deliveryPacing: 0.8 + Math.random() * 0.4,
          spendPacing: 0.8 + Math.random() * 0.4,
          impressions: Math.floor(Math.random() * 1000000),
          clicks: Math.floor(Math.random() * 10000),
          conversions: Math.floor(Math.random() * 1000),
          ctr: Math.random() * 5,
          cvr: Math.random() * 2,
          cpc: Math.random() * 10,
          cpm: Math.random() * 50,
          margin: strategyLineItems[0]?.targetMargin || 0.3
        },
        
        mediaActivity: strategyLineItems.length > 0 ? 
          (Math.random() > 0.5 ? 'Some active' : 'All active') : 
          'None active',
        
        lineItemCount: strategyLineItems.length,
        
        createdAt: strategy.createdAt || new Date(),
        updatedAt: strategy.updatedAt || new Date()
      };
      
      campaigns.push(campaign);
      processed++;
      
      if (campaigns.length >= 100) {
        await db.collection('campaigns').insertMany(campaigns);
        console.log(`Migrated ${processed} campaigns (${namedCount} with proper names)...`);
        campaigns.length = 0;
      }
    }
    
    // Insert remaining
    if (campaigns.length > 0) {
      await db.collection('campaigns').insertMany(campaigns);
    }
    
    console.log(`\nMigration complete!`);
    console.log(`Total campaigns: ${processed}`);
    console.log(`Campaigns with line item names: ${namedCount}`);
    
    // Show samples
    const namedSamples = await db.collection('campaigns').find({
      name: { $ne: 'Untitled Campaign' },
      lineItemCount: { $gt: 0 }
    }).limit(20).toArray();
    
    console.log('\nSample campaigns with proper data:');
    namedSamples.forEach(c => {
      console.log(`- ${c.campaignNumber}: ${c.name} (${c.accountName}) - ${c.lineItemCount} line items, $${c.budget.total.toLocaleString()}`);
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.close();
  }
}

migrateFinal();