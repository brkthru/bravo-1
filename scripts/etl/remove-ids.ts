#!/usr/bin/env bun
import * as fs from 'fs/promises';

async function removeIds() {
  console.log('Reading campaigns data...');
  const data = JSON.parse(await fs.readFile('./data-transformed/campaigns-decimal.json', 'utf-8'));

  console.log(`Processing ${data.length} campaigns...`);

  // Remove _id fields from campaigns
  const campaignsWithoutIds = data.map((campaign: any) => {
    const { _id, ...campaignWithoutId } = campaign;

    // Also remove _id from nested strategies if they exist
    if (campaignWithoutId.strategies) {
      campaignWithoutId.strategies = campaignWithoutId.strategies.map((strategy: any) => {
        if (typeof strategy === 'object' && strategy._id) {
          const { _id, ...strategyWithoutId } = strategy;
          return strategyWithoutId;
        }
        return strategy;
      });
    }

    return campaignWithoutId;
  });

  // Save the modified data
  await fs.writeFile(
    './data-transformed/campaigns-decimal.json',
    JSON.stringify(campaignsWithoutIds, null, 2)
  );

  console.log('Successfully removed _id fields from campaigns data!');
}

removeIds().catch(console.error);
