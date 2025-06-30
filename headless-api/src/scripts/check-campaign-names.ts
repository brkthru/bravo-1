import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function checkCampaignNames() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');

  try {
    await client.connect();
    const db = client.db('mediatool_v2');

    // Check campaign name distribution
    const nameStats = await db
      .collection('campaigns')
      .aggregate([
        {
          $group: {
            _id: '$name',
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ])
      .toArray();

    console.log('Top 20 campaign names:');
    nameStats.forEach((stat) => {
      console.log(`- "${stat._id}": ${stat.count} campaigns`);
    });

    // Check campaigns with good names
    const goodCampaigns = await db
      .collection('campaigns')
      .find({
        name: { $ne: 'Untitled Campaign' },
        accountName: { $ne: 'Unknown Account' },
      })
      .limit(10)
      .toArray();

    console.log('\nCampaigns with good data:');
    goodCampaigns.forEach((c) => {
      console.log(`- ${c.campaignNumber}: ${c.name} (${c.accountName})`);
      console.log(`  Status: ${c.displayStatus || c.status}`);
      if (c.dates) {
        console.log(`  Dates: ${c.dates.start} - ${c.dates.end}`);
      }
    });

    // Test search
    console.log('\nTesting search for "sw":');
    const searchResults = await db
      .collection('campaigns')
      .find({
        $or: [
          { name: { $regex: 'sw', $options: 'i' } },
          { campaignNumber: { $regex: 'sw', $options: 'i' } },
          { accountName: { $regex: 'sw', $options: 'i' } },
        ],
      })
      .limit(5)
      .toArray();

    console.log(`Found ${searchResults.length} results`);
    searchResults.forEach((c) => {
      console.log(`- ${c.name} (${c.accountName})`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkCampaignNames();
