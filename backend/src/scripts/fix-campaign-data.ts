import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function fixCampaignData() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('mediatool_v2');
    
    console.log('Fixing campaign data with proper names and status...');
    
    // Get accounts for proper campaign naming
    const accounts = await db.collection('accounts').find({}).toArray();
    const accountMap = new Map(accounts.map(a => [a._id, a]));
    
    // Get all strategies with their line items
    const strategies = await db.collection('strategies').find({}).toArray();
    
    let updated = 0;
    const batchSize = 100;
    const updates = [];
    
    for (const strategy of strategies) {
      // Get line items for this strategy
      const lineItems = await db.collection('lineItems').find({ 
        strategyId: strategy._id 
      }).toArray();
      
      // Get media plans to find account
      const mediaPlan = await db.collection('mediaPlans').findOne({ 
        strategyId: strategy._id 
      });
      
      let campaignName = 'Untitled Campaign';
      let accountName = 'Unknown Account';
      let account = null;
      
      // Get account from media plan
      if (mediaPlan && mediaPlan.campaignId) {
        account = accountMap.get(mediaPlan.campaignId);
        if (account) {
          accountName = account.name;
          // Create campaign name from account + year/season
          const year = new Date().getFullYear();
          campaignName = `${account.name} ${year} Campaign`;
        }
      }
      
      // If we have line items, check if they follow a pattern
      if (lineItems.length > 0 && accountName !== 'Unknown Account') {
        // Look for common campaign themes in line items
        const lineItemNames = lineItems.map(li => li.name).filter(Boolean);
        
        // Extract common parts (before first dash usually)
        if (lineItemNames.length > 0) {
          const firstPart = lineItemNames[0].split(' - ')[0];
          // If the first part matches the account name, use a more descriptive campaign name
          if (firstPart.toLowerCase().includes(accountName.toLowerCase().substring(0, 5))) {
            campaignName = `${accountName} Integrated Campaign`;
          } else {
            // Use the common part as campaign name
            campaignName = firstPart;
          }
        }
      }
      
      // Calculate dates from line items
      let startDate = null;
      let endDate = null;
      let isLive = false;
      
      if (lineItems.length > 0) {
        const starts = lineItems.filter(li => li.startDate).map(li => new Date(li.startDate));
        const ends = lineItems.filter(li => li.endDate).map(li => new Date(li.endDate));
        
        if (starts.length > 0) {
          startDate = new Date(Math.min(...starts));
        }
        if (ends.length > 0) {
          endDate = new Date(Math.max(...ends));
        }
        
        // Check if campaign is live
        const now = new Date();
        if (startDate && endDate) {
          isLive = now >= startDate && now <= endDate;
        }
      }
      
      // Determine status based on dates and activity
      let status = 'Draft';
      if (strategy.isActive) {
        if (isLive) {
          status = 'Campaign is Live';
        } else if (startDate && new Date() < startDate) {
          status = 'Scheduled';
        } else if (endDate && new Date() > endDate) {
          status = 'Completed';
        } else {
          status = 'Active';
        }
      } else {
        status = 'Paused';
      }
      
      // Calculate real delivery pacing
      let deliveryPacing = 100;
      let spendPacing = 100;
      
      if (startDate && endDate) {
        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysElapsed = Math.max(0, Math.ceil((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        const expectedProgress = Math.min(100, (daysElapsed / totalDays) * 100);
        
        // Get actual spend from media plans
        const mediaPlans = await db.collection('mediaPlans').find({
          strategyId: strategy._id
        }).toArray();
        
        const totalBudget = lineItems.reduce((sum, li) => sum + (li.price || 0), 0) || 50000;
        const totalSpent = mediaPlans.reduce((sum, mp) => sum + (mp.actualSpend || 0), 0);
        
        const actualProgress = (totalSpent / totalBudget) * 100;
        
        deliveryPacing = expectedProgress > 0 ? (actualProgress / expectedProgress) * 100 : 100;
        spendPacing = deliveryPacing; // Can be different based on impressions vs spend
      }
      
      const update = {
        updateOne: {
          filter: { _id: strategy._id },
          update: {
            $set: {
              name: campaignName,
              accountName: accountName,
              displayStatus: status,
              dates: {
                start: startDate,
                end: endDate,
                totalDuration: startDate && endDate ? 
                  Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) : 0,
                daysElapsed: startDate ? 
                  Math.max(0, Math.ceil((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))) : 0,
                daysRemaining: endDate ? 
                  Math.max(0, Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))) : 0
              },
              'metrics.deliveryPacing': deliveryPacing / 100, // Convert to decimal
              'metrics.spendPacing': spendPacing / 100
            }
          }
        }
      };
      
      updates.push(update);
      updated++;
      
      if (updates.length >= batchSize) {
        await db.collection('campaigns').bulkWrite(updates);
        console.log(`Updated ${updated} campaigns...`);
        updates.length = 0;
      }
    }
    
    // Process remaining updates
    if (updates.length > 0) {
      await db.collection('campaigns').bulkWrite(updates);
    }
    
    console.log(`\nFixed ${updated} campaigns with proper names and status.`);
    
    // Show samples
    const samples = await db.collection('campaigns').find({
      displayStatus: 'Campaign is Live'
    }).limit(10).toArray();
    
    console.log('\nSample live campaigns:');
    samples.forEach(c => {
      console.log(`- ${c.name} (${c.accountName})`);
      console.log(`  Status: ${c.displayStatus}`);
      console.log(`  Dates: ${c.dates.start?.toLocaleDateString()} - ${c.dates.end?.toLocaleDateString()}`);
      console.log(`  Pacing: Delivery ${(c.metrics.deliveryPacing * 100).toFixed(1)}%, Spend ${(c.metrics.spendPacing * 100).toFixed(1)}%`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

fixCampaignData();