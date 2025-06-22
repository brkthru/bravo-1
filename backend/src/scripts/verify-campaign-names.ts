import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function verifyCampaignNames() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('mediatool_v2');
    
    // Get fresh counts
    const totalCampaigns = await db.collection('campaigns').countDocuments();
    const namedCampaigns = await db.collection('campaigns').countDocuments({
      name: { $ne: 'Untitled Campaign' }
    });
    const unknownAccountCampaigns = await db.collection('campaigns').countDocuments({
      accountName: 'Unknown Account'
    });
    
    console.log('Campaign Name Status:');
    console.log(`Total campaigns: ${totalCampaigns}`);
    console.log(`Named campaigns: ${namedCampaigns}`);
    console.log(`Unnamed campaigns: ${totalCampaigns - namedCampaigns}`);
    console.log(`Unknown account campaigns: ${unknownAccountCampaigns}\n`);
    
    // Sample named campaigns
    const namedSamples = await db.collection('campaigns').find({
      name: { $ne: 'Untitled Campaign' }
    }).limit(10).toArray();
    
    console.log('Sample named campaigns:');
    namedSamples.forEach(c => {
      console.log(`- ${c.name} (${c.accountName})`);
    });
    
    // Sample unnamed campaigns
    const unnamedSamples = await db.collection('campaigns').find({
      name: 'Untitled Campaign'
    }).limit(5).toArray();
    
    if (unnamedSamples.length > 0) {
      console.log('\nSample unnamed campaigns:');
      unnamedSamples.forEach(c => {
        console.log(`- ${c._id} (${c.accountName || 'No account'})`);
      });
    }
    
    // Test a simple search
    console.log('\nTesting search for "2025":');
    const searchResults = await db.collection('campaigns').find({
      name: { $regex: '2025', $options: 'i' }
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

verifyCampaignNames();