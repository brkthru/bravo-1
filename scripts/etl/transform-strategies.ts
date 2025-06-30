#!/usr/bin/env bun
/**
 * Transform PostgreSQL strategies data to MongoDB format
 *
 * Strategies represent media execution plans within campaigns
 */

import fs from 'fs/promises';
import path from 'path';
import { ObjectId } from 'mongodb';

// Input and output directories
const POSTGRES_BACKUP_DIR = '../../data/postgres-backups/2025-06-27';
const OUTPUT_DIR = '../../data/transformed/2025-06-27';

// PostgreSQL types
interface PgStrategy {
  id: string;
  campaign_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  kpis: string | null;
  start_date: string | null;
  end_date: string | null;
  budget: number | null;
  margin: number | null;
  status: string | null;
  notes: string | null;
  objectives: string | null;
  target_audience: string | null;
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
  quantity: number | null;
  impressions: number | null;
  media_type: string | null;
  platform: string | null;
  ad_format: string | null;
  targeting: any | null;
}

interface PgCampaign {
  id: string;
  campaign_number: string;
  campaign_name: string;
}

// MongoDB strategy type
interface MongoStrategy {
  _id: ObjectId;
  strategyId: string; // Original ID for reference
  campaignId: string; // MongoDB ObjectId will be mapped later
  campaignNumber?: string;
  name: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'active' | 'paused' | 'completed';

  // Dates
  dates: {
    start: Date | null;
    end: Date | null;
    duration?: number;
  };

  // Budget tracking
  budget: {
    targetAmount: number;
    allocatedAmount: number;
    spentAmount: number;
    remainingAmount: number;
    currency: string;
  };

  // Margin tracking
  margin: {
    targetPercentage: number;
    targetAmount: number;
    actualPercentage?: number;
    actualAmount?: number;
  };

  // Strategy details
  objectives?: string;
  targetAudience?: string;
  kpis?: string[];
  notes?: string;

  // Media mix summary
  mediaMix: {
    channels: string[];
    platforms: string[];
    formats: string[];
    totalLineItems: number;
    activeLineItems: number;
  };

  // Performance metrics (calculated)
  metrics: {
    deliveryPacing: number;
    spendPacing: number;
    impressions: number;
    clicks: number;
    ctr?: number;
    cpm?: number;
    cpc?: number;
  };

  // Line item references
  lineItemIds: string[];

  // Team assignments
  assignedTraders: Array<{
    userId: string;
    name: string;
    role: 'lead' | 'support';
    assignedAt: Date;
  }>;

  // Approval workflow
  approval?: {
    status: 'pending' | 'approved' | 'rejected';
    approvedBy?: string;
    approvedAt?: Date;
    comments?: string;
  };

  // Metadata
  tags: string[];
  customFields: Record<string, any>;

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Map strategy status
function mapStrategyStatus(pgStatus: string | null): MongoStrategy['status'] {
  if (!pgStatus) return 'draft';

  const status = pgStatus.toLowerCase();
  if (status.includes('draft')) return 'draft';
  if (status.includes('pending')) return 'pending_approval';
  if (status.includes('approved')) return 'approved';
  if (status.includes('active') || status.includes('live')) return 'active';
  if (status.includes('paused')) return 'paused';
  if (status.includes('completed') || status.includes('ended')) return 'completed';

  return 'draft';
}

// Parse KPIs from string
function parseKpis(kpisStr: string | null): string[] {
  if (!kpisStr) return [];

  // Common KPI patterns
  const kpis = kpisStr
    .split(/[,;|\n]/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0 && k.length < 100); // Filter out empty or too long entries

  return kpis;
}

// Extract media channels from line items
function extractMediaMix(lineItems: PgLineItem[]): MongoStrategy['mediaMix'] {
  const channels = new Set<string>();
  const platforms = new Set<string>();
  const formats = new Set<string>();

  lineItems.forEach((item) => {
    if (item.media_type) channels.add(item.media_type);
    if (item.platform) platforms.add(item.platform);
    if (item.ad_format) formats.add(item.ad_format);
  });

  return {
    channels: Array.from(channels),
    platforms: Array.from(platforms),
    formats: Array.from(formats),
    totalLineItems: lineItems.length,
    activeLineItems: lineItems.filter(
      (li) => li.start_date && new Date(li.start_date) <= new Date()
    ).length,
  };
}

// Calculate strategy metrics from line items
function calculateMetrics(lineItems: PgLineItem[], budget: number): MongoStrategy['metrics'] {
  const totalImpressions = lineItems.reduce((sum, li) => sum + (li.impressions || 0), 0);
  const totalSpent = lineItems.reduce((sum, li) => sum + (li.price || 0), 0);
  const totalQuantity = lineItems.reduce((sum, li) => sum + (li.quantity || 0), 0);

  // Simulate some metrics
  const clicks = Math.floor(totalImpressions * 0.002); // 0.2% CTR
  const ctr = totalImpressions > 0 ? clicks / totalImpressions : 0;
  const cpm = totalImpressions > 0 ? (totalSpent / totalImpressions) * 1000 : 0;
  const cpc = clicks > 0 ? totalSpent / clicks : 0;

  return {
    deliveryPacing: budget > 0 ? Math.min(totalSpent / budget, 1) : 0,
    spendPacing: budget > 0 ? Math.min(totalSpent / budget, 1) : 0,
    impressions: totalImpressions,
    clicks,
    ctr,
    cpm,
    cpc,
  };
}

async function transformStrategies() {
  console.log('Starting strategy transformation...');

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Load data
  console.log('Loading PostgreSQL data...');
  const pgStrategiesPath = path.join(POSTGRES_BACKUP_DIR, 'strategies.json');
  const pgLineItemsPath = path.join(POSTGRES_BACKUP_DIR, 'line_items.json');
  const pgCampaignsPath = path.join(POSTGRES_BACKUP_DIR, 'campaigns.json');

  const pgStrategies = JSON.parse(await fs.readFile(pgStrategiesPath, 'utf-8')) as PgStrategy[];
  const pgLineItems = JSON.parse(await fs.readFile(pgLineItemsPath, 'utf-8')) as PgLineItem[];
  const pgCampaigns = JSON.parse(await fs.readFile(pgCampaignsPath, 'utf-8')) as PgCampaign[];

  console.log(`Loaded ${pgStrategies.length} strategies, ${pgLineItems.length} line items`);

  // Create lookup maps
  const campaignMap = new Map(pgCampaigns.map((c) => [c.id, c]));

  // Group line items by strategy
  const lineItemsByStrategy = new Map<string, PgLineItem[]>();
  pgLineItems.forEach((item) => {
    const list = lineItemsByStrategy.get(item.strategy_id) || [];
    list.push(item);
    lineItemsByStrategy.set(item.strategy_id, list);
  });

  // Transform strategies
  const transformedStrategies: MongoStrategy[] = [];
  const strategyIdMap = new Map<string, ObjectId>();

  for (const pgStrategy of pgStrategies) {
    const mongoId = new ObjectId();
    strategyIdMap.set(pgStrategy.id, mongoId);

    const lineItems = lineItemsByStrategy.get(pgStrategy.id) || [];
    const campaign = campaignMap.get(pgStrategy.campaign_id);

    // Calculate dates
    const startDate = pgStrategy.start_date ? new Date(pgStrategy.start_date) : null;
    const endDate = pgStrategy.end_date ? new Date(pgStrategy.end_date) : null;
    const duration =
      startDate && endDate
        ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

    // Calculate budget and spending
    const budget = pgStrategy.budget || 0;
    const allocatedAmount = lineItems.reduce((sum, li) => sum + (li.price || 0), 0);
    const spentAmount = allocatedAmount * 0.3; // Simulate 30% spent
    const remainingAmount = Math.max(0, budget - spentAmount);

    // Calculate margin
    const marginPercentage = pgStrategy.margin || 30;
    const marginAmount = budget * (marginPercentage / 100);
    const actualMarginAmount = spentAmount * (marginPercentage / 100);

    const transformedStrategy: MongoStrategy = {
      _id: mongoId,
      strategyId: pgStrategy.id,
      campaignId: pgStrategy.campaign_id, // Will be mapped to ObjectId later
      ...(campaign && { campaignNumber: campaign.campaign_number }),
      name: pgStrategy.name,
      status: mapStrategyStatus(pgStrategy.status),

      // Dates
      dates: {
        start: startDate,
        end: endDate,
        duration,
      },

      // Budget tracking
      budget: {
        targetAmount: budget,
        allocatedAmount,
        spentAmount,
        remainingAmount,
        currency: 'USD',
      },

      // Margin tracking
      margin: {
        targetPercentage: marginPercentage,
        targetAmount: marginAmount,
        actualPercentage: marginPercentage,
        actualAmount: actualMarginAmount,
      },

      // Strategy details
      ...(pgStrategy.objectives && { objectives: pgStrategy.objectives }),
      ...(pgStrategy.target_audience && { targetAudience: pgStrategy.target_audience }),
      kpis: parseKpis(pgStrategy.kpis),
      ...(pgStrategy.notes && { notes: pgStrategy.notes }),

      // Media mix
      mediaMix: extractMediaMix(lineItems),

      // Performance metrics
      metrics: calculateMetrics(lineItems, budget),

      // Line item references
      lineItemIds: lineItems.map((li) => li.id),

      // Team assignments (placeholder)
      assignedTraders: [],

      // Metadata
      tags: [],
      customFields: {},

      // Audit fields
      createdAt: new Date(pgStrategy.created_at),
      updatedAt: new Date(pgStrategy.updated_at),
    };

    // Add tags based on characteristics
    if (budget > 100000) transformedStrategy.tags.push('high-value');
    if (lineItems.length > 10) transformedStrategy.tags.push('complex');
    if (transformedStrategy.mediaMix.channels.length > 3)
      transformedStrategy.tags.push('multi-channel');

    transformedStrategies.push(transformedStrategy);
  }

  // Sort by campaign and creation date
  transformedStrategies.sort((a, b) => {
    if (a.campaignId !== b.campaignId) {
      return a.campaignId.localeCompare(b.campaignId);
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Save transformed strategies
  const outputPath = path.join(OUTPUT_DIR, 'strategies.json');
  await fs.writeFile(outputPath, JSON.stringify(transformedStrategies, null, 2));

  // Save strategy ID mapping for reference
  const mappingPath = path.join(OUTPUT_DIR, 'strategy-id-mapping.json');
  const mapping = Object.fromEntries(strategyIdMap);
  await fs.writeFile(mappingPath, JSON.stringify(mapping, null, 2));

  // Generate summary statistics
  const stats = {
    totalStrategies: transformedStrategies.length,
    byStatus: {
      draft: transformedStrategies.filter((s) => s.status === 'draft').length,
      pending: transformedStrategies.filter((s) => s.status === 'pending_approval').length,
      approved: transformedStrategies.filter((s) => s.status === 'approved').length,
      active: transformedStrategies.filter((s) => s.status === 'active').length,
      completed: transformedStrategies.filter((s) => s.status === 'completed').length,
    },
    totalBudget: transformedStrategies.reduce((sum, s) => sum + s.budget.targetAmount, 0),
    totalSpent: transformedStrategies.reduce((sum, s) => sum + s.budget.spentAmount, 0),
    strategiesWithLineItems: transformedStrategies.filter((s) => s.lineItemIds.length > 0).length,
    multiChannelStrategies: transformedStrategies.filter((s) => s.mediaMix.channels.length > 1)
      .length,
  };

  console.log(`\nTransformation complete!`);
  console.log(`- Transformed ${stats.totalStrategies} strategies`);
  console.log(`- Active strategies: ${stats.byStatus.active}`);
  console.log(`- Strategies with line items: ${stats.strategiesWithLineItems}`);
  console.log(`- Multi-channel strategies: ${stats.multiChannelStrategies}`);
  console.log(`- Total budget: $${stats.totalBudget.toLocaleString()}`);
  console.log(`- Total spent: $${stats.totalSpent.toLocaleString()}`);
  console.log(`- Output saved to: ${outputPath}`);
  console.log(`- ID mapping saved to: ${mappingPath}`);
}

// Run transformation
transformStrategies().catch(console.error);
