#!/usr/bin/env bun
/**
 * Transform and generate media plans from strategies and line items
 *
 * Media plans are high-level execution plans that group strategies and line items
 * This is a synthetic entity created from existing data relationships
 */

import fs from 'fs/promises';
import path from 'path';
import { ObjectId } from 'mongodb';

// Input and output directories
const POSTGRES_BACKUP_DIR = '../../data/postgres-backups/2025-06-27';
const OUTPUT_DIR = '../../data/transformed/2025-06-27';

// Load transformed data (already processed)
interface TransformedStrategy {
  _id: { $oid: string };
  strategyId: string;
  campaignId: string;
  campaignNumber?: string;
  name: string;
  status: string;
  dates: {
    start: string | null;
    end: string | null;
  };
  budget: {
    targetAmount: number;
  };
  mediaMix: {
    channels: string[];
    platforms: string[];
  };
  lineItemIds: string[];
}

interface TransformedLineItem {
  _id: { $oid: string };
  lineItemId: string;
  campaignId: string;
  strategyId?: string;
  name: string;
  type: string;
  status: string;
  platform?: string;
  mediaBudget: number;
  flightDates: {
    start: string;
    end: string;
  };
}

interface TransformedCampaign {
  _id: { $oid: string };
  campaignId: string;
  campaignNumber: string;
  name: string;
  status: string;
}

// MongoDB media plan type
interface MongoMediaPlan {
  _id: ObjectId;
  name: string;
  campaignId: string;
  campaignNumber: string;
  campaignName: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'active' | 'completed';

  // Plan overview
  overview: {
    objective: string;
    totalBudget: number;
    allocatedBudget: number;
    remainingBudget: number;
    strategyCount: number;
    lineItemCount: number;
    platformCount: number;
  };

  // Timeline
  timeline: {
    start: Date | null;
    end: Date | null;
    duration?: number;
    phases: Array<{
      name: string;
      start: Date;
      end: Date;
      budget: number;
      strategies: string[];
    }>;
  };

  // Media mix allocation
  mediaMix: {
    byChannel: Record<
      string,
      {
        budget: number;
        percentage: number;
        lineItemCount: number;
      }
    >;
    byPlatform: Record<
      string,
      {
        budget: number;
        percentage: number;
        lineItemCount: number;
      }
    >;
  };

  // Strategies in this plan
  strategies: Array<{
    strategyId: string;
    name: string;
    budget: number;
    status: string;
    lineItemCount: number;
  }>;

  // Approval workflow
  approval: {
    status: 'draft' | 'pending' | 'approved' | 'changes_requested';
    requestedAt?: Date;
    approvedAt?: Date;
    approvedBy?: string;
    comments?: string[];
  };

  // Performance targets
  targets: {
    impressions?: number;
    clicks?: number;
    conversions?: number;
    ctr?: number;
    cpc?: number;
    roas?: number;
  };

  // Metadata
  tags: string[];
  notes?: string;
  version: number;

  // Audit fields
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Determine media plan status based on strategies
function determineMediaPlanStatus(strategies: TransformedStrategy[]): MongoMediaPlan['status'] {
  if (strategies.length === 0) return 'draft';

  const statuses = strategies.map((s) => s.status);
  if (statuses.every((s) => s === 'completed')) return 'completed';
  if (statuses.some((s) => s === 'active')) return 'active';
  if (statuses.every((s) => s === 'approved')) return 'approved';
  if (statuses.some((s) => s === 'pending_approval')) return 'pending_approval';

  return 'draft';
}

// Create media plan phases based on line item dates
function createPhases(
  strategies: TransformedStrategy[],
  lineItems: TransformedLineItem[]
): MongoMediaPlan['timeline']['phases'] {
  // Group line items by month
  const phaseMap = new Map<
    string,
    {
      start: Date;
      end: Date;
      budget: number;
      strategies: Set<string>;
      lineItems: string[];
    }
  >();

  lineItems.forEach((li) => {
    const start = new Date(li.flightDates.start);
    const monthKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;

    const phase = phaseMap.get(monthKey) || {
      start: new Date(start.getFullYear(), start.getMonth(), 1),
      end: new Date(start.getFullYear(), start.getMonth() + 1, 0),
      budget: 0,
      strategies: new Set<string>(),
      lineItems: [],
    };

    phase.budget += li.mediaBudget;
    if (li.strategyId) phase.strategies.add(li.strategyId);
    phase.lineItems.push(li.lineItemId);

    phaseMap.set(monthKey, phase);
  });

  // Convert to array and sort by date
  const phases = Array.from(phaseMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, phase], index) => ({
      name: `Phase ${index + 1} - ${key}`,
      start: phase.start,
      end: phase.end,
      budget: phase.budget,
      strategies: Array.from(phase.strategies),
    }));

  return phases;
}

// Calculate media mix allocations
function calculateMediaMix(lineItems: TransformedLineItem[]) {
  const byChannel: Record<string, any> = {};
  const byPlatform: Record<string, any> = {};

  // For this transformation, we'll map platforms to channels
  const platformToChannel: Record<string, string> = {
    google_ads: 'search',
    facebook: 'social',
    instagram: 'social',
    linkedin: 'social',
    twitter: 'social',
    tiktok: 'video',
    youtube: 'video',
    programmatic: 'display',
    direct: 'direct',
    other: 'other',
  };

  lineItems.forEach((li) => {
    const platform = li.platform || 'other';
    const channel = platformToChannel[platform] || 'other';

    // By platform
    if (!byPlatform[platform]) {
      byPlatform[platform] = { budget: 0, lineItemCount: 0 };
    }
    byPlatform[platform].budget += li.mediaBudget;
    byPlatform[platform].lineItemCount++;

    // By channel
    if (!byChannel[channel]) {
      byChannel[channel] = { budget: 0, lineItemCount: 0 };
    }
    byChannel[channel].budget += li.mediaBudget;
    byChannel[channel].lineItemCount++;
  });

  // Calculate percentages
  const totalBudget = lineItems.reduce((sum, li) => sum + li.mediaBudget, 0);

  Object.keys(byChannel).forEach((channel) => {
    byChannel[channel].percentage =
      totalBudget > 0 ? (byChannel[channel].budget / totalBudget) * 100 : 0;
  });

  Object.keys(byPlatform).forEach((platform) => {
    byPlatform[platform].percentage =
      totalBudget > 0 ? (byPlatform[platform].budget / totalBudget) * 100 : 0;
  });

  return { byChannel, byPlatform };
}

async function transformMediaPlans() {
  console.log('Starting media plan generation...');

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Load transformed data
  console.log('Loading transformed data...');
  const strategiesPath = path.join(OUTPUT_DIR, 'strategies.json');
  const lineItemsPath = path.join(OUTPUT_DIR, 'line-items.json');
  const campaignsPath = path.join(
    OUTPUT_DIR,
    '..',
    '2025-06-27-postgres',
    'campaigns-from-postgres.json'
  );

  let strategies: TransformedStrategy[];
  let lineItems: TransformedLineItem[];
  let campaigns: TransformedCampaign[];

  try {
    strategies = JSON.parse(await fs.readFile(strategiesPath, 'utf-8'));
    lineItems = JSON.parse(await fs.readFile(lineItemsPath, 'utf-8'));
    campaigns = JSON.parse(await fs.readFile(campaignsPath, 'utf-8'));
  } catch (error) {
    console.error(
      'Error: Transformed data not found. Please run strategy and line item transformations first.'
    );
    process.exit(1);
  }

  console.log(
    `Loaded ${campaigns.length} campaigns, ${strategies.length} strategies, ${lineItems.length} line items`
  );

  // Group strategies and line items by campaign
  const strategiesByCampaign = new Map<string, TransformedStrategy[]>();
  strategies.forEach((strategy) => {
    const list = strategiesByCampaign.get(strategy.campaignId) || [];
    list.push(strategy);
    strategiesByCampaign.set(strategy.campaignId, list);
  });

  const lineItemsByCampaign = new Map<string, TransformedLineItem[]>();
  lineItems.forEach((item) => {
    const list = lineItemsByCampaign.get(item.campaignId) || [];
    list.push(item);
    lineItemsByCampaign.set(item.campaignId, list);
  });

  // Generate media plans (one per campaign with strategies)
  const mediaPlans: MongoMediaPlan[] = [];

  for (const campaign of campaigns) {
    const campaignStrategies = strategiesByCampaign.get(campaign.campaignId) || [];
    const campaignLineItems = lineItemsByCampaign.get(campaign.campaignId) || [];

    // Skip campaigns without strategies
    if (campaignStrategies.length === 0) continue;

    // Calculate dates
    const allDates = [
      ...campaignStrategies.map((s) => s.dates.start).filter((d) => d),
      ...campaignLineItems.map((li) => li.flightDates.start),
    ].map((d) => new Date(d!));

    const allEndDates = [
      ...campaignStrategies.map((s) => s.dates.end).filter((d) => d),
      ...campaignLineItems.map((li) => li.flightDates.end),
    ].map((d) => new Date(d!));

    const startDate =
      allDates.length > 0 ? new Date(Math.min(...allDates.map((d) => d.getTime()))) : null;
    const endDate =
      allEndDates.length > 0 ? new Date(Math.max(...allEndDates.map((d) => d.getTime()))) : null;
    const duration =
      startDate && endDate
        ? Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

    // Calculate budgets
    const totalBudget = campaignStrategies.reduce((sum, s) => sum + s.budget.targetAmount, 0);
    const allocatedBudget = campaignLineItems.reduce((sum, li) => sum + li.mediaBudget, 0);
    const remainingBudget = Math.max(0, totalBudget - allocatedBudget);

    // Get unique platforms
    const platforms = new Set(campaignLineItems.map((li) => li.platform).filter((p) => p));

    const mediaPlan: MongoMediaPlan = {
      _id: new ObjectId(),
      name: `Media Plan - ${campaign.name}`,
      campaignId: campaign.campaignId,
      campaignNumber: campaign.campaignNumber,
      campaignName: campaign.name,
      status: determineMediaPlanStatus(campaignStrategies),

      // Plan overview
      overview: {
        objective: `Execute media strategies for ${campaign.name}`,
        totalBudget,
        allocatedBudget,
        remainingBudget,
        strategyCount: campaignStrategies.length,
        lineItemCount: campaignLineItems.length,
        platformCount: platforms.size,
      },

      // Timeline
      timeline: {
        start: startDate,
        end: endDate,
        duration,
        phases: createPhases(campaignStrategies, campaignLineItems),
      },

      // Media mix
      mediaMix: calculateMediaMix(campaignLineItems),

      // Strategies
      strategies: campaignStrategies.map((s) => ({
        strategyId: s.strategyId,
        name: s.name,
        budget: s.budget.targetAmount,
        status: s.status,
        lineItemCount: s.lineItemIds.length,
      })),

      // Approval workflow
      approval: {
        status: campaignStrategies.some((s) => s.status === 'pending_approval')
          ? 'pending'
          : campaignStrategies.every((s) => s.status === 'approved' || s.status === 'active')
            ? 'approved'
            : 'draft',
      },

      // Performance targets (calculated based on budget)
      targets: {
        impressions: Math.floor(allocatedBudget * 100), // $10 CPM target
        clicks: Math.floor(allocatedBudget * 2), // $0.50 CPC target
        conversions: Math.floor(allocatedBudget * 0.1), // $10 CPA target
        ctr: 0.02, // 2% CTR target
        cpc: 0.5,
        roas: 3.0, // 3:1 ROAS target
      },

      // Metadata
      tags: [],
      version: 1,

      // Audit fields
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add tags
    if (totalBudget > 100000) mediaPlan.tags.push('high-value');
    if (platforms.size > 3) mediaPlan.tags.push('multi-platform');
    if (mediaPlan.timeline.phases.length > 3) mediaPlan.tags.push('long-term');
    if (mediaPlan.status === 'active') mediaPlan.tags.push('in-flight');

    mediaPlans.push(mediaPlan);
  }

  // Sort by status and budget
  mediaPlans.sort((a, b) => {
    const statusOrder = ['active', 'approved', 'pending_approval', 'draft', 'completed'];
    const aOrder = statusOrder.indexOf(a.status);
    const bOrder = statusOrder.indexOf(b.status);

    if (aOrder !== bOrder) return aOrder - bOrder;
    return b.overview.totalBudget - a.overview.totalBudget;
  });

  // Save media plans
  const outputPath = path.join(OUTPUT_DIR, 'media-plans.json');
  await fs.writeFile(outputPath, JSON.stringify(mediaPlans, null, 2));

  // Generate summary statistics
  const stats = {
    totalPlans: mediaPlans.length,
    byStatus: {
      active: mediaPlans.filter((p) => p.status === 'active').length,
      approved: mediaPlans.filter((p) => p.status === 'approved').length,
      pending: mediaPlans.filter((p) => p.status === 'pending_approval').length,
      draft: mediaPlans.filter((p) => p.status === 'draft').length,
      completed: mediaPlans.filter((p) => p.status === 'completed').length,
    },
    totalBudget: mediaPlans.reduce((sum, p) => sum + p.overview.totalBudget, 0),
    totalAllocated: mediaPlans.reduce((sum, p) => sum + p.overview.allocatedBudget, 0),
    avgStrategiesPerPlan:
      mediaPlans.reduce((sum, p) => sum + p.overview.strategyCount, 0) / mediaPlans.length || 0,
    avgLineItemsPerPlan:
      mediaPlans.reduce((sum, p) => sum + p.overview.lineItemCount, 0) / mediaPlans.length || 0,
  };

  console.log(`\nMedia plan generation complete!`);
  console.log(`- Generated ${stats.totalPlans} media plans`);
  console.log(
    `- By status: ${Object.entries(stats.byStatus)
      .map(([s, c]) => `${s}: ${c}`)
      .join(', ')}`
  );
  console.log(`- Total budget: $${stats.totalBudget.toLocaleString()}`);
  console.log(
    `- Total allocated: $${stats.totalAllocated.toLocaleString()} (${((stats.totalAllocated / stats.totalBudget) * 100).toFixed(1)}%)`
  );
  console.log(`- Average strategies per plan: ${stats.avgStrategiesPerPlan.toFixed(1)}`);
  console.log(`- Average line items per plan: ${stats.avgLineItemsPerPlan.toFixed(1)}`);
  console.log(`- Output saved to: ${outputPath}`);
}

// Run transformation
transformMediaPlans().catch(console.error);
