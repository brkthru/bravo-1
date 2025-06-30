import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function understandRelationships() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');

  try {
    await client.connect();
    const db = client.db('mediatool_v2');

    // Get a full account with its relationships
    const account = await db.collection('accounts').findOne({});
    console.log('Full account structure:');
    console.log(JSON.stringify(account, null, 2));

    // Check if accounts have strategyIds
    const accountsWithStrategies = await db
      .collection('accounts')
      .find({
        $or: [
          { strategyIds: { $exists: true } },
          { strategies: { $exists: true } },
          { strategyId: { $exists: true } },
        ],
      })
      .limit(5)
      .toArray();

    console.log('\nAccounts with strategy references:', accountsWithStrategies.length);

    // Check media plans which might have the relationship
    const mediaPlan = await db.collection('mediaPlans').findOne({});
    console.log('\nSample media plan:');
    console.log(JSON.stringify(mediaPlan, null, 2));

    // Let's check line items too
    const lineItem = await db.collection('lineItems').findOne({});
    console.log('\nSample line item:', lineItem);

    // Check mediaBuys
    const mediaBuy = await db.collection('mediaBuys').findOne({});
    console.log('\nSample media buy (first few fields):');
    console.log({
      _id: mediaBuy._id,
      name: mediaBuy.name,
      campaignName: mediaBuy.campaignName,
      accountName: mediaBuy.accountName,
      strategyId: mediaBuy.strategyId,
      accountId: mediaBuy.accountId,
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

understandRelationships();
