#!/usr/bin/env bun
/**
 * Convert existing MongoDB data from old schema to new schema
 * Changes:
 * - budget -> price
 * - impressions -> units
 * - Split margin into marginAmount and marginPercentage
 * - Update team structure
 */

import fs from 'fs/promises';
import path from 'path';

const INPUT_FILE = '../../data/mongodb-exports/2025-06-18/campaigns_backup.json';
const OUTPUT_FILE = '../../data/transformed/2025-06-18-mongodb/campaigns-new-schema.json';

interface OldCampaign {
  _id: string;
  campaignNumber: string;
  name: string;
  budget: {
    total: number;
    allocated?: number;
    spent: number;
    remaining: number | string;
    currency?: string;
  };
  team?: {
    leadAccountManager?: any;
    mediaTrader?: any;
  };
  metrics?: {
    deliveryPacing?: number;
    spendPacing?: number;
    margin?: number;
    impressions?: number;
    revenueDelivered?: number;
    budgetSpent?: number;
    marginActual?: number;
  };
  [key: string]: any;
}

async function convertToNewSchema() {
  console.log('Converting campaigns to new schema...');

  // Ensure output directory exists
  await fs.mkdir('./data-transformed', { recursive: true });

  // Read old data
  const oldData = JSON.parse(await fs.readFile(INPUT_FILE, 'utf-8')) as OldCampaign[];
  console.log(`Loaded ${oldData.length} campaigns`);

  // Convert each campaign
  const newData = oldData.map((campaign, index) => {
    if (index % 1000 === 0) {
      console.log(`Converting campaign ${index + 1}/${oldData.length}`);
    }

    // Convert budget to price
    const price = {
      targetAmount: campaign.budget.total || 0,
      actualAmount: campaign.budget.spent || 0,
      remainingAmount:
        typeof campaign.budget.remaining === 'string'
          ? parseFloat(campaign.budget.remaining)
          : campaign.budget.remaining || 0,
      currency: campaign.budget.currency || 'USD',
    };

    // Convert team structure
    const team = {
      accountManager: campaign.team?.leadAccountManager || undefined,
      csd: undefined,
      seniorMediaTraders: [],
      mediaTraders: campaign.team?.mediaTrader ? [campaign.team.mediaTrader] : [],
    };

    // Convert metrics
    const metrics = campaign.metrics
      ? {
          deliveryPacing: campaign.metrics.deliveryPacing || 0,
          spendPacing: campaign.metrics.spendPacing || 0,
          marginAmount: (campaign.metrics.margin || 0) * price.targetAmount,
          marginPercentage: (campaign.metrics.margin || 0) * 100,
          units: campaign.metrics.impressions || 0,
          unitType: 'impressions' as const,
          revenueDelivered: campaign.metrics.revenueDelivered || 0,
          budgetSpent: campaign.metrics.budgetSpent || 0,
          marginActual: campaign.metrics.marginActual || 0,
        }
      : {
          deliveryPacing: 0,
          spendPacing: 0,
          marginAmount: price.targetAmount * 0.3,
          marginPercentage: 30,
          units: 0,
          unitType: 'impressions' as const,
          revenueDelivered: 0,
          budgetSpent: 0,
          marginActual: 0,
        };

    // Build new campaign object
    const newCampaign = {
      ...campaign,
      price,
      team,
      metrics,
      // Remove old fields
      budget: undefined,
    };

    // Clean up undefined
    delete newCampaign.budget;

    return newCampaign;
  });

  // Save converted data
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(newData, null, 2));
  console.log(`\nConverted ${newData.length} campaigns`);
  console.log(`Output saved to: ${OUTPUT_FILE}`);

  // Show sample
  console.log('\nSample converted campaign:');
  console.log(
    JSON.stringify(
      {
        campaignNumber: newData[0].campaignNumber,
        name: newData[0].name,
        price: newData[0].price,
        'metrics.marginAmount': newData[0].metrics.marginAmount,
        'metrics.marginPercentage': newData[0].metrics.marginPercentage,
        'metrics.units': newData[0].metrics.units,
      },
      null,
      2
    )
  );
}

// Run conversion
convertToNewSchema().catch(console.error);
