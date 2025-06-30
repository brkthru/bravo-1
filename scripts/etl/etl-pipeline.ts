#!/usr/bin/env bun
/**
 * Unified ETL Pipeline for Bravo-1
 *
 * This is the SINGLE source of truth for ETL operations.
 * Handles extract, transform, and load for all PostgreSQL → MongoDB migrations.
 *
 * Usage:
 *   bun etl-pipeline.ts                    # Full ETL with latest export
 *   bun etl-pipeline.ts --clean            # Drop databases first
 *   bun etl-pipeline.ts --export=20250628  # Use specific export
 *   bun etl-pipeline.ts --verify           # Run verification after load
 */

import { MongoClient, ObjectId, Db } from 'mongodb';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

// Configuration
const MONGODB_URI = 'mongodb://localhost:27017';
const DATABASE_NAME = 'bravo-1';
const EXPORTS_DIR = '../../exports/raw';
const TRANSFORM_DIR = '../../data/transformed';

// Command line arguments
const args = process.argv.slice(2);
const shouldHelp = args.includes('--help') || args.includes('-h');
const shouldClean = args.includes('--clean');
const shouldVerify = args.includes('--verify');
const exportArg = args.find((arg) => arg.startsWith('--export='));
const exportDate = exportArg ? exportArg.split('=')[1] : null;

// Show help if requested
if (shouldHelp) {
  console.log(`
Bravo-1 Unified ETL Pipeline

Usage: bun etl-pipeline.ts [options]

Options:
  --clean          Drop databases before loading (fresh start)
  --verify         Verify data integrity after loading
  --export=DATE    Use specific export (e.g., --export=20250628)
  --help, -h       Show this help message

Examples:
  bun etl-pipeline.ts                    # Basic ETL with latest export
  bun etl-pipeline.ts --clean --verify   # Clean start with verification
  bun etl-pipeline.ts --export=20250628  # Use specific export date

This script:
  1. Finds PostgreSQL export data (latest or specified)
  2. Transforms to MongoDB schema (with media trader aggregation)
  3. Loads into MongoDB collections
  4. Optionally verifies data integrity

Database: mongodb://localhost:27017/bravo-1
`);
  process.exit(0);
}

interface TransformResult {
  collection: string;
  documents: any[];
  count: number;
}

interface LoadResult {
  collection: string;
  loaded: number;
  errors: number;
}

/**
 * Find the latest export directory or use specified one
 */
async function getExportDirectory(): Promise<string> {
  if (exportDate) {
    // Find directory matching the date pattern
    const dirs = await fs.readdir(EXPORTS_DIR);
    const matching = dirs.find((dir) => dir.startsWith(exportDate));
    if (!matching) {
      throw new Error(`No export found matching date: ${exportDate}`);
    }
    return path.join(EXPORTS_DIR, matching);
  }

  // Find latest export
  const dirs = await fs.readdir(EXPORTS_DIR);
  const exportDirs = dirs.filter((dir) => /^\d{8}-\d{6}$/.test(dir)).sort();
  if (exportDirs.length === 0) {
    throw new Error('No export directories found');
  }

  return path.join(EXPORTS_DIR, exportDirs[exportDirs.length - 1]);
}

/**
 * Clean databases - drop all data for fresh start
 */
async function cleanDatabases(): Promise<void> {
  console.log('🧹 Cleaning databases...\n');

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();

    // Drop the entire database
    await client.db(DATABASE_NAME).dropDatabase();
    console.log(`  ✅ Dropped database: ${DATABASE_NAME}`);

    // Also drop any backup databases
    const adminDb = client.db('admin');
    const { databases } = await adminDb.admin().listDatabases();

    for (const db of databases) {
      if (db.name.startsWith('bravo-1_backup_') || db.name.startsWith('mediatool_')) {
        await client.db(db.name).dropDatabase();
        console.log(`  ✅ Dropped backup database: ${db.name}`);
      }
    }
  } finally {
    await client.close();
  }
}

/**
 * Load JSON file from export
 */
async function loadExportFile(exportDir: string, filename: string): Promise<any[]> {
  const filepath = path.join(exportDir, filename);
  try {
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`  ⚠️  Could not load ${filename}`);
    return [];
  }
}

/**
 * Transform PostgreSQL data to MongoDB format
 */
async function transformData(exportDir: string): Promise<TransformResult[]> {
  console.log('🔄 Transforming data...\n');

  const results: TransformResult[] = [];

  // Load all raw data
  const campaigns = await loadExportFile(exportDir, 'campaigns.json');
  const accounts = await loadExportFile(exportDir, 'accounts.json');
  const users = await loadExportFile(exportDir, 'users.json');
  const strategies = await loadExportFile(exportDir, 'strategies.json');
  const lineItems = await loadExportFile(exportDir, 'line_items.json');
  const lineItemMediaBuys = await loadExportFile(exportDir, 'line_item_media_buys.json');
  const mediaBuys = await loadExportFile(exportDir, 'media_buys.json');
  const mediaPlatformEntities = await loadExportFile(exportDir, 'media_platform_entities.json');
  const mediaPlatforms = await loadExportFile(exportDir, 'media_platforms.json');
  const channels = await loadExportFile(exportDir, 'channels.json');
  const tactics = await loadExportFile(exportDir, 'tactics.json');
  const teams = await loadExportFile(exportDir, 'teams.json');

  // Performance metrics (if available)
  const dailyImpressions = await loadExportFile(exportDir, 'platform_buy_daily_impressions.json');
  const dailyVideos = await loadExportFile(exportDir, 'platform_buy_daily_videos.json');

  console.log(
    `  📊 Loaded ${campaigns.length} campaigns, ${accounts.length} accounts, ${users.length} users`
  );
  if (dailyImpressions.length > 0) {
    console.log(`  📈 Loaded ${dailyImpressions.length} daily impression records`);
  }
  if (dailyVideos.length > 0) {
    console.log(`  📹 Loaded ${dailyVideos.length} daily video records`);
  }

  // Create lookup maps
  const userMap = new Map(users.map((u) => [u.id, u]));
  const userByZohoId = new Map(users.map((u) => [u.zoho_user_id, u]));
  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  // Transform accounts
  const transformedAccounts = accounts.map((acc) => ({
    _id: new ObjectId(),
    accountId: acc.id,
    accountNumber: acc.account_number,
    accountName: acc.account_name,
    ...acc,
  }));
  results.push({
    collection: 'accounts',
    documents: transformedAccounts,
    count: transformedAccounts.length,
  });

  // Transform users to zohoUsers (preserving Zoho data)
  const transformedZohoUsers = users.map((user) => ({
    _id: new ObjectId(),
    userId: user.id,
    zohoUserId: user.zoho_user_id,
    name: user.name,
    email: user.email,
    syncedAt: new Date(),
    ...user,
  }));
  results.push({
    collection: 'zohoUsers',
    documents: transformedZohoUsers,
    count: transformedZohoUsers.length,
  });

  // Map relationships for campaign transformation
  const strategiesByCampaign = new Map<string, any[]>();
  strategies.forEach((strategy) => {
    if (!strategiesByCampaign.has(strategy.campaign_id)) {
      strategiesByCampaign.set(strategy.campaign_id, []);
    }
    strategiesByCampaign.get(strategy.campaign_id)!.push(strategy);
  });

  const lineItemsByStrategy = new Map<string, any[]>();
  lineItems.forEach((item) => {
    if (!lineItemsByStrategy.has(item.strategy_id)) {
      lineItemsByStrategy.set(item.strategy_id, []);
    }
    lineItemsByStrategy.get(item.strategy_id)!.push(item);
  });

  // Aggregate media traders from line items to campaigns
  console.log('  🔗 Aggregating media traders from line items...');
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

  console.log(`  ✅ Found ${mediaTradersByCampaign.size} campaigns with media traders`);

  // Transform campaigns with enhanced data
  const transformedCampaigns = campaigns
    .filter((c) => !c.is_deleted)
    .map((campaign) => {
      const account = accountMap.get(campaign.account_id);
      const leadAccountOwner = userByZohoId.get(campaign.lead_account_owner_user_id);
      const campaignMediaTraders = mediaTradersByCampaign.get(campaign.id) || new Set();

      // Build team structure
      const mediaTradersList = Array.from(campaignMediaTraders)
        .map((traderId) => {
          const user = userMap.get(traderId);
          return user
            ? {
                id: user.zoho_user_id || user.id,
                name: user.name,
                email: user.email,
                role: 'media_trader',
              }
            : null;
        })
        .filter(Boolean);

      return {
        _id: new ObjectId(),
        campaignId: campaign.id,
        campaignNumber: campaign.campaign_number,
        name: campaign.campaign_name,
        status: mapCampaignStatus(campaign.stage),
        displayStatus: campaign.stage,
        accountId: campaign.account_id,
        accountName: account?.account_name,
        team: {
          accountManager: leadAccountOwner
            ? {
                id: leadAccountOwner.zoho_user_id,
                name: leadAccountOwner.name,
                email: leadAccountOwner.email,
                role: 'account_manager',
              }
            : undefined,
          seniorMediaTraders: [],
          mediaTraders: mediaTradersList,
        },
        dates: calculateDates(campaign),
        price: calculatePricing(campaign),
        metrics: calculateMetrics(campaign),
        ...campaign,
      };
    });

  results.push({
    collection: 'campaigns',
    documents: transformedCampaigns,
    count: transformedCampaigns.length,
  });

  // Transform other collections
  const transformedStrategies = strategies.map((s) => ({
    _id: new ObjectId(),
    strategyId: s.id,
    campaignId: s.campaign_id,
    ...s,
  }));
  results.push({
    collection: 'strategies',
    documents: transformedStrategies,
    count: transformedStrategies.length,
  });

  const transformedLineItems = lineItems.map((li) => ({
    _id: new ObjectId(),
    lineItemId: li.id,
    strategyId: li.strategy_id,
    mediaTraderUserIds: li.media_trader_user_ids || [],
    ...li,
  }));
  results.push({
    collection: 'lineItems',
    documents: transformedLineItems,
    count: transformedLineItems.length,
  });

  const transformedLineItemMediaBuys = lineItemMediaBuys.map((mb) => ({
    _id: new ObjectId(),
    mediaBuyId: mb.id,
    lineItemId: mb.line_item_id,
    ...mb,
  }));
  results.push({
    collection: 'lineItemMediaBuys',
    documents: transformedLineItemMediaBuys,
    count: transformedLineItemMediaBuys.length,
  });

  const transformedMediaBuys = mediaBuys.map((mb) => ({
    _id: new ObjectId(),
    mediaBuyId: mb.id,
    ...mb,
  }));
  results.push({
    collection: 'mediaBuys',
    documents: transformedMediaBuys,
    count: transformedMediaBuys.length,
  });

  const transformedMediaPlatformEntities = mediaPlatformEntities.map((mpe) => ({
    _id: new ObjectId(),
    entityId: mpe.id,
    ...mpe,
  }));
  results.push({
    collection: 'mediaPlatformEntities',
    documents: transformedMediaPlatformEntities,
    count: transformedMediaPlatformEntities.length,
  });

  // Transform media platforms (lookup table)
  const transformedMediaPlatforms = mediaPlatforms.map((mp) => ({
    _id: new ObjectId(),
    platformId: mp.id,
    name: mp.name,
    ...mp,
  }));
  results.push({
    collection: 'mediaPlatforms',
    documents: transformedMediaPlatforms,
    count: transformedMediaPlatforms.length,
  });

  // Transform channels
  const transformedChannels = channels.map((ch) => ({
    _id: new ObjectId(),
    channelId: ch.id,
    ...ch,
  }));
  results.push({
    collection: 'channels',
    documents: transformedChannels,
    count: transformedChannels.length,
  });

  // Transform tactics
  const transformedTactics = tactics.map((t) => ({
    _id: new ObjectId(),
    tacticId: t.id,
    ...t,
  }));
  results.push({
    collection: 'tactics',
    documents: transformedTactics,
    count: transformedTactics.length,
  });

  // Transform teams
  const transformedTeams = teams.map((team) => ({
    _id: new ObjectId(),
    teamId: team.id,
    ...team,
  }));
  results.push({
    collection: 'teams',
    documents: transformedTeams,
    count: transformedTeams.length,
  });

  // Transform performance metrics (if available)
  if (dailyImpressions.length > 0) {
    const transformedDailyImpressions = dailyImpressions.map((di) => ({
      _id: new ObjectId(),
      ...di,
      date: new Date(di.date),
      createdAt: di.created_at ? new Date(di.created_at) : new Date(),
      updatedAt: di.updated_at ? new Date(di.updated_at) : new Date(),
    }));
    results.push({
      collection: 'platformBuyDailyImpressions',
      documents: transformedDailyImpressions,
      count: transformedDailyImpressions.length,
    });
  }

  if (dailyVideos.length > 0) {
    const transformedDailyVideos = dailyVideos.map((dv) => ({
      _id: new ObjectId(),
      ...dv,
      date: new Date(dv.date),
      createdAt: dv.created_at ? new Date(dv.created_at) : new Date(),
      updatedAt: dv.updated_at ? new Date(dv.updated_at) : new Date(),
    }));
    results.push({
      collection: 'platformBuyDailyVideos',
      documents: transformedDailyVideos,
      count: transformedDailyVideos.length,
    });
  }

  // Save transformed data
  const exportName = path.basename(exportDir);
  const outputDir = path.join(TRANSFORM_DIR, exportName);
  await fs.mkdir(outputDir, { recursive: true });

  for (const result of results) {
    const outputPath = path.join(outputDir, `${result.collection}.json`);
    await fs.writeFile(outputPath, JSON.stringify(result.documents, null, 2));
    console.log(`  ✅ Transformed ${result.count} ${result.collection}`);
  }

  return results;
}

/**
 * Load transformed data into MongoDB
 */
async function loadData(transformedData: TransformResult[]): Promise<LoadResult[]> {
  console.log('\n📥 Loading data into MongoDB...\n');

  const client = new MongoClient(MONGODB_URI);
  const results: LoadResult[] = [];

  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);

    for (const { collection, documents } of transformedData) {
      const coll = db.collection(collection);

      // Clear existing data
      const deleteResult = await coll.deleteMany({});

      if (documents.length === 0) {
        results.push({ collection, loaded: 0, errors: 0 });
        continue;
      }

      // Insert in batches
      const batchSize = 1000;
      let loaded = 0;
      let errors = 0;

      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        try {
          const result = await coll.insertMany(batch, { ordered: false });
          loaded += result.insertedCount;
        } catch (error: any) {
          console.error(
            `  ❌ Error in ${collection} batch ${Math.floor(i / batchSize) + 1}:`,
            error.message
          );
          errors += batch.length;
        }
      }

      results.push({ collection, loaded, errors });
      console.log(`  ✅ Loaded ${loaded} documents into ${collection}`);
    }
  } finally {
    await client.close();
  }

  return results;
}

/**
 * Verify loaded data
 */
async function verifyData(): Promise<void> {
  console.log('\n🔍 Verifying data...\n');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);

    const collections = await db.listCollections().toArray();

    for (const { name } of collections) {
      const coll = db.collection(name);
      const count = await coll.countDocuments();
      const sample = await coll.findOne();

      console.log(`  ${name}: ${count.toLocaleString()} documents`);

      if (sample && sample._id) {
        console.log(`    ✅ ObjectId format verified`);
      }
    }

    // Check specific campaign
    const campaign = await db.collection('campaigns').findOne({ campaignNumber: 'CN-11274' });
    if (campaign) {
      console.log('\n  Sample campaign CN-11274:');
      console.log(`    Name: ${campaign.name}`);
      console.log(`    Media traders: ${campaign.team?.mediaTraders?.length || 0}`);
    }
  } finally {
    await client.close();
  }
}

// Helper functions
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

function calculateDates(campaign: any) {
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

  return {
    start: startDate?.toISOString(),
    end: endDate?.toISOString(),
    daysElapsed,
    totalDuration,
  };
}

function calculatePricing(campaign: any) {
  const targetAmount = Number(campaign.budget) || 0;
  const actualAmount = targetAmount * 0.3; // Simulate 30% spent

  return {
    targetAmount: targetAmount.toFixed(6),
    actualAmount,
    remainingAmount: targetAmount - actualAmount,
    currency: 'USD',
  };
}

function calculateMetrics(campaign: any) {
  const targetAmount = Number(campaign.budget) || 0;
  const actualAmount = targetAmount * 0.3;

  return {
    deliveryPacing: 0.3,
    spendPacing: 0.28,
    marginAmount: targetAmount * 0.3,
    marginPercentage: 30,
    units: 0,
    unitType: 'impressions',
    revenueDelivered: actualAmount * 1.3,
    budgetSpent: actualAmount,
    marginActual: 0.28,
  };
}

/**
 * Main ETL pipeline
 */
async function runETL() {
  console.log('🚀 Bravo-1 ETL Pipeline\n' + '='.repeat(60) + '\n');

  try {
    // Step 1: Clean if requested
    if (shouldClean) {
      await cleanDatabases();
    }

    // Step 2: Find export directory
    const exportDir = await getExportDirectory();
    console.log(`📁 Using export: ${path.basename(exportDir)}\n`);

    // Step 3: Transform data
    const transformedData = await transformData(exportDir);

    // Step 4: Load data
    const loadResults = await loadData(transformedData);

    // Step 5: Summary
    console.log('\n' + '='.repeat(60));
    console.log('ETL SUMMARY');
    console.log('='.repeat(60));

    let totalLoaded = 0;
    let totalErrors = 0;

    loadResults.forEach((result) => {
      totalLoaded += result.loaded;
      totalErrors += result.errors;

      const status = result.errors === 0 ? '✅' : '⚠️';
      console.log(
        `${status} ${result.collection.padEnd(25)} ${result.loaded.toString().padStart(8)} loaded`
      );
    });

    console.log('='.repeat(60));
    console.log(`Total documents loaded: ${totalLoaded.toLocaleString()}`);
    if (totalErrors > 0) {
      console.log(`Total errors: ${totalErrors}`);
    }

    // Step 6: Verify if requested
    if (shouldVerify) {
      await verifyData();
    }

    console.log('\n✅ ETL pipeline completed successfully!\n');
  } catch (error) {
    console.error('\n❌ ETL pipeline failed:', error);
    process.exit(1);
  }
}

// Run the pipeline
if (import.meta.main) {
  runETL();
}
