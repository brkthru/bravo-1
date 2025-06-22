import { MongoClient, Db } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function migrate() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db('mediatool_v2');
    
    // Clear existing test campaigns
    await db.collection('campaigns').deleteMany({});
    console.log('Cleared existing campaigns');
    
    // Get all strategies
    const strategies = await db.collection('strategies').find({}).toArray();
    console.log(`Found ${strategies.length} strategies to migrate`);
    
    let processed = 0;
    const batchSize = 100;
    const campaigns = [];
    
    for (const strategy of strategies) {
      // Transform strategy to campaign format
      const campaign = {
        _id: strategy._id,
        campaignNumber: strategy.strategyNumber || `STR-${strategy._id}`,
        name: strategy.name || 'Untitled Strategy',
        status: strategy.status === 'active' ? 'L1' : 'L2',
        
        // Map team from strategy relationships
        team: {
          leadAccountManager: {
            id: strategy.ownerId || 'default-user',
            name: strategy.ownerName || 'Account Manager',
            email: strategy.ownerEmail || 'am@company.com'
          },
          mediaTrader: strategy.mediaTraderId ? {
            id: strategy.mediaTraderId,
            name: strategy.mediaTraderName || 'Media Trader',
            email: strategy.mediaTraderEmail || 'mt@company.com'
          } : null
        },
        
        // Map dates
        dates: strategy.dates || {
          start: strategy.startDate || new Date('2025-01-01'),
          end: strategy.endDate || new Date('2025-12-31'),
          totalDuration: 365,
          daysElapsed: 45,
          daysRemaining: 320
        },
        
        // Map budget
        budget: {
          total: strategy.budget || 50000,
          spent: strategy.spent || 0,
          remaining: (strategy.budget || 50000) - (strategy.spent || 0),
          currency: strategy.currency || 'USD'
        },
        
        // Map metrics
        metrics: {
          deliveryPacing: strategy.deliveryPacing || 1.0,
          spendPacing: strategy.spendPacing || 1.0,
          impressions: strategy.impressions || 0,
          clicks: strategy.clicks || 0,
          conversions: strategy.conversions || 0,
          ctr: strategy.ctr || 0,
          cvr: strategy.cvr || 0,
          cpc: strategy.cpc || 0,
          cpm: strategy.cpm || 0,
          margin: strategy.margin || 0.3
        },
        
        mediaActivity: strategy.mediaActivity || 'None active',
        
        // Keep strategy reference
        strategy: {
          id: strategy._id.toString(),
          status: strategy.status || 'active',
          ...strategy
        },
        
        createdAt: strategy.createdAt || new Date(),
        updatedAt: strategy.updatedAt || new Date()
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
    
    // Insert remaining campaigns
    if (campaigns.length > 0) {
      await db.collection('campaigns').insertMany(campaigns);
    }
    
    console.log(`\nMigration complete! Migrated ${processed} strategies to campaigns.`);
    
    // Verify
    const count = await db.collection('campaigns').countDocuments();
    console.log(`Total campaigns in database: ${count}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.close();
  }
}

migrate();