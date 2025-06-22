import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function createProperCampaignNames() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('mediatool_v2');
    
    console.log('Creating proper campaign names...');
    
    // Get all campaigns with their line items
    const campaigns = await db.collection('campaigns').find({}).toArray();
    
    // Get line items for date analysis
    const lineItems = await db.collection('lineItems').find({}).toArray();
    const strategyLineItems = new Map();
    lineItems.forEach(li => {
      if (!strategyLineItems.has(li.strategyId)) {
        strategyLineItems.set(li.strategyId, []);
      }
      strategyLineItems.get(li.strategyId).push(li);
    });
    
    let updated = 0;
    const updates = [];
    
    for (const campaign of campaigns) {
      const lineItemsForCampaign = strategyLineItems.get(campaign._id) || [];
      
      let campaignName = 'Untitled Campaign';
      let accountName = campaign.accountName || 'Unknown Account';
      
      // Extract account name from line item if needed
      if (accountName === 'Unknown Account' && lineItemsForCampaign.length > 0) {
        const firstLineItem = lineItemsForCampaign[0].name;
        if (firstLineItem && firstLineItem.includes(' - ')) {
          accountName = firstLineItem.split(' - ')[0].trim();
        }
      }
      
      // Create campaign name based on account and dates
      if (accountName !== 'Unknown Account') {
        // Determine campaign type based on line items
        const lineItemTypes = lineItemsForCampaign.map(li => {
          const name = li.name || '';
          if (name.toLowerCase().includes('holiday')) return 'Holiday';
          if (name.toLowerCase().includes('recruitment')) return 'Recruitment';
          if (name.toLowerCase().includes('brand')) return 'Brand Awareness';
          if (name.toLowerCase().includes('sem')) return 'Search';
          if (name.toLowerCase().includes('display')) return 'Display';
          if (name.toLowerCase().includes('meta') || name.toLowerCase().includes('facebook')) return 'Social';
          if (name.toLowerCase().includes('ctv') || name.toLowerCase().includes('video')) return 'Video';
          return null;
        }).filter(Boolean);
        
        // Get unique campaign types
        const uniqueTypes = [...new Set(lineItemTypes)];
        const campaignType = uniqueTypes.length > 0 ? uniqueTypes[0] : 'Integrated';
        
        // Determine time period from dates
        let timePeriod = '';
        if (lineItemsForCampaign.length > 0) {
          const dates = lineItemsForCampaign
            .filter(li => li.startDate)
            .map(li => new Date(li.startDate));
          
          if (dates.length > 0) {
            const earliestDate = new Date(Math.min(...dates));
            const month = earliestDate.toLocaleDateString('en-US', { month: 'long' });
            const year = earliestDate.getFullYear();
            const quarter = Math.floor(earliestDate.getMonth() / 3) + 1;
            
            // Special seasonal campaigns
            if ([11, 0].includes(earliestDate.getMonth())) {
              timePeriod = 'Holiday';
            } else if ([5, 6, 7].includes(earliestDate.getMonth())) {
              timePeriod = 'Summer';
            } else if ([2, 3, 4].includes(earliestDate.getMonth())) {
              timePeriod = 'Spring';
            } else if ([8, 9, 10].includes(earliestDate.getMonth())) {
              timePeriod = 'Fall';
            } else {
              timePeriod = `Q${quarter}`;
            }
            
            timePeriod += ` ${year}`;
          } else {
            timePeriod = '2025';
          }
        } else {
          timePeriod = '2025';
        }
        
        // Create campaign name
        campaignName = `${accountName} - ${timePeriod} ${campaignType} Campaign`;
        
        // Shorten if too long
        if (campaignName.length > 60) {
          campaignName = `${accountName} - ${timePeriod} Campaign`;
        }
      }
      
      updates.push({
        updateOne: {
          filter: { _id: campaign._id },
          update: {
            $set: {
              name: campaignName,
              accountName: accountName
            }
          }
        }
      });
      
      updated++;
      
      if (updates.length >= 100) {
        await db.collection('campaigns').bulkWrite(updates);
        console.log(`Updated ${updated} campaigns...`);
        updates.length = 0;
      }
    }
    
    // Process remaining updates
    if (updates.length > 0) {
      await db.collection('campaigns').bulkWrite(updates);
    }
    
    console.log(`\nUpdated ${updated} campaigns with proper names`);
    
    // Show samples
    const samples = await db.collection('campaigns').find({
      name: { $ne: 'Untitled Campaign' }
    }).limit(30).toArray();
    
    console.log('\nSample campaign names:');
    samples.forEach(c => {
      console.log(`- ${c.name}`);
    });
    
    // Test search
    console.log('\nTesting search for "Holiday":');
    const searchResults = await db.collection('campaigns').find({
      name: { $regex: 'Holiday', $options: 'i' }
    }).limit(5).toArray();
    
    searchResults.forEach(c => {
      console.log(`- ${c.name}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

createProperCampaignNames();