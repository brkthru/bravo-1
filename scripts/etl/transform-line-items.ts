#!/usr/bin/env bun
/**
 * Transform PostgreSQL line items data to MongoDB format
 *
 * Line items represent individual media buys within strategies
 * Supporting 4 types: standard, management_fee, zero_dollar, zero_margin
 */

import fs from 'fs/promises';
import path from 'path';
import { ObjectId } from 'mongodb';

// Input and output directories
const POSTGRES_BACKUP_DIR = '../../data/postgres-backups/2025-06-27';
const OUTPUT_DIR = '../../data/transformed/2025-06-27';

// PostgreSQL types
interface PgLineItem {
  id: string;
  zoho_line_item_id: string | null;
  name: string;
  campaign_id: string;
  strategy_id: string;
  media_buy_id: string | null;
  line_item_type: string | null;
  media_type: string | null;
  platform: string | null;
  ad_format: string | null;
  start_date: string | null;
  end_date: string | null;
  price: number | null;
  quantity: number | null;
  unit_price: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  target_margin: number | null;
  actual_margin: number | null;
  status: string | null;
  targeting: any | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

interface PgCampaign {
  id: string;
  campaign_number: string;
  campaign_name: string;
}

interface PgStrategy {
  id: string;
  campaign_id: string;
  name: string;
}

// MongoDB line item base type
interface MongoLineItemBase {
  _id: ObjectId;
  lineItemId: string; // Original ID for reference
  name: string;
  campaignId: string; // Will be mapped to ObjectId later
  strategyId?: string; // Will be mapped to ObjectId later
  type: 'standard' | 'management_fee' | 'zero_dollar' | 'zero_margin';
  status:
    | 'draft'
    | 'pending_approval'
    | 'approved'
    | 'active'
    | 'paused'
    | 'completed'
    | 'cancelled';

  // Unit type and dates
  unitType: 'impressions' | 'clicks' | 'views' | 'conversions' | 'dollars';
  flightDates: {
    start: Date;
    end: Date;
  };

  // All line items have media budget
  mediaBudget: number;

  // Forward-looking metric
  estimatedUnits: number;

  // Platform and targeting
  platform?: string;
  targeting?: {
    geography?: string[];
    demographics?: {
      ageMin?: number;
      ageMax?: number;
      gender?: 'all' | 'male' | 'female' | 'other';
    };
    interests?: string[];
    customAudiences?: string[];
  };

  // Creative details
  creativeSpecs?: {
    formats?: string[];
    sizes?: string[];
    urls?: string[];
  };

  // Metadata
  tags: string[];
  notes?: string;

  // Calculation metadata
  calculatedAt: Date;
  calculationVersion: string;

  // External IDs
  zohoLineItemId?: string;
  mediaBuyId?: string;

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Standard line item (has price and margin)
interface MongoStandardLineItem extends MongoLineItemBase {
  type: 'standard';
  price: number;
  netRevenue: number;
  marginAmount: number;
  marginPercentage: number;
}

// Management fee line item (no price, just fee)
interface MongoManagementFeeLineItem extends MongoLineItemBase {
  type: 'management_fee';
  managementFee: number;
  feePercentage?: number;
}

// Zero dollar line item (bonus/added value)
interface MongoZeroDollarLineItem extends MongoLineItemBase {
  type: 'zero_dollar';
  addedValueReason: string;
  estimatedValue?: number;
}

// Zero margin line item (has price but no margin)
interface MongoZeroMarginLineItem extends MongoLineItemBase {
  type: 'zero_margin';
  price: number;
  zeroMarginReason: string;
}

type MongoLineItem =
  | MongoStandardLineItem
  | MongoManagementFeeLineItem
  | MongoZeroDollarLineItem
  | MongoZeroMarginLineItem;

// Determine line item type
function determineLineItemType(pgItem: PgLineItem): MongoLineItem['type'] {
  const typeLower = (pgItem.line_item_type || '').toLowerCase();
  const nameLower = pgItem.name.toLowerCase();

  // Check for management fee
  if (
    typeLower.includes('management') ||
    typeLower.includes('fee') ||
    nameLower.includes('management fee') ||
    nameLower.includes('agency fee')
  ) {
    return 'management_fee';
  }

  // Check for zero dollar
  if (
    (pgItem.price === 0 || pgItem.price === null) &&
    (typeLower.includes('bonus') ||
      typeLower.includes('added value') ||
      nameLower.includes('bonus') ||
      nameLower.includes('added value'))
  ) {
    return 'zero_dollar';
  }

  // Check for zero margin
  if (
    pgItem.target_margin === 0 ||
    typeLower.includes('zero margin') ||
    nameLower.includes('zero margin') ||
    nameLower.includes('at cost')
  ) {
    return 'zero_margin';
  }

  // Default to standard
  return 'standard';
}

// Map line item status
function mapLineItemStatus(pgStatus: string | null): MongoLineItemBase['status'] {
  if (!pgStatus) return 'draft';

  const status = pgStatus.toLowerCase();
  if (status.includes('draft')) return 'draft';
  if (status.includes('pending')) return 'pending_approval';
  if (status.includes('approved')) return 'approved';
  if (status.includes('active') || status.includes('live')) return 'active';
  if (status.includes('paused')) return 'paused';
  if (status.includes('completed') || status.includes('ended')) return 'completed';
  if (status.includes('cancelled')) return 'cancelled';

  return 'draft';
}

// Determine unit type
function determineUnitType(pgItem: PgLineItem): MongoLineItemBase['unitType'] {
  const mediaType = (pgItem.media_type || '').toLowerCase();
  const adFormat = (pgItem.ad_format || '').toLowerCase();

  if (pgItem.conversions && pgItem.conversions > 0) return 'conversions';
  if (pgItem.clicks && pgItem.clicks > 0) return 'clicks';
  if (adFormat.includes('video') || mediaType.includes('video')) return 'views';
  if (pgItem.impressions && pgItem.impressions > 0) return 'impressions';

  return 'impressions'; // default
}

// Parse targeting data
function parseTargeting(targetingData: any): MongoLineItemBase['targeting'] | undefined {
  if (!targetingData) return undefined;

  const targeting: any = {};

  // Handle string or object targeting data
  if (typeof targetingData === 'string') {
    try {
      targetingData = JSON.parse(targetingData);
    } catch {
      // If it's not JSON, treat it as a description
      return { geography: [targetingData] };
    }
  }

  if (targetingData.geography || targetingData.locations) {
    targeting.geography = Array.isArray(targetingData.geography)
      ? targetingData.geography
      : targetingData.locations
        ? [targetingData.locations]
        : [];
  }

  if (targetingData.demographics || targetingData.age_range || targetingData.gender) {
    targeting.demographics = {
      ...(targetingData.age_range && {
        ageMin: targetingData.age_range.min || 18,
        ageMax: targetingData.age_range.max || 65,
      }),
      ...(targetingData.gender && {
        gender: targetingData.gender.toLowerCase(),
      }),
    };
  }

  if (targetingData.interests) {
    targeting.interests = Array.isArray(targetingData.interests)
      ? targetingData.interests
      : [targetingData.interests];
  }

  return Object.keys(targeting).length > 0 ? targeting : undefined;
}

// Map platform
function mapPlatform(platform: string | null): string | undefined {
  if (!platform) return undefined;

  const p = platform.toLowerCase();
  if (p.includes('google') || p.includes('adwords')) return 'google_ads';
  if (p.includes('facebook') || p.includes('fb')) return 'facebook';
  if (p.includes('instagram') || p.includes('ig')) return 'instagram';
  if (p.includes('linkedin')) return 'linkedin';
  if (p.includes('twitter') || p.includes('x.com')) return 'twitter';
  if (p.includes('tiktok')) return 'tiktok';
  if (p.includes('programmatic') || p.includes('dsp')) return 'programmatic';
  if (p.includes('direct')) return 'direct';

  return 'other';
}

// Transform a single line item
function transformLineItem(
  pgItem: PgLineItem,
  campaign: PgCampaign | undefined,
  strategy: PgStrategy | undefined
): MongoLineItem {
  const mongoId = new ObjectId();
  const type = determineLineItemType(pgItem);
  const startDate = pgItem.start_date ? new Date(pgItem.start_date) : new Date();
  const endDate = pgItem.end_date
    ? new Date(pgItem.end_date)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // Base fields
  const baseFields: MongoLineItemBase = {
    _id: mongoId,
    lineItemId: pgItem.id,
    name: pgItem.name,
    campaignId: pgItem.campaign_id,
    strategyId: pgItem.strategy_id,
    type,
    status: mapLineItemStatus(pgItem.status),
    unitType: determineUnitType(pgItem),
    flightDates: {
      start: startDate,
      end: endDate,
    },
    mediaBudget: pgItem.price || 0,
    estimatedUnits: pgItem.quantity || pgItem.impressions || 0,
    platform: mapPlatform(pgItem.platform),
    targeting: parseTargeting(pgItem.targeting),
    tags: [],
    notes: pgItem.notes || undefined,
    calculatedAt: new Date(),
    calculationVersion: '1.0',
    zohoLineItemId: pgItem.zoho_line_item_id || undefined,
    mediaBuyId: pgItem.media_buy_id || undefined,
    createdAt: new Date(pgItem.created_at),
    updatedAt: new Date(pgItem.updated_at),
  };

  // Add creative specs if we have ad format info
  if (pgItem.ad_format) {
    baseFields.creativeSpecs = {
      formats: [pgItem.ad_format],
    };
  }

  // Add tags based on characteristics
  if (pgItem.price && pgItem.price > 10000) baseFields.tags.push('high-value');
  if (pgItem.platform) baseFields.tags.push(`platform:${baseFields.platform}`);
  if (pgItem.media_type) baseFields.tags.push(`media:${pgItem.media_type}`);

  // Create type-specific line item
  switch (type) {
    case 'standard': {
      const price = pgItem.price || 0;
      const marginPercentage = pgItem.target_margin || 30;
      const marginAmount = price * (marginPercentage / 100);
      const netRevenue = price - marginAmount;

      return {
        ...baseFields,
        type: 'standard',
        price,
        netRevenue,
        marginAmount,
        marginPercentage,
      } as MongoStandardLineItem;
    }

    case 'management_fee': {
      const fee = pgItem.price || 0;
      return {
        ...baseFields,
        type: 'management_fee',
        managementFee: fee,
        feePercentage: pgItem.target_margin,
      } as MongoManagementFeeLineItem;
    }

    case 'zero_dollar': {
      return {
        ...baseFields,
        type: 'zero_dollar',
        addedValueReason: pgItem.notes || 'Bonus inventory',
        estimatedValue: pgItem.unit_price ? pgItem.unit_price * (pgItem.quantity || 0) : undefined,
      } as MongoZeroDollarLineItem;
    }

    case 'zero_margin': {
      return {
        ...baseFields,
        type: 'zero_margin',
        price: pgItem.price || 0,
        zeroMarginReason: pgItem.notes || 'Client requirement',
      } as MongoZeroMarginLineItem;
    }
  }
}

async function transformLineItems() {
  console.log('Starting line item transformation...');

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Load data
  console.log('Loading PostgreSQL data...');
  const pgLineItemsPath = path.join(POSTGRES_BACKUP_DIR, 'line_items.json');
  const pgCampaignsPath = path.join(POSTGRES_BACKUP_DIR, 'campaigns.json');
  const pgStrategiesPath = path.join(POSTGRES_BACKUP_DIR, 'strategies.json');

  const pgLineItems = JSON.parse(await fs.readFile(pgLineItemsPath, 'utf-8')) as PgLineItem[];
  const pgCampaigns = JSON.parse(await fs.readFile(pgCampaignsPath, 'utf-8')) as PgCampaign[];
  const pgStrategies = JSON.parse(await fs.readFile(pgStrategiesPath, 'utf-8')) as PgStrategy[];

  console.log(`Loaded ${pgLineItems.length} line items`);

  // Create lookup maps
  const campaignMap = new Map(pgCampaigns.map((c) => [c.id, c]));
  const strategyMap = new Map(pgStrategies.map((s) => [s.id, s]));

  // Transform line items
  const transformedLineItems: MongoLineItem[] = [];
  const lineItemIdMap = new Map<string, ObjectId>();

  for (const pgItem of pgLineItems) {
    const campaign = campaignMap.get(pgItem.campaign_id);
    const strategy = strategyMap.get(pgItem.strategy_id);

    const transformed = transformLineItem(pgItem, campaign, strategy);
    lineItemIdMap.set(pgItem.id, transformed._id);
    transformedLineItems.push(transformed);
  }

  // Sort by campaign, strategy, and creation date
  transformedLineItems.sort((a, b) => {
    if (a.campaignId !== b.campaignId) {
      return a.campaignId.localeCompare(b.campaignId);
    }
    if (a.strategyId !== b.strategyId) {
      return (a.strategyId || '').localeCompare(b.strategyId || '');
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Save transformed line items
  const outputPath = path.join(OUTPUT_DIR, 'line-items.json');
  await fs.writeFile(outputPath, JSON.stringify(transformedLineItems, null, 2));

  // Save line item ID mapping for reference
  const mappingPath = path.join(OUTPUT_DIR, 'line-item-id-mapping.json');
  const mapping = Object.fromEntries(lineItemIdMap);
  await fs.writeFile(mappingPath, JSON.stringify(mapping, null, 2));

  // Generate summary statistics
  const stats = {
    totalLineItems: transformedLineItems.length,
    byType: {
      standard: transformedLineItems.filter((li) => li.type === 'standard').length,
      managementFee: transformedLineItems.filter((li) => li.type === 'management_fee').length,
      zeroDollar: transformedLineItems.filter((li) => li.type === 'zero_dollar').length,
      zeroMargin: transformedLineItems.filter((li) => li.type === 'zero_margin').length,
    },
    byStatus: {
      active: transformedLineItems.filter((li) => li.status === 'active').length,
      completed: transformedLineItems.filter((li) => li.status === 'completed').length,
      draft: transformedLineItems.filter((li) => li.status === 'draft').length,
    },
    totalMediaBudget: transformedLineItems.reduce((sum, li) => sum + li.mediaBudget, 0),
    totalRevenue: transformedLineItems
      .filter((li): li is MongoStandardLineItem => li.type === 'standard')
      .reduce((sum, li) => sum + li.price, 0),
    byPlatform: {} as Record<string, number>,
  };

  // Count by platform
  transformedLineItems.forEach((li) => {
    if (li.platform) {
      stats.byPlatform[li.platform] = (stats.byPlatform[li.platform] || 0) + 1;
    }
  });

  console.log(`\nTransformation complete!`);
  console.log(`- Transformed ${stats.totalLineItems} line items`);
  console.log(
    `- Types: ${stats.byType.standard} standard, ${stats.byType.managementFee} management fee, ${stats.byType.zeroDollar} zero dollar, ${stats.byType.zeroMargin} zero margin`
  );
  console.log(`- Active line items: ${stats.byStatus.active}`);
  console.log(`- Total media budget: $${stats.totalMediaBudget.toLocaleString()}`);
  console.log(`- Total revenue: $${stats.totalRevenue.toLocaleString()}`);
  console.log(
    `- Platforms:`,
    Object.entries(stats.byPlatform)
      .map(([p, c]) => `${p}: ${c}`)
      .join(', ')
  );
  console.log(`- Output saved to: ${outputPath}`);
  console.log(`- ID mapping saved to: ${mappingPath}`);
}

// Run transformation
transformLineItems().catch(console.error);
