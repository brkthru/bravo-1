#!/usr/bin/env bun
/**
 * Analyze media trader assignments from line items
 * and aggregate them up to campaign level
 */

import fs from 'fs/promises';
import path from 'path';

const EXPORT_DIR = '../../exports/raw/20250628-154322';

async function loadJsonFile(filename: string): Promise<any[]> {
  const filepath = path.join(EXPORT_DIR, filename);
  const content = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(content);
}

async function analyzeMediaTraders() {
  console.log('Analyzing media trader assignments...\n');

  // Load all necessary data
  const campaigns = await loadJsonFile('campaigns.json');
  const strategies = await loadJsonFile('strategies.json');
  const lineItems = await loadJsonFile('line_items.json');
  const users = await loadJsonFile('users.json');

  console.log(`Loaded data:
  - ${campaigns.length} campaigns
  - ${strategies.length} strategies
  - ${lineItems.length} line items
  - ${users.length} users\n`);

  // Create maps for lookups
  const userMap = new Map(users.map((u) => [u.id, u]));
  const strategyMap = new Map(strategies.map((s) => [s.id, s]));

  // Map strategies to campaigns
  const strategiesByCampaign = new Map<string, any[]>();
  strategies.forEach((strategy) => {
    if (!strategiesByCampaign.has(strategy.campaign_id)) {
      strategiesByCampaign.set(strategy.campaign_id, []);
    }
    strategiesByCampaign.get(strategy.campaign_id)!.push(strategy);
  });

  // Analyze media trader assignments
  let lineItemsWithTraders = 0;
  let totalMediaTraderAssignments = 0;
  const uniqueMediaTraders = new Set<string>();
  const mediaTradersByCampaign = new Map<string, Set<string>>();

  // Process each line item
  lineItems.forEach((lineItem) => {
    if (lineItem.media_trader_user_ids && lineItem.media_trader_user_ids.length > 0) {
      lineItemsWithTraders++;
      totalMediaTraderAssignments += lineItem.media_trader_user_ids.length;

      // Track unique traders
      lineItem.media_trader_user_ids.forEach((traderId: string) => {
        uniqueMediaTraders.add(traderId);
      });

      // Map to campaign
      const strategy = strategyMap.get(lineItem.strategy_id);
      if (strategy) {
        const campaignId = strategy.campaign_id;
        if (!mediaTradersByCampaign.has(campaignId)) {
          mediaTradersByCampaign.set(campaignId, new Set());
        }
        lineItem.media_trader_user_ids.forEach((traderId: string) => {
          mediaTradersByCampaign.get(campaignId)!.add(traderId);
        });
      }
    }
  });

  console.log('Media Trader Assignment Summary:');
  console.log(
    `- Line items with media traders: ${lineItemsWithTraders} / ${lineItems.length} (${((lineItemsWithTraders / lineItems.length) * 100).toFixed(1)}%)`
  );
  console.log(`- Total media trader assignments: ${totalMediaTraderAssignments}`);
  console.log(`- Unique media traders: ${uniqueMediaTraders.size}`);
  console.log(
    `- Campaigns with media traders: ${mediaTradersByCampaign.size} / ${campaigns.length} (${((mediaTradersByCampaign.size / campaigns.length) * 100).toFixed(1)}%)\n`
  );

  // Sample media traders
  console.log('Sample media trader IDs:');
  const sampleTraders = Array.from(uniqueMediaTraders).slice(0, 5);
  sampleTraders.forEach((traderId) => {
    const user = userMap.get(traderId);
    if (user) {
      console.log(`  - ${traderId}: ${user.name} (${user.email})`);
    } else {
      console.log(`  - ${traderId}: NOT FOUND IN USERS TABLE`);
    }
  });

  // Find a campaign with multiple media traders
  console.log('\nSample campaign with media traders:');
  for (const [campaignId, traders] of mediaTradersByCampaign) {
    if (traders.size > 1) {
      const campaign = campaigns.find((c) => c.id === campaignId);
      if (campaign) {
        console.log(`\nCampaign: ${campaign.campaign_number} - ${campaign.campaign_name}`);
        console.log('Media Traders:');
        traders.forEach((traderId) => {
          const user = userMap.get(traderId);
          if (user) {
            console.log(`  - ${user.name} (${user.email})`);
          }
        });
        break;
      }
    }
  }

  // Distribution analysis
  console.log('\nMedia trader distribution:');
  const distribution: Record<number, number> = {};
  mediaTradersByCampaign.forEach((traders) => {
    const count = traders.size;
    distribution[count] = (distribution[count] || 0) + 1;
  });

  Object.entries(distribution)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([traderCount, campaignCount]) => {
      console.log(`  - ${campaignCount} campaigns have ${traderCount} media trader(s)`);
    });

  return { mediaTradersByCampaign, userMap };
}

analyzeMediaTraders().catch(console.error);
