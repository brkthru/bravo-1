import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function fixAllCampaignNames() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('mediatool_v2');
    
    console.log('Fixing ALL campaign names...\n');
    
    // Get all line items and group by strategy
    const lineItems = await db.collection('lineItems').find({}).toArray();
    const strategyLineItems = new Map();
    lineItems.forEach(li => {
      if (!strategyLineItems.has(li.strategyId)) {
        strategyLineItems.set(li.strategyId, []);
      }
      strategyLineItems.get(li.strategyId).push(li);
    });
    
    console.log(`Found ${lineItems.length} line items for ${strategyLineItems.size} campaigns`);
    
    // Process all campaigns
    const campaigns = await db.collection('campaigns').find({}).toArray();
    console.log(`Processing ${campaigns.length} total campaigns...\n`);
    
    const updates = [];
    let withLineItems = 0;
    let withoutLineItems = 0;
    let namedFromStrategy = 0;
    let generated = 0;
    
    for (const campaign of campaigns) {
      const lineItemsForCampaign = strategyLineItems.get(campaign._id) || [];
      
      let campaignName = 'Untitled Campaign';
      let accountName = campaign.accountName || 'Unknown Account';
      let campaignType = 'Integrated';
      let timePeriod = '2025';
      
      if (lineItemsForCampaign.length > 0) {
        // Has line items - extract info from them
        withLineItems++;
        
        // Extract account name from first line item if needed
        if (accountName === 'Unknown Account' && lineItemsForCampaign[0].name) {
          const firstLineItem = lineItemsForCampaign[0].name;
          if (firstLineItem.includes(' - ')) {
            accountName = firstLineItem.split(' - ')[0].trim();
          }
        }
        
        // Determine campaign type from line items
        const lineItemTypes = lineItemsForCampaign.map(li => {
          const name = (li.name || '').toLowerCase();
          if (name.includes('holiday')) return 'Holiday';
          if (name.includes('recruitment')) return 'Recruitment';
          if (name.includes('brand')) return 'Brand Awareness';
          if (name.includes('sem') || name.includes('search')) return 'Search';
          if (name.includes('display')) return 'Display';
          if (name.includes('meta') || name.includes('facebook') || name.includes('social')) return 'Social';
          if (name.includes('ctv') || name.includes('video') || name.includes('olv')) return 'Video';
          if (name.includes('native')) return 'Native';
          if (name.includes('audio') || name.includes('spotify')) return 'Audio';
          return null;
        }).filter(Boolean);
        
        if (lineItemTypes.length > 0) {
          campaignType = lineItemTypes[0];
        }
        
        // Determine time period from dates
        const dates = lineItemsForCampaign
          .filter(li => li.startDate)
          .map(li => new Date(li.startDate));
        
        if (dates.length > 0) {
          const earliestDate = new Date(Math.min(...dates));
          const year = earliestDate.getFullYear();
          const month = earliestDate.getMonth();
          
          // Determine season/quarter
          if ([11, 0].includes(month)) {
            timePeriod = `Holiday ${year}`;
          } else if ([2, 3, 4].includes(month)) {
            timePeriod = `Spring ${year}`;
          } else if ([5, 6, 7].includes(month)) {
            timePeriod = `Summer ${year}`;
          } else if ([8, 9, 10].includes(month)) {
            timePeriod = `Fall ${year}`;
          } else {
            const quarter = Math.floor(month / 3) + 1;
            timePeriod = `Q${quarter} ${year}`;
          }
        }
        
      } else if (campaign.strategy) {
        // Has strategy field - use strategy data
        namedFromStrategy++;
        
        if (campaign.strategy.name && campaign.strategy.name !== 'Untitled Strategy') {
          // Use strategy name as base
          const strategyName = campaign.strategy.name;
          if (strategyName.includes(' - ')) {
            accountName = strategyName.split(' - ')[0].trim();
          } else {
            accountName = strategyName;
          }
        }
        
        // Get dates from strategy
        if (campaign.strategy.dates?.start) {
          const startDate = new Date(campaign.strategy.dates.start);
          const year = startDate.getFullYear();
          const month = startDate.getMonth();
          const quarter = Math.floor(month / 3) + 1;
          timePeriod = `Q${quarter} ${year}`;
        }
        
      } else {
        // No line items or strategy - generate name
        withoutLineItems++;
        generated++;
        
        // Generate based on campaign number or ID
        if (campaign.campaignNumber && campaign.campaignNumber.startsWith('CAM-')) {
          const timestamp = parseInt(campaign.campaignNumber.split('-')[1]);
          if (timestamp) {
            const date = new Date(timestamp);
            const year = date.getFullYear();
            const month = date.getMonth();
            const quarter = Math.floor(month / 3) + 1;
            timePeriod = `Q${quarter} ${year}`;
          }
        }
        
        // If we have any dates field
        if (campaign.dates?.start) {
          const startDate = new Date(campaign.dates.start);
          const year = startDate.getFullYear();
          const month = startDate.getMonth();
          const quarter = Math.floor(month / 3) + 1;
          timePeriod = `Q${quarter} ${year}`;
        }
        
        // Generate a generic account name if still unknown
        if (accountName === 'Unknown Account') {
          accountName = `Account ${campaign._id.toString().substring(0, 6).toUpperCase()}`;
        }
      }
      
      // Create final campaign name
      campaignName = `${accountName} - ${timePeriod} ${campaignType} Campaign`;
      
      // Shorten if too long
      if (campaignName.length > 80) {
        campaignName = `${accountName} - ${timePeriod} Campaign`;
      }
      
      updates.push({
        updateOne: {
          filter: { _id: campaign._id },
          update: {
            $set: {
              name: campaignName,
              accountName: accountName,
              lineItemCount: lineItemsForCampaign.length
            }
          }
        }
      });
      
      // Batch update every 1000 records
      if (updates.length >= 1000) {
        await db.collection('campaigns').bulkWrite(updates);
        console.log(`Updated ${updates.length} campaigns...`);
        updates.length = 0;
      }
    }
    
    // Process remaining updates
    if (updates.length > 0) {
      await db.collection('campaigns').bulkWrite(updates);
    }
    
    console.log('\nUpdate Summary:');
    console.log(`- Total campaigns: ${campaigns.length}`);
    console.log(`- Campaigns with line items: ${withLineItems}`);
    console.log(`- Campaigns without line items: ${withoutLineItems}`);
    console.log(`- Named from strategy: ${namedFromStrategy}`);
    console.log(`- Generated names: ${generated}`);
    
    // Verify results
    const namedCount = await db.collection('campaigns').countDocuments({
      name: { $ne: 'Untitled Campaign' }
    });
    const unknownCount = await db.collection('campaigns').countDocuments({
      accountName: 'Unknown Account'
    });
    
    console.log('\nFinal Status:');
    console.log(`- Named campaigns: ${namedCount}`);
    console.log(`- Unnamed campaigns: ${campaigns.length - namedCount}`);
    console.log(`- Unknown account campaigns: ${unknownCount}`);
    
    // Show samples
    const samples = await db.collection('campaigns').aggregate([
      { $sample: { size: 20 } }
    ]).toArray();
    
    console.log('\nRandom sample of campaign names:');
    samples.forEach(c => {
      console.log(`- ${c.name}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

fixAllCampaignNames();