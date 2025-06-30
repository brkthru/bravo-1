import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function analyzeDataStructure() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');

  try {
    await client.connect();
    const db = client.db('mediatool_v2');

    // Find strategies that have line items
    const strategiesWithLineItems = await db
      .collection('strategies')
      .aggregate([
        {
          $lookup: {
            from: 'lineItems',
            localField: '_id',
            foreignField: 'strategyId',
            as: 'lineItems',
          },
        },
        { $match: { 'lineItems.0': { $exists: true } } },
        { $limit: 5 },
      ])
      .toArray();

    console.log('Strategies with line items:', strategiesWithLineItems.length);

    if (strategiesWithLineItems.length > 0) {
      const strategy = strategiesWithLineItems[0];
      console.log('\nStrategy ID:', strategy._id);
      console.log(
        'Line items:',
        strategy.lineItems.map((li) => ({
          name: li.name,
          price: li.price,
          startDate: li.startDate,
        }))
      );

      // Now find media plans for this strategy
      const mediaPlans = await db
        .collection('mediaPlans')
        .find({
          strategyId: strategy._id,
        })
        .limit(5)
        .toArray();

      console.log('\nMedia plans for this strategy:', mediaPlans.length);
      if (mediaPlans.length > 0) {
        const campaignIds = [...new Set(mediaPlans.map((mp) => mp.campaignId))];
        console.log('Campaign IDs from media plans:', campaignIds);

        // Get accounts for these campaign IDs
        const accounts = await db
          .collection('accounts')
          .find({
            _id: { $in: campaignIds },
          })
          .toArray();

        console.log(
          '\nAccounts found:',
          accounts.map((a) => ({
            id: a._id,
            name: a.name,
          }))
        );
      }
    }

    // Check media buys structure
    const mediaBuys = await db
      .collection('mediaBuys')
      .find({
        $and: [
          { name: { $exists: true, $ne: null } },
          { accountName: { $exists: true, $ne: null } },
        ],
      })
      .limit(5)
      .toArray();

    console.log('\nMedia buys with names:', mediaBuys.length);
    if (mediaBuys.length > 0) {
      console.log('Sample media buy:', {
        name: mediaBuys[0].name,
        accountName: mediaBuys[0].accountName,
        campaignName: mediaBuys[0].campaignName,
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

analyzeDataStructure();
