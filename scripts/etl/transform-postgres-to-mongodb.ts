#!/usr/bin/env bun
/**
 * Transform raw PostgreSQL data to MongoDB format with new schema
 *
 * This script transforms the faithful PostgreSQL backup into the new MongoDB schema with:
 * - budget -> price
 * - impressions -> units
 * - Split margin fields
 * - New team structure
 */

import fs from 'fs/promises';
import path from 'path';
import { ObjectId } from 'mongodb';

// Input and output directories
const POSTGRES_BACKUP_DIR = '../../exports/raw/20250628-154322';
const OUTPUT_DIR = '../../data/transformed/20250628-154322';

// Helper to read JSON file
async function readJsonFile(filename: string): Promise<any[]> {
  const filepath = path.join(POSTGRES_BACKUP_DIR, filename);
  const content = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(content);
}

// PostgreSQL types
interface PgCampaign {
  id: string; // Zoho ID
  campaign_number: string;
  campaign_name: string;
  account_id: string;
  agency_id: string;
  budget: number | null;
  proposed_budget: number | null;
  expected_revenue: number | null;
  stage: string;
  flight_date: string | null;
  end_date: string | null;
  goals_kpis: string;
  new_business: boolean | null;
  owner_user_id: string;
  lead_account_owner_user_id: string;
  sales_rep_user_id: string;
  created_at: string;
  updated_at: string;
  modified_time: string | null;
  is_deleted: boolean;
}

interface PgAccount {
  id: string;
  name: string;
  team_id: string;
}

interface PgUser {
  id: string;
  zoho_user_id: string;
  name: string;
  email: string;
}

interface PgStrategy {
  id: string;
  campaign_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

interface PgLineItem {
  id: string;
  strategy_id: string;
  name: string;
  price: number | null;
  start_date: string | null;
  end_date: string | null;
  unit_price: number | null;
  target_margin: number | null;
}

// MongoDB types (new schema)
interface MongoCampaign {
  _id: ObjectId;
  campaignId: string; // Zoho ID
  campaignNumber: string;
  name: string;
  status: string;
  displayStatus?: string;
  accountId?: string;
  accountName?: string;
  agencyId?: string;
  agencyName?: string;
  team: {
    accountManager?: {
      id: string;
      name: string;
      email: string;
      role?: string;
    };
    csd?: {
      id: string;
      name: string;
      email: string;
      role?: string;
    };
    seniorMediaTraders: Array<{
      id: string;
      name: string;
      email: string;
      role?: string;
    }>;
    mediaTraders: Array<{
      id: string;
      name: string;
      email: string;
      role?: string;
    }>;
  };
  dates: {
    start: Date | null;
    end: Date | null;
    daysElapsed: number;
    totalDuration: number;
  };
  price: {
    // NEW: Changed from budget
    targetAmount: number;
    actualAmount: number;
    remainingAmount: number;
    currency: string;
  };
  proposedBudget?: number;
  expectedRevenue?: number;
  metrics: {
    deliveryPacing: number;
    spendPacing: number;
    marginAmount: number; // NEW: Split field
    marginPercentage: number; // NEW: Split field
    units: number; // NEW: Changed from impressions
    unitType: 'impressions' | 'clicks' | 'views' | 'conversions';
    revenueDelivered: number;
    budgetSpent: number;
    marginActual: number;
  };
  mediaActivity: 'None active' | 'Some active' | 'All active' | 'Pending';
  lineItems: any[];
  lineItemCount: number;
  strategies?: any[];
  goalsKpis?: string;
  newBusiness?: boolean;
  createdAt: Date;
  updatedAt: Date;
  modifiedTime?: Date;
}

async function transformCampaigns() {
  console.log('Starting PostgreSQL to MongoDB transformation...');

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Load data
  console.log('Loading PostgreSQL data...');
  const campaigns = (await readJsonFile('campaigns.json')) as PgCampaign[];
  const accounts = (await readJsonFile('accounts.json')) as PgAccount[];
  const users = (await readJsonFile('users.json')) as PgUser[];
  const strategies = (await readJsonFile('strategies.json')) as PgStrategy[];
  const lineItems = (await readJsonFile('line_items.json')) as PgLineItem[];

  console.log(`Loaded:
  - ${campaigns.length} campaigns
  - ${accounts.length} accounts
  - ${users.length} users
  - ${strategies.length} strategies
  - ${lineItems.length} line items`);

  // Create lookup maps
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const userMap = new Map(users.map((u) => [u.zoho_user_id, u]));

  // Group strategies and line items by campaign
  const strategiesByCampaign = new Map<string, PgStrategy[]>();
  strategies.forEach((strategy) => {
    const list = strategiesByCampaign.get(strategy.campaign_id) || [];
    list.push(strategy);
    strategiesByCampaign.set(strategy.campaign_id, list);
  });

  const lineItemsByStrategy = new Map<string, PgLineItem[]>();
  lineItems.forEach((item) => {
    const list = lineItemsByStrategy.get(item.strategy_id) || [];
    list.push(item);
    lineItemsByStrategy.set(item.strategy_id, list);
  });

  // Transform campaigns
  console.log('\nTransforming campaigns...');
  const transformedCampaigns: MongoCampaign[] = [];

  for (let i = 0; i < campaigns.length; i++) {
    if (i % 1000 === 0) {
      console.log(`Progress: ${i}/${campaigns.length} campaigns`);
    }

    const campaign = campaigns[i];
    if (campaign.is_deleted) continue;

    // Get related data
    const account = accountMap.get(campaign.account_id);
    const leadAccountOwner = userMap.get(campaign.lead_account_owner_user_id);
    const owner = userMap.get(campaign.owner_user_id);
    const campaignStrategies = strategiesByCampaign.get(campaign.id) || [];

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
      totalDuration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      if (startDate <= now) {
        daysElapsed = Math.min(
          Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
          totalDuration
        );
      }
    }

    // Transform to new schema
    const targetAmount = campaign.budget || 0;
    const actualAmount = targetAmount * 0.3; // Simulate 30% spent

    const transformed: MongoCampaign = {
      _id: new ObjectId(),
      campaignId: campaign.id, // Preserve Zoho ID
      campaignNumber: campaign.campaign_number,
      name: campaign.campaign_name,
      status: mapCampaignStatus(campaign.stage),
      displayStatus: campaign.stage,
      accountId: campaign.account_id,
      accountName: account?.name,
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
        csd: undefined,
        seniorMediaTraders: [],
        mediaTraders: [],
      },
      dates: {
        start: startDate,
        end: endDate,
        daysElapsed,
        totalDuration,
      },
      price: {
        // NEW SCHEMA
        targetAmount,
        actualAmount,
        remainingAmount: targetAmount - actualAmount,
        currency: 'USD',
      },
      proposedBudget: campaign.proposed_budget || undefined,
      expectedRevenue: campaign.expected_revenue || undefined,
      metrics: {
        // NEW SCHEMA
        deliveryPacing: 0.3,
        spendPacing: 0.28,
        marginAmount: targetAmount * 0.3, // 30% margin
        marginPercentage: 30,
        units: 0, // Would need to aggregate from line items
        unitType: 'impressions',
        revenueDelivered: actualAmount * 1.3,
        budgetSpent: actualAmount,
        marginActual: 0.28,
      },
      mediaActivity: totalLineItems > 0 ? 'Some active' : 'None active',
      lineItems: [],
      lineItemCount: totalLineItems,
      strategies: campaignStrategies.map((s) => ({
        id: s.id,
        name: s.name,
      })),
      goalsKpis: campaign.goals_kpis || undefined,
      newBusiness: campaign.new_business || undefined,
      createdAt: new Date(campaign.created_at),
      updatedAt: new Date(campaign.updated_at),
      modifiedTime: campaign.modified_time ? new Date(campaign.modified_time) : undefined,
    };

    transformedCampaigns.push(transformed);
  }

  // Save transformed data
  const outputFile = path.join(OUTPUT_DIR, 'campaigns-from-postgres.json');
  await fs.writeFile(outputFile, JSON.stringify(transformedCampaigns, null, 2));

  console.log(`\nTransformation complete!
  - Input: ${campaigns.length} PostgreSQL campaigns
  - Output: ${transformedCampaigns.length} MongoDB campaigns
  - Saved to: ${outputFile}`);

  // Show sample
  if (transformedCampaigns.length > 0) {
    const sample = transformedCampaigns[0];
    console.log('\nSample transformed campaign:');
    console.log(
      JSON.stringify(
        {
          campaignNumber: sample.campaignNumber,
          name: sample.name,
          campaignId: sample.campaignId,
          status: sample.status,
          'price.targetAmount': sample.price.targetAmount,
          'metrics.marginAmount': sample.metrics.marginAmount,
          'metrics.units': sample.metrics.units,
          lineItemCount: sample.lineItemCount,
        },
        null,
        2
      )
    );
  }
}

// Map PostgreSQL campaign status to our status enum
function mapCampaignStatus(pgStatus: string): string {
  const statusMap: Record<string, string> = {
    'Closed (Lost)': 'L3',
    'Closed (Won)': 'L3',
    L1: 'L1',
    L2: 'L2',
    L3: 'L3',
    Active: 'L2',
    Pending: 'L1',
  };

  return statusMap[pgStatus] || 'L1';
}

// Run transformation
transformCampaigns().catch(console.error);
