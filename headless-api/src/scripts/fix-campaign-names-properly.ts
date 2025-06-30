import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function fixCampaignNamesProperly() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');

  try {
    await client.connect();
    const db = client.db('mediatool_v2');

    console.log('Fixing campaign names properly...');

    // Get all line items grouped by strategy
    const lineItems = await db.collection('lineItems').find({}).toArray();
    console.log(`Found ${lineItems.length} line items`);

    // Group by strategy
    const strategyLineItems = new Map();
    lineItems.forEach((li) => {
      if (!strategyLineItems.has(li.strategyId)) {
        strategyLineItems.set(li.strategyId, []);
      }
      strategyLineItems.get(li.strategyId).push(li);
    });

    console.log(`Strategies with line items: ${strategyLineItems.size}`);

    // Get all accounts
    const accounts = await db.collection('accounts').find({}).toArray();
    const accountMap = new Map(accounts.map((a) => [a._id, a]));

    // Get all media plans for account mapping
    const mediaPlans = await db.collection('mediaPlans').find({}).toArray();
    const strategyToAccount = new Map();

    mediaPlans.forEach((mp) => {
      if (mp.strategyId && mp.campaignId && accountMap.has(mp.campaignId)) {
        strategyToAccount.set(mp.strategyId, accountMap.get(mp.campaignId));
      }
    });

    console.log(`Strategies with account mapping: ${strategyToAccount.size}`);

    // Update campaigns
    let updated = 0;
    let namedFromLineItems = 0;
    let namedFromAccounts = 0;

    for (const [strategyId, lineItemList] of strategyLineItems) {
      const account = strategyToAccount.get(strategyId);
      let campaignName = 'Untitled Campaign';
      let accountName = 'Unknown Account';

      // Get campaign name from line items
      if (lineItemList.length > 0 && lineItemList[0].name) {
        const lineItemName = lineItemList[0].name;

        // Extract account name and campaign type from line item name
        if (lineItemName.includes(' - ')) {
          const parts = lineItemName.split(' - ');
          accountName = parts[0].trim();
          campaignName = lineItemName; // Use full line item name for now
        } else {
          campaignName = lineItemName;
        }
        namedFromLineItems++;
      }

      // Override with actual account name if we have it
      if (account) {
        accountName = account.name;
        if (campaignName === 'Untitled Campaign') {
          campaignName = `${account.name} Campaign`;
          namedFromAccounts++;
        }
      }

      // Update the campaign
      await db.collection('campaigns').updateOne(
        { _id: strategyId },
        {
          $set: {
            name: campaignName,
            accountName: accountName,
            lineItemCount: lineItemList.length,
          },
        }
      );

      updated++;

      if (updated % 100 === 0) {
        console.log(`Updated ${updated} campaigns...`);
      }
    }

    // For campaigns without line items, try to get account name from media plans
    const campaignsWithoutLineItems = await db
      .collection('campaigns')
      .find({
        name: 'Untitled Campaign',
      })
      .toArray();

    console.log(`\nFixing ${campaignsWithoutLineItems.length} campaigns without line items...`);

    for (const campaign of campaignsWithoutLineItems) {
      const account = strategyToAccount.get(campaign._id);
      if (account) {
        await db.collection('campaigns').updateOne(
          { _id: campaign._id },
          {
            $set: {
              name: `${account.name} Campaign`,
              accountName: account.name,
            },
          }
        );
        updated++;
      }
    }

    console.log(`\nFixed ${updated} campaigns total`);
    console.log(`- ${namedFromLineItems} named from line items`);
    console.log(`- ${namedFromAccounts} named from accounts`);

    // Show samples
    const samples = await db
      .collection('campaigns')
      .find({
        name: { $ne: 'Untitled Campaign' },
      })
      .limit(20)
      .toArray();

    console.log('\nSample campaigns with names:');
    samples.forEach((c) => {
      console.log(`- ${c.name} (${c.accountName})`);
    });

    // Test search again
    console.log('\nTesting search for "sw":');
    const searchResults = await db
      .collection('campaigns')
      .find({
        $or: [
          { name: { $regex: 'sw', $options: 'i' } },
          { accountName: { $regex: 'sw', $options: 'i' } },
        ],
      })
      .limit(5)
      .toArray();

    searchResults.forEach((c) => {
      console.log(`- ${c.name} (${c.accountName})`);
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

fixCampaignNamesProperly();
