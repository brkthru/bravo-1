import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function inspect() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');

  try {
    await client.connect();
    const db = client.db('mediatool_v2');

    // Get a few sample strategies to see their structure
    const strategies = await db.collection('strategies').find({}).limit(5).toArray();

    console.log('Sample strategy structure:');
    console.log(JSON.stringify(strategies[0], null, 2));

    // Check what fields are commonly available
    const sample = await db
      .collection('strategies')
      .aggregate([
        { $sample: { size: 100 } },
        {
          $project: {
            hasName: { $cond: [{ $ifNull: ['$name', false] }, 1, 0] },
            hasStrategyName: { $cond: [{ $ifNull: ['$strategyName', false] }, 1, 0] },
            hasTitle: { $cond: [{ $ifNull: ['$title', false] }, 1, 0] },
            hasAccountName: { $cond: [{ $ifNull: ['$accountName', false] }, 1, 0] },
            hasCampaignName: { $cond: [{ $ifNull: ['$campaignName', false] }, 1, 0] },
            fields: { $objectToArray: '$$ROOT' },
          },
        },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            hasName: { $sum: '$hasName' },
            hasStrategyName: { $sum: '$hasStrategyName' },
            hasTitle: { $sum: '$hasTitle' },
            hasAccountName: { $sum: '$hasAccountName' },
            hasCampaignName: { $sum: '$hasCampaignName' },
          },
        },
      ])
      .toArray();

    console.log('\nField availability (out of 100 samples):');
    console.log(sample[0]);

    // Look at account data
    const accountIds = strategies.map((s) => s.accountId).filter(Boolean);
    if (accountIds.length > 0) {
      const accounts = await db
        .collection('accounts')
        .find({
          _id: { $in: accountIds },
        })
        .limit(5)
        .toArray();

      console.log('\nSample account:');
      console.log(JSON.stringify(accounts[0], null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

inspect();
