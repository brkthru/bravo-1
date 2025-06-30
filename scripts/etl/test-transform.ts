#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';

const INPUT_DIR = './data-export';
const OUTPUT_DIR = './data-transformed-test';

async function testTransform() {
  try {
    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    console.log('Loading PostgreSQL data for testing...');

    // Load limited data for testing
    const campaigns = JSON.parse(
      await fs.readFile(path.join(INPUT_DIR, 'campaigns.json'), 'utf-8')
    );

    console.log(`Loaded ${campaigns.length} campaigns`);

    // Process only first 5 campaigns for testing
    const testCampaigns = campaigns.slice(0, 5);

    console.log('Transforming test campaigns...');

    const transformedCampaigns = testCampaigns.map((campaign: any) => {
      const totalBudget = parseFloat(campaign.budget || '0');

      return {
        _id: campaign.id,
        campaignNumber: campaign.campaign_number,
        name: campaign.campaign_name || 'Unnamed Campaign',

        // Test both budget and price fields
        budget: {
          total: totalBudget,
          allocated: totalBudget,
          spent: 0,
          remaining: totalBudget,
          currency: 'USD',
        },

        price: {
          targetAmount: totalBudget,
          actualAmount: 0,
          remainingAmount: totalBudget,
          currency: 'USD',
          unitType: 'dollars',
        },

        // Test metrics with units instead of impressions
        metrics: {
          units: 0,
          unitType: 'impressions',
          clicks: 0,
          marginAmount: 0,
          marginPercentage: 0,
          lineItemCount: 0,
        },

        dates: {
          start: campaign.flight_date,
          end: campaign.end_date,
        },

        createdAt: campaign.created_at,
        updatedAt: campaign.updated_at,
      };
    });

    // Save test output
    const outputPath = path.join(OUTPUT_DIR, 'campaigns-test.json');
    await fs.writeFile(outputPath, JSON.stringify(transformedCampaigns, null, 2));

    console.log(`\nTest transformation complete!`);
    console.log(`Saved ${transformedCampaigns.length} test campaigns to ${outputPath}`);

    // Show sample output
    console.log('\nSample transformed campaign:');
    console.log(JSON.stringify(transformedCampaigns[0], null, 2));
  } catch (error) {
    console.error('Test transformation failed:', error);
    throw error;
  }
}

// Run test
testTransform()
  .then(() => console.log('\nTest successful!'))
  .catch((error) => {
    console.error('\nTest failed:', error);
    process.exit(1);
  });
