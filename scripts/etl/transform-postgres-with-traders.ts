#!/usr/bin/env bun
/**
 * Enhanced PostgreSQL to MongoDB transformation that includes media traders
 * Aggregates media trader assignments from line items to campaign level
 */

import fs from 'fs/promises';
import path from 'path';
import { ObjectId } from 'mongodb';

const POSTGRES_BACKUP_DIR = '../../exports/raw/20250628-154322';
const OUTPUT_DIR = '../../data/transformed/20250628-154322';

async function readJsonFile(filename: string): Promise<any[]> {
  const filepath = path.join(POSTGRES_BACKUP_DIR, filename);
  const content = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(content);
}

// Status mapping function
function mapCampaignStatus(pgStatus: string): string {
  const statusMap: Record<string, string> = {
    New: 'L1',
    Planning: 'L2',
    Approved: 'L2',
    Live: 'L3',
    Paused: 'L3',
    Completed: 'L3',
  };
  return statusMap[pgStatus] || 'L1';
}

async function transformWithMediaTraders() {
  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    console.log('Loading PostgreSQL data...');

    // Load all data
    const campaigns = await readJsonFile('campaigns.json');
    const accounts = await readJsonFile('accounts.json');
    const users = await readJsonFile('users.json');
    const strategies = await readJsonFile('strategies.json');
    const lineItems = await readJsonFile('line_items.json');

    console.log(`Loaded:
  - ${campaigns.length} campaigns
  - ${accounts.length} accounts
  - ${users.length} users
  - ${strategies.length} strategies
  - ${lineItems.length} line items\n`);

    // Create lookup maps
    const userMap = new Map(users.map((u) => [u.id, u]));
    const userByZohoId = new Map(users.map((u) => [u.zoho_user_id, u]));
    const accountMap = new Map(accounts.map((a) => [a.id, a]));

    // Map strategies to campaigns
    const strategiesByCampaign = new Map<string, any[]>();
    strategies.forEach((strategy) => {
      if (!strategiesByCampaign.has(strategy.campaign_id)) {
        strategiesByCampaign.set(strategy.campaign_id, []);
      }
      strategiesByCampaign.get(strategy.campaign_id)!.push(strategy);
    });

    // Map line items to strategies
    const lineItemsByStrategy = new Map<string, any[]>();
    lineItems.forEach((item) => {
      if (!lineItemsByStrategy.has(item.strategy_id)) {
        lineItemsByStrategy.set(item.strategy_id, []);
      }
      lineItemsByStrategy.get(item.strategy_id)!.push(item);
    });

    // Aggregate media traders by campaign
    console.log('Aggregating media traders by campaign...');
    const mediaTradersByCampaign = new Map<string, Set<string>>();

    campaigns.forEach((campaign) => {
      const campaignStrategies = strategiesByCampaign.get(campaign.id) || [];
      const mediaTraders = new Set<string>();

      campaignStrategies.forEach((strategy) => {
        const strategyLineItems = lineItemsByStrategy.get(strategy.id) || [];
        strategyLineItems.forEach((lineItem) => {
          if (lineItem.media_trader_user_ids && Array.isArray(lineItem.media_trader_user_ids)) {
            lineItem.media_trader_user_ids.forEach((traderId: string) => {
              mediaTraders.add(traderId);
            });
          }
        });
      });

      if (mediaTraders.size > 0) {
        mediaTradersByCampaign.set(campaign.id, mediaTraders);
      }
    });

    console.log(`Found ${mediaTradersByCampaign.size} campaigns with media traders\n`);

    // Transform campaigns
    console.log('Transforming campaigns...');
    const transformedCampaigns: any[] = [];

    for (let i = 0; i < campaigns.length; i++) {
      if (i % 1000 === 0) {
        console.log(`Progress: ${i}/${campaigns.length} campaigns`);
      }

      const campaign = campaigns[i];
      if (campaign.is_deleted) continue;

      // Get related data
      const account = accountMap.get(campaign.account_id);
      const leadAccountOwner = userByZohoId.get(campaign.lead_account_owner_user_id);
      const campaignStrategies = strategiesByCampaign.get(campaign.id) || [];
      const campaignMediaTraders = mediaTradersByCampaign.get(campaign.id) || new Set();

      // Calculate line item counts
      let totalLineItems = 0;
      campaignStrategies.forEach((strategy) => {
        const items = lineItemsByStrategy.get(strategy.id) || [];
        totalLineItems += items.length;
      });

      // Calculate dates
      const now = new Date();
      const startDate = campaign.flight_date ? new Date(campaign.flight_date) : null;
      const endDate = campaign.end_date ? new Date(campaign.end_date) : null;

      let daysElapsed = 0;
      let totalDuration = 0;

      if (startDate && endDate) {
        totalDuration = Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (startDate <= now) {
          daysElapsed = Math.min(
            Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
            totalDuration
          );
        }
      }

      // Transform media traders to team structure
      const mediaTradersList = Array.from(campaignMediaTraders)
        .map((traderId) => {
          const user = userMap.get(traderId);
          if (user) {
            return {
              id: user.zoho_user_id || user.id,
              name: user.name,
              email: user.email,
              role: 'media_trader',
            };
          }
          return null;
        })
        .filter(Boolean);

      // Transform to new schema
      const targetAmount = Number(campaign.budget) || 0;
      const actualAmount = targetAmount * 0.3; // Simulate 30% spent

      const transformed = {
        _id: new ObjectId().toString(),
        campaignId: campaign.id,
        campaignNumber: campaign.campaign_number,
        name: campaign.campaign_name,
        status: mapCampaignStatus(campaign.stage),
        displayStatus: campaign.stage,
        accountId: campaign.account_id,
        accountName: account?.account_name,
        agencyId: campaign.agency_id || undefined,
        team: {
          accountManager: leadAccountOwner
            ? {
                id: leadAccountOwner.zoho_user_id,
                name: leadAccountOwner.name,
                email: leadAccountOwner.email,
                role: 'account_manager',
              }
            : undefined,
          csd: undefined, // Not in export
          seniorMediaTraders: [], // TODO: Determine how to identify senior vs regular
          mediaTraders: mediaTradersList,
        },
        dates: {
          start: startDate?.toISOString(),
          end: endDate?.toISOString(),
          daysElapsed,
          totalDuration,
        },
        price: {
          targetAmount: targetAmount.toFixed(6),
          actualAmount,
          remainingAmount: targetAmount - actualAmount,
          currency: 'USD',
        },
        proposedBudget: campaign.proposed_budget ? String(campaign.proposed_budget) : undefined,
        expectedRevenue: campaign.expected_revenue ? String(campaign.expected_revenue) : undefined,
        metrics: {
          deliveryPacing: 0.3,
          spendPacing: 0.28,
          marginAmount: targetAmount * 0.3,
          marginPercentage: 30,
          units: 0,
          unitType: 'impressions',
          revenueDelivered: actualAmount * 1.3,
          budgetSpent: actualAmount,
          marginActual: 0.28,
        },
        mediaActivity: totalLineItems > 0 ? 'Some active' : 'None active',
        lineItems: [],
        lineItemCount: totalLineItems,
        strategies: campaignStrategies.map((s) => ({ id: s.id })),
        goalsKpis: campaign.goals_kpis || '',
        newBusiness: campaign.new_business,
        createdAt: campaign.created_at,
        updatedAt: campaign.updated_at,
        modifiedTime: campaign.modified_time,
      };

      transformedCampaigns.push(transformed);
    }

    console.log(`\nTransformation complete!
  - Input: ${campaigns.length} PostgreSQL campaigns
  - Output: ${transformedCampaigns.length} MongoDB campaigns`);

    // Save transformed data
    const outputFile = path.join(OUTPUT_DIR, 'campaigns-with-traders.json');
    await fs.writeFile(outputFile, JSON.stringify(transformedCampaigns, null, 2));
    console.log(`  - Saved to: ${outputFile}`);

    // Show sample
    const sample = transformedCampaigns.find((c) => c.team.mediaTraders.length > 0);
    if (sample) {
      console.log('\nSample transformed campaign with media traders:');
      console.log(
        JSON.stringify(
          {
            campaignNumber: sample.campaignNumber,
            name: sample.name,
            'team.accountManager': sample.team.accountManager?.name,
            'team.mediaTraders': sample.team.mediaTraders.map((t: any) => t.name),
          },
          null,
          2
        )
      );
    }
  } catch (error) {
    console.error('Error during transformation:', error);
    throw error;
  }
}

if (import.meta.main) {
  transformWithMediaTraders();
}
