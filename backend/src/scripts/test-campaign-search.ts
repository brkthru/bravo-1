import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function testCampaignSearch() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('mediatool_v2');
    
    console.log('Testing campaign search functionality...\n');
    
    // First, check the current state of campaign names
    const totalCampaigns = await db.collection('campaigns').countDocuments();
    const namedCampaigns = await db.collection('campaigns').countDocuments({
      name: { $ne: 'Untitled Campaign' }
    });
    
    console.log(`Total campaigns: ${totalCampaigns}`);
    console.log(`Named campaigns: ${namedCampaigns}`);
    console.log(`Unnamed campaigns: ${totalCampaigns - namedCampaigns}\n`);
    
    // Test various search queries
    const testQueries = [
      'Holiday',
      'Q1',
      'Q2', 
      'Q3',
      'Q4',
      '2025',
      'Display',
      'Search',
      'Social',
      'Video',
      'Brand',
      'Recruitment',
      'Spring',
      'Summer',
      'Fall',
      'sw',
      'test'
    ];
    
    console.log('Testing search queries:\n');
    
    for (const query of testQueries) {
      const results = await db.collection('campaigns').find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { campaignNumber: { $regex: query, $options: 'i' } },
          { accountName: { $regex: query, $options: 'i' } }
        ]
      }).toArray();
      
      console.log(`Query: "${query}" - Found ${results.length} results`);
      
      if (results.length > 0 && results.length <= 3) {
        results.forEach(r => {
          console.log(`  - ${r.name} (${r.accountName || 'No account'})`);
        });
      } else if (results.length > 3) {
        // Show first 3 results
        results.slice(0, 3).forEach(r => {
          console.log(`  - ${r.name} (${r.accountName || 'No account'})`);
        });
        console.log(`  ... and ${results.length - 3} more`);
      }
      console.log('');
    }
    
    // Test text index search
    console.log('Testing text index search:\n');
    
    // Ensure text index exists
    try {
      await db.collection('campaigns').createIndex({ name: 'text' });
    } catch (error) {
      // Index might already exist
    }
    
    const textSearchQueries = ['Holiday Campaign', 'Display', 'Q1 2025'];
    
    for (const query of textSearchQueries) {
      const results = await db.collection('campaigns').find({
        $text: { $search: query }
      }).limit(5).toArray();
      
      console.log(`Text search: "${query}" - Found ${results.length} results`);
      results.forEach(r => {
        console.log(`  - ${r.name}`);
      });
      console.log('');
    }
    
    // Check if there are still unnamed campaigns
    const unnamedSample = await db.collection('campaigns').find({
      name: 'Untitled Campaign'
    }).limit(5).toArray();
    
    if (unnamedSample.length > 0) {
      console.log('\nStill have unnamed campaigns:');
      unnamedSample.forEach(c => {
        console.log(`  - ${c._id} (${c.accountName || 'No account'})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

testCampaignSearch();