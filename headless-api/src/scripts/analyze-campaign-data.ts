import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function analyzeCampaignData() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');

  try {
    await client.connect();
    const db = client.db('mediatool_v2');

    console.log('Analyzing campaign data structure...\n');

    // Check total counts
    const totalCampaigns = await db.collection('campaigns').countDocuments();
    const totalLineItems = await db.collection('lineItems').countDocuments();

    console.log(`Total campaigns: ${totalCampaigns}`);
    console.log(`Total line items: ${totalLineItems}\n`);

    // Check campaigns with line items
    const campaignsWithLineItems = await db
      .collection('campaigns')
      .find({
        lineItems: { $exists: true, $ne: [] },
      })
      .limit(5)
      .toArray();

    console.log(`Campaigns with embedded lineItems: ${campaignsWithLineItems.length}`);
    if (campaignsWithLineItems.length > 0) {
      console.log('Sample campaign with lineItems:');
      const sample = campaignsWithLineItems[0];
      console.log(`- Campaign: ${sample.name}`);
      console.log(`- Line items count: ${sample.lineItems?.length || 0}`);
      if (sample.lineItems?.[0]) {
        console.log(`- First line item: ${JSON.stringify(sample.lineItems[0].name)}`);
      }
    }

    // Check line items collection
    console.log('\nChecking lineItems collection:');
    const lineItemsSample = await db.collection('lineItems').find({}).limit(5).toArray();

    console.log(`Sample line items (${lineItemsSample.length} found):`);
    lineItemsSample.forEach((li) => {
      console.log(`- ${li.name || 'Unnamed'} (strategyId: ${li.strategyId})`);
    });

    // Check campaigns that have strategyId references in lineItems
    const lineItemStrategyIds = await db.collection('lineItems').distinct('strategyId');
    console.log(`\nUnique strategyIds in lineItems: ${lineItemStrategyIds.length}`);

    // Check how many campaigns match these strategyIds
    const campaignsWithMatchingIds = await db.collection('campaigns').countDocuments({
      _id: { $in: lineItemStrategyIds },
    });
    console.log(`Campaigns matching lineItem strategyIds: ${campaignsWithMatchingIds}`);

    // Check campaigns with strategy field
    const campaignsWithStrategy = await db
      .collection('campaigns')
      .find({
        strategy: { $exists: true },
      })
      .limit(5)
      .toArray();

    console.log(`\nCampaigns with strategy field: ${campaignsWithStrategy.length}`);
    if (campaignsWithStrategy.length > 0) {
      console.log('Sample campaign with strategy:');
      const sample = campaignsWithStrategy[0];
      console.log(`- Campaign: ${sample.name || 'Unnamed'}`);
      console.log(`- Strategy ID: ${sample.strategy?.id}`);
      console.log(`- Strategy fields: ${Object.keys(sample.strategy || {}).join(', ')}`);
    }

    // Check for campaigns with dates
    const campaignsWithDates = await db
      .collection('campaigns')
      .find({
        $or: [{ 'dates.start': { $exists: true } }, { 'strategy.dates.start': { $exists: true } }],
      })
      .limit(5)
      .toArray();

    console.log(`\nCampaigns with dates: ${campaignsWithDates.length}`);
    campaignsWithDates.forEach((c) => {
      const dates = c.dates || c.strategy?.dates;
      if (dates) {
        console.log(`- ${c.name || 'Unnamed'}: ${dates.start} - ${dates.end}`);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

analyzeCampaignData();
