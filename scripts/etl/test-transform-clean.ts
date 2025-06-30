// Test transformation with clean field names
import fs from 'fs/promises';
import path from 'path';

async function testTransform() {
  // Read just first few campaigns
  const campaignsData = await fs.readFile(
    '../mongodb-export-20250618/campaigns_backup.json',
    'utf-8'
  );
  const campaigns = JSON.parse(campaignsData).slice(0, 3);

  console.log('Testing transformation with new field names...\n');

  // Show sample transform
  const sample = campaigns[0];
  const totalPrice = parseFloat(sample.budget || '0');

  const transformed = {
    _id: sample.id,
    campaignNumber: sample.campaign_number,
    name: sample.campaign_name || 'Unnamed Campaign',

    // NEW: price instead of budget
    price: {
      targetAmount: totalPrice,
      actualAmount: 0,
      remainingAmount: totalPrice,
      currency: 'USD',
    },

    // NEW: updated team structure
    team: {
      accountManager: undefined,
      csd: undefined,
      seniorMediaTraders: [],
      mediaTraders: [],
    },

    // NEW: updated metrics with split margin and units
    metrics: {
      deliveryPacing: 0,
      spendPacing: 0,
      marginAmount: totalPrice * 0.3,
      marginPercentage: 30,
      units: 0, // changed from impressions
      unitType: 'impressions',
      revenueDelivered: 0,
      budgetSpent: 0,
      marginActual: 0,
    },

    // NEW: mediaActivity field
    mediaActivity: 'None active',
  };

  console.log('Original campaign:');
  console.log(
    JSON.stringify(
      {
        id: sample.id,
        campaign_number: sample.campaign_number,
        campaign_name: sample.campaign_name,
        budget: sample.budget,
      },
      null,
      2
    )
  );

  console.log('\nTransformed campaign (key fields):');
  console.log(
    JSON.stringify(
      {
        _id: transformed._id,
        campaignNumber: transformed.campaignNumber,
        name: transformed.name,
        price: transformed.price,
        'metrics.marginAmount': transformed.metrics.marginAmount,
        'metrics.marginPercentage': transformed.metrics.marginPercentage,
        'metrics.units': transformed.metrics.units,
        mediaActivity: transformed.mediaActivity,
      },
      null,
      2
    )
  );

  console.log('\n✅ Transform test completed successfully');
}

testTransform().catch(console.error);
