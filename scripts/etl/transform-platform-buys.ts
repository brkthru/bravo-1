#!/usr/bin/env bun
/**
 * Transform PostgreSQL media buys (platform buys) data to MongoDB format
 *
 * Platform buys represent the actual execution of line items on specific platforms
 */

import fs from 'fs/promises';
import path from 'path';
import { ObjectId } from 'mongodb';

// Input and output directories
const POSTGRES_BACKUP_DIR = '../../data/postgres-backups/2025-06-27';
const OUTPUT_DIR = '../../data/transformed/2025-06-27';

// PostgreSQL types
interface PgMediaBuy {
  id: string;
  name: string;
  media_platform_id: string;
  media_platform_entity_id: string;
  advertiser_media_platform_entity_id: string | null;
  budget: number | null;
  spend: number | null;
  start_date: string | null;
  end_date: string | null;
  campaign_numbers: string[] | null;
  changeset_id: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

interface PgLineItemMediaBuy {
  id: string;
  line_item_id: string;
  media_buy_id: string;
  allocation_percentage: number | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

interface PgMediaPlatform {
  id: string;
  name: string;
  platform_type: string | null;
}

interface PgCampaign {
  id: string;
  campaign_number: string;
  campaign_name: string;
}

// MongoDB platform buy type
interface MongoPlatformBuy {
  _id: ObjectId;
  platformBuyId: string; // Original ID
  name: string;
  status: 'draft' | 'pending' | 'active' | 'paused' | 'completed' | 'cancelled';

  // Platform information
  platform: {
    id: string;
    name: string;
    type: 'search' | 'social' | 'display' | 'video' | 'programmatic' | 'other';
  };

  // Campaign associations (derived from campaign_numbers)
  campaigns: Array<{
    campaignId?: string;
    campaignNumber: string;
    campaignName?: string;
  }>;

  // Line item associations
  lineItems: Array<{
    lineItemId: string;
    allocationPercentage: number;
    allocatedBudget: number;
  }>;

  // Dates
  dates: {
    start: Date | null;
    end: Date | null;
    duration?: number;
  };

  // Financial tracking
  financials: {
    budget: number;
    spend: number;
    remainingBudget: number;
    burnRate?: number; // Daily burn rate
    pacingPercentage?: number;
    currency: string;
  };

  // Performance metrics (placeholder - would be populated from platform APIs)
  performance: {
    impressions: number;
    clicks: number;
    conversions: number;
    ctr?: number;
    cpc?: number;
    cpm?: number;
    lastUpdated?: Date;
  };

  // Platform-specific IDs
  platformEntityId?: string;
  advertiserPlatformEntityId?: string;

  // Metadata
  tags: string[];
  isDeleted: boolean;
  changesetId?: string;

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Map platform type
function mapPlatformType(
  platformName: string,
  platformType: string | null
): MongoPlatformBuy['platform']['type'] {
  const name = platformName.toLowerCase();
  const type = (platformType || '').toLowerCase();

  if (name.includes('google') || name.includes('bing') || type.includes('search')) return 'search';
  if (
    name.includes('facebook') ||
    name.includes('linkedin') ||
    name.includes('twitter') ||
    type.includes('social')
  )
    return 'social';
  if (name.includes('youtube') || name.includes('tiktok') || type.includes('video')) return 'video';
  if (type.includes('programmatic') || name.includes('dv360') || name.includes('amazon'))
    return 'programmatic';
  if (type.includes('display')) return 'display';

  return 'other';
}

// Determine buy status based on dates and spend
function determineBuyStatus(buy: PgMediaBuy): MongoPlatformBuy['status'] {
  const now = new Date();
  const startDate = buy.start_date ? new Date(buy.start_date) : null;
  const endDate = buy.end_date ? new Date(buy.end_date) : null;

  if (buy.is_deleted) return 'cancelled';

  if (!startDate || startDate > now) return 'pending';
  if (endDate && endDate < now) return 'completed';

  // Check if actively spending
  if (buy.spend && buy.budget && buy.spend >= buy.budget * 0.95) return 'completed';

  return 'active';
}

// Parse campaign numbers array
function parseCampaignNumbers(campaignNumbers: string[] | null): string[] {
  if (!campaignNumbers) return [];

  // Handle if it's a string that needs parsing
  if (typeof campaignNumbers === 'string') {
    try {
      const parsed = JSON.parse(campaignNumbers);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      // If it's a comma-separated string
      return campaignNumbers
        .split(',')
        .map((cn) => cn.trim())
        .filter((cn) => cn);
    }
  }

  return Array.isArray(campaignNumbers) ? campaignNumbers : [];
}

// Calculate performance metrics (simulated)
function calculatePerformance(buy: PgMediaBuy): MongoPlatformBuy['performance'] {
  const spend = buy.spend || 0;
  const budget = buy.budget || 0;
  const utilizationRate = budget > 0 ? spend / budget : 0;

  // Simulate performance based on spend
  const impressions = Math.floor(spend * 100); // $10 CPM
  const clicks = Math.floor(impressions * 0.002); // 0.2% CTR
  const conversions = Math.floor(clicks * 0.02); // 2% conversion rate

  return {
    impressions,
    clicks,
    conversions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    cpc: clicks > 0 ? spend / clicks : 0,
    cpm: impressions > 0 ? (spend / impressions) * 1000 : 0,
    lastUpdated: new Date(),
  };
}

async function transformPlatformBuys() {
  console.log('Starting platform buy transformation...');

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Load data
  console.log('Loading PostgreSQL data...');
  const pgMediaBuysPath = path.join(POSTGRES_BACKUP_DIR, 'media_buys.json');
  const pgLineItemMediaBuysPath = path.join(POSTGRES_BACKUP_DIR, 'line_item_media_buys.json');
  const pgMediaPlatformsPath = path.join(POSTGRES_BACKUP_DIR, 'media_platforms.json');
  const pgCampaignsPath = path.join(POSTGRES_BACKUP_DIR, 'campaigns.json');

  const pgMediaBuys = JSON.parse(await fs.readFile(pgMediaBuysPath, 'utf-8')) as PgMediaBuy[];
  const pgLineItemMediaBuys = JSON.parse(
    await fs.readFile(pgLineItemMediaBuysPath, 'utf-8')
  ) as PgLineItemMediaBuy[];
  const pgMediaPlatforms = JSON.parse(
    await fs.readFile(pgMediaPlatformsPath, 'utf-8')
  ) as PgMediaPlatform[];
  const pgCampaigns = JSON.parse(await fs.readFile(pgCampaignsPath, 'utf-8')) as PgCampaign[];

  console.log(
    `Loaded ${pgMediaBuys.length} media buys, ${pgLineItemMediaBuys.length} line item associations`
  );

  // Create lookup maps
  const platformMap = new Map(pgMediaPlatforms.map((p) => [p.id, p]));
  const campaignByNumberMap = new Map(pgCampaigns.map((c) => [c.campaign_number, c]));

  // Group line item associations by media buy
  const lineItemsByMediaBuy = new Map<string, PgLineItemMediaBuy[]>();
  pgLineItemMediaBuys.forEach((assoc) => {
    if (!assoc.is_deleted) {
      const list = lineItemsByMediaBuy.get(assoc.media_buy_id) || [];
      list.push(assoc);
      lineItemsByMediaBuy.set(assoc.media_buy_id, list);
    }
  });

  // Transform platform buys
  const transformedBuys: MongoPlatformBuy[] = [];
  const buyIdMap = new Map<string, ObjectId>();

  for (const pgBuy of pgMediaBuys) {
    const mongoId = new ObjectId();
    buyIdMap.set(pgBuy.id, mongoId);

    const platform = platformMap.get(pgBuy.media_platform_id);
    const lineItemAssocs = lineItemsByMediaBuy.get(pgBuy.id) || [];
    const campaignNumbers = parseCampaignNumbers(pgBuy.campaign_numbers);

    // Calculate dates
    const startDate = pgBuy.start_date ? new Date(pgBuy.start_date) : null;
    const endDate = pgBuy.end_date ? new Date(pgBuy.end_date) : null;
    const duration =
      startDate && endDate
        ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

    // Calculate financials
    const budget = pgBuy.budget || 0;
    const spend = pgBuy.spend || 0;
    const remainingBudget = Math.max(0, budget - spend);
    const daysPassed = startDate
      ? Math.ceil((Date.now() - startDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;
    const burnRate = daysPassed > 0 ? spend / daysPassed : 0;
    const pacingPercentage =
      duration && daysPassed > 0 ? daysPassed / duration / (spend / budget) : 0;

    const transformedBuy: MongoPlatformBuy = {
      _id: mongoId,
      platformBuyId: pgBuy.id,
      name: pgBuy.name,
      status: determineBuyStatus(pgBuy),

      // Platform information
      platform: {
        id: pgBuy.media_platform_id,
        name: platform?.name || 'Unknown Platform',
        type: platform ? mapPlatformType(platform.name, platform.platform_type) : 'other',
      },

      // Campaign associations
      campaigns: campaignNumbers.map((cn) => {
        const campaign = campaignByNumberMap.get(cn);
        return {
          campaignId: campaign?.id,
          campaignNumber: cn,
          campaignName: campaign?.campaign_name,
        };
      }),

      // Line item associations
      lineItems: lineItemAssocs.map((assoc) => ({
        lineItemId: assoc.line_item_id,
        allocationPercentage: assoc.allocation_percentage || 100,
        allocatedBudget: budget * ((assoc.allocation_percentage || 100) / 100),
      })),

      // Dates
      dates: {
        start: startDate,
        end: endDate,
        duration,
      },

      // Financial tracking
      financials: {
        budget,
        spend,
        remainingBudget,
        burnRate,
        pacingPercentage,
        currency: 'USD',
      },

      // Performance metrics
      performance: calculatePerformance(pgBuy),

      // Platform-specific IDs
      platformEntityId: pgBuy.media_platform_entity_id,
      advertiserPlatformEntityId: pgBuy.advertiser_media_platform_entity_id || undefined,

      // Metadata
      tags: [],
      isDeleted: pgBuy.is_deleted,
      changesetId: pgBuy.changeset_id || undefined,

      // Audit fields
      createdAt: new Date(pgBuy.created_at),
      updatedAt: new Date(pgBuy.updated_at),
    };

    // Add tags based on characteristics
    if (budget > 50000) transformedBuy.tags.push('high-budget');
    if (lineItemAssocs.length > 5) transformedBuy.tags.push('multi-line-item');
    if (campaignNumbers.length > 1) transformedBuy.tags.push('multi-campaign');
    if (transformedBuy.platform.type)
      transformedBuy.tags.push(`platform:${transformedBuy.platform.type}`);
    if (transformedBuy.status === 'active') transformedBuy.tags.push('active');

    transformedBuys.push(transformedBuy);
  }

  // Filter out deleted buys unless specifically requested
  const activeBuys = transformedBuys.filter((buy) => !buy.isDeleted);

  // Sort by status and creation date
  activeBuys.sort((a, b) => {
    const statusOrder = ['active', 'pending', 'paused', 'completed', 'cancelled'];
    const aOrder = statusOrder.indexOf(a.status);
    const bOrder = statusOrder.indexOf(b.status);

    if (aOrder !== bOrder) return aOrder - bOrder;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  // Save transformed platform buys
  const outputPath = path.join(OUTPUT_DIR, 'platform-buys.json');
  await fs.writeFile(outputPath, JSON.stringify(activeBuys, null, 2));

  // Save platform buy ID mapping for reference
  const mappingPath = path.join(OUTPUT_DIR, 'platform-buy-id-mapping.json');
  const mapping = Object.fromEntries(buyIdMap);
  await fs.writeFile(mappingPath, JSON.stringify(mapping, null, 2));

  // Generate summary statistics
  const stats = {
    totalBuys: pgMediaBuys.length,
    activeBuys: activeBuys.length,
    deletedBuys: transformedBuys.filter((b) => b.isDeleted).length,
    byStatus: {
      active: activeBuys.filter((b) => b.status === 'active').length,
      pending: activeBuys.filter((b) => b.status === 'pending').length,
      completed: activeBuys.filter((b) => b.status === 'completed').length,
      cancelled: activeBuys.filter((b) => b.status === 'cancelled').length,
    },
    byPlatform: {} as Record<string, number>,
    totalBudget: activeBuys.reduce((sum, b) => sum + b.financials.budget, 0),
    totalSpend: activeBuys.reduce((sum, b) => sum + b.financials.spend, 0),
    avgAllocationPerBuy:
      activeBuys
        .filter((b) => b.lineItems.length > 0)
        .reduce((sum, b) => sum + b.lineItems.length, 0) /
        activeBuys.filter((b) => b.lineItems.length > 0).length || 0,
  };

  // Count by platform type
  activeBuys.forEach((buy) => {
    const type = buy.platform.type;
    stats.byPlatform[type] = (stats.byPlatform[type] || 0) + 1;
  });

  console.log(`\nTransformation complete!`);
  console.log(
    `- Total media buys: ${stats.totalBuys} (${stats.activeBuys} active, ${stats.deletedBuys} deleted)`
  );
  console.log(
    `- By status: ${Object.entries(stats.byStatus)
      .map(([s, c]) => `${s}: ${c}`)
      .join(', ')}`
  );
  console.log(
    `- By platform: ${Object.entries(stats.byPlatform)
      .map(([p, c]) => `${p}: ${c}`)
      .join(', ')}`
  );
  console.log(`- Total budget: $${stats.totalBudget.toLocaleString()}`);
  console.log(
    `- Total spend: $${stats.totalSpend.toLocaleString()} (${((stats.totalSpend / stats.totalBudget) * 100).toFixed(1)}%)`
  );
  console.log(`- Average line items per buy: ${stats.avgAllocationPerBuy.toFixed(1)}`);
  console.log(`- Output saved to: ${outputPath}`);
  console.log(`- ID mapping saved to: ${mappingPath}`);
}

// Run transformation
transformPlatformBuys().catch(console.error);
