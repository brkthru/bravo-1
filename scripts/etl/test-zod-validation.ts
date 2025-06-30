#!/usr/bin/env bun
import { CampaignSchema } from '../../shared/src/types';

async function testZodValidation() {
  console.log('Testing Zod validation on loaded campaigns...\n');

  try {
    // Fetch campaigns from API
    const response = await fetch('http://localhost:3001/api/campaigns?limit=5');
    const result = await response.json();

    if (!result.success) {
      console.error('Failed to fetch campaigns:', result.error);
      return;
    }

    const campaigns = result.data;
    console.log(`Testing ${campaigns.length} campaigns...\n`);

    let validCount = 0;
    let invalidCount = 0;

    for (const [index, campaign] of campaigns.entries()) {
      try {
        // Convert date strings to Date objects and numbers for validation
        const campaignWithDates = {
          ...campaign,
          dates: {
            ...campaign.dates,
            start: campaign.dates.start ? new Date(campaign.dates.start) : null,
            end: campaign.dates.end ? new Date(campaign.dates.end) : null,
          },
          price: {
            ...campaign.price,
            targetAmount:
              typeof campaign.price.targetAmount === 'string'
                ? parseFloat(campaign.price.targetAmount)
                : campaign.price.targetAmount,
            actualAmount:
              typeof campaign.price.actualAmount === 'string'
                ? parseFloat(campaign.price.actualAmount)
                : campaign.price.actualAmount,
            remainingAmount:
              typeof campaign.price.remainingAmount === 'string'
                ? parseFloat(campaign.price.remainingAmount)
                : campaign.price.remainingAmount,
          },
          createdAt: new Date(campaign.createdAt),
          updatedAt: new Date(campaign.updatedAt),
          lineItems: campaign.lineItems.map((li: any) => ({
            ...li,
            dates: {
              start: li.dates?.start ? new Date(li.dates.start) : null,
              end: li.dates?.end ? new Date(li.dates.end) : null,
            },
          })),
        };

        // Validate with Zod schema
        CampaignSchema.parse(campaignWithDates);
        validCount++;
        console.log(`✅ Campaign ${index + 1}: "${campaign.name}" - VALID`);
      } catch (error: any) {
        invalidCount++;
        console.log(`❌ Campaign ${index + 1}: "${campaign.name}" - INVALID`);
        if (error.errors) {
          console.log('   Validation errors:');
          error.errors.forEach((err: any) => {
            console.log(`   - ${err.path.join('.')}: ${err.message}`);
          });
        } else {
          console.log('   Error:', error.message);
        }
      }
    }

    console.log(`\nSummary:`);
    console.log(`  Valid campaigns: ${validCount}`);
    console.log(`  Invalid campaigns: ${invalidCount}`);
    console.log(`  Success rate: ${((validCount / campaigns.length) * 100).toFixed(1)}%`);
  } catch (error) {
    console.error('Error during validation test:', error);
  }
}

testZodValidation();
