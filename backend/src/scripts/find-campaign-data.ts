import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function findCampaignData() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('mediatool_v2');
    
    // Get a strategy with campaignId
    const strategy = await db.collection('strategies').findOne({ campaignId: { $exists: true } });
    console.log('Sample strategy with campaignId:', strategy);
    
    // Check accounts collection
    const accounts = await db.collection('accounts').find({}).limit(5).toArray();
    console.log('\nSample accounts:');
    accounts.forEach(acc => {
      console.log(`- ${acc._id}: ${acc.name || acc.accountName || 'No name'}`);
    });
    
    // Check if campaignId relates to accounts
    if (strategy && strategy.campaignId) {
      const account = await db.collection('accounts').findOne({ 
        $or: [
          { _id: strategy.campaignId },
          { campaignId: strategy.campaignId },
          { id: strategy.campaignId }
        ]
      });
      console.log('\nAccount for campaign:', account);
    }
    
    // Look for any collection with campaign in the name
    const collections = await db.listCollections().toArray();
    const campaignCollections = collections.filter(c => 
      c.name.toLowerCase().includes('campaign') || 
      c.name.toLowerCase().includes('strategy')
    );
    console.log('\nRelevant collections:');
    campaignCollections.forEach(c => console.log(`- ${c.name}`));
    
    // Check the system.views collection for campaign views
    const views = await db.collection('system.views').find({}).toArray();
    console.log('\nViews:', views.map(v => v._id));
    
    // Try strategies view if it exists
    if (collections.some(c => c.name === 'strategiesView')) {
      const strategiesView = await db.collection('strategiesView').find({}).limit(3).toArray();
      console.log('\nStrategies view sample:');
      console.log(JSON.stringify(strategiesView[0], null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

findCampaignData();