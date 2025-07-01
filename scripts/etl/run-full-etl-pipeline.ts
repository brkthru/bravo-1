#!/usr/bin/env bun
/**
 * Run the complete ETL pipeline - transform all PostgreSQL data and load into MongoDB
 *
 * Usage: bun run-full-etl-pipeline.ts [options]
 * Options:
 *   --transform-only   Only run transformations, don't load to MongoDB
 *   --load-only        Only load data (assumes transformations already done)
 *   --skip-backup      Skip MongoDB backup before loading
 *   --verbose          Show detailed output (default: concise output)
 *   --timestamps       Show timestamps for each operation
 */

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { ETLLogger } from './utils/logger';

// Configuration
const API_URL = process.env.API_URL || 'http://localhost:3001';
const POSTGRES_BACKUP_DIR = '../../data/postgres-backups/2025-06-27';
const TRANSFORMED_DIR = '../../data/transformed/2025-06-27';

// Parse command line arguments
const args = process.argv.slice(2);
const transformOnly = args.includes('--transform-only');
const loadOnly = args.includes('--load-only');
const skipBackup = args.includes('--skip-backup');
const verbose = args.includes('--verbose');
const showTimestamps = args.includes('--timestamps');

// Initialize logger
const logger = new ETLLogger({ verbose, showTimestamps });

// Entity loading order (respects dependencies)
const ENTITY_ORDER = [
  { name: 'users', file: 'users.json', collection: 'users' },
  { name: 'accounts', file: 'accounts.json', collection: 'accounts' },
  {
    name: 'campaigns',
    file: '../2025-06-27-postgres/campaigns-from-postgres.json',
    collection: 'campaigns',
    skipIfExists: true,
  },
  { name: 'strategies', file: 'strategies.json', collection: 'strategies' },
  { name: 'lineItems', file: 'line-items.json', collection: 'lineItems' },
  { name: 'platformBuys', file: 'platform-buys.json', collection: 'platformBuys' },
  { name: 'mediaPlans', file: 'media-plans.json', collection: 'mediaPlans' },
];

async function runCommand(command: string, description: string): Promise<void> {
  logger.info(`${description}...`);
  try {
    if (verbose) {
      execSync(command, { stdio: 'inherit' });
    } else {
      // Capture output in non-verbose mode
      const output = execSync(command, { encoding: 'utf-8' });
      // Only show errors or warnings
      const lines = output.split('\n');
      lines.forEach((line) => {
        if (line.includes('error') || line.includes('Error') || line.includes('❌')) {
          logger.error(line);
        } else if (line.includes('warning') || line.includes('Warning') || line.includes('⚠️')) {
          logger.warning(line);
        }
      });
    }
    logger.success(`${description} completed`);
  } catch (error: any) {
    logger.error(`${description} failed`, error);
    // In non-verbose mode, show the actual error output
    if (!verbose && error.stdout) {
      console.error('Error output:', error.stdout.toString());
    }
    throw error;
  }
}

async function checkFile(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadEntityToMongoDB(
  entity: (typeof ENTITY_ORDER)[0]
): Promise<{ success: boolean; stats: any }> {
  const filePath = path.join(TRANSFORMED_DIR, entity.file);

  // Check if file exists
  if (!(await checkFile(filePath))) {
    logger.warning(`Skipping ${entity.name} - file not found: ${entity.file}`);
    return { success: false, stats: { skipped: true } };
  }

  // Load data
  logger.info(`Loading ${entity.name}...`);
  const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
  logger.debug(`Found ${data.length} ${entity.name} to load`);

  // Prepare for ETL API
  const etlData =
    entity.name === 'campaigns'
      ? data.map((item: any) => {
          // Remove _id for campaigns to treat as inserts
          const { _id, ...campaignWithoutId } = item;
          return campaignWithoutId;
        })
      : data;

  // Call ETL API
  const response = await fetch(`${API_URL}/api/etl/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entity: entity.name,
      data: etlData,
      options: {
        validateAll: false, // Skip validation for initial load
        stopOnError: false,
        returnFailedRecords: true,
      },
    }),
  });

  const result = await response.json();

  if (result.success) {
    const stats = {
      inserted: result.data.inserted,
      updated: result.data.updated,
      failed: result.data.failed,
    };

    logger.summary(`${entity.name} loaded`, stats);

    if (result.data.failed > 0 && result.data.errors) {
      logger.warning(`${result.data.failed} failed records for ${entity.name}`);
      if (verbose) {
        result.data.errors.slice(0, 5).forEach((err: any) => {
          logger.detail(`Index ${err.index}: ${err.error}`);
        });
        if (result.data.errors.length > 5) {
          logger.detail(`... and ${result.data.errors.length - 5} more`);
        }
      }
    }

    return { success: true, stats };
  } else {
    logger.error(`Failed to load ${entity.name}: ${result.error}`);
    if (result.details) {
      logger.debug(`Details: ${result.details}`);
    }
    return { success: false, stats: { error: result.error } };
  }
}

async function runTransformations(): Promise<void> {
  logger.section('Running data transformations');

  // Check if PostgreSQL backup exists
  if (!(await checkFile(path.join(POSTGRES_BACKUP_DIR, 'campaigns.json')))) {
    throw new Error(`PostgreSQL backup not found at ${POSTGRES_BACKUP_DIR}`);
  }

  // Run transformations in order
  await runCommand('bun transform-users.ts', 'Transforming users');
  await runCommand('bun transform-accounts.ts', 'Transforming accounts');
  await runCommand('bun transform-postgres-to-mongodb.ts', 'Transforming campaigns');
  await runCommand('bun transform-strategies.ts', 'Transforming strategies');
  await runCommand('bun transform-line-items.ts', 'Transforming line items');
  await runCommand('bun transform-platform-buys.ts', 'Transforming platform buys');

  // Media plans depend on other transformed data
  await runCommand('bun transform-media-plans.ts', 'Generating media plans');
}

async function backupMongoDB(): Promise<void> {
  logger.info('Backing up MongoDB...');
  const backupDir = `../../data/mongodb-backups/${new Date().toISOString().split('T')[0]}`;
  await fs.mkdir(backupDir, { recursive: true });

  // Simple backup using mongoexport
  let backedUp = 0;
  for (const entity of ENTITY_ORDER) {
    try {
      execSync(
        `mongoexport --db bravo-1 --collection ${entity.collection} --out ${backupDir}/${entity.collection}.json`,
        { stdio: 'pipe' }
      );
      backedUp++;
      logger.debug(`Backed up ${entity.collection}`);
    } catch (error) {
      // Collection might not exist yet
      logger.debug(`Skipped ${entity.collection} (might not exist)`);
    }
  }

  logger.success(`Backup saved to ${backupDir} (${backedUp} collections)`);
}

async function main() {
  if (verbose) {
    console.log('🚀 Bravo-1 Full ETL Pipeline');
    console.log('============================');
  }

  try {
    // Check API is running
    try {
      const statusResponse = await fetch(`${API_URL}/api/etl/status`);
      const status = await statusResponse.json();
      logger.success(`ETL API is ${status.data?.status || 'ready'}`);
      logger.debug(
        `Supported entities: ${status.data?.supportedEntities?.join(', ') || 'unknown'}`
      );
    } catch (error) {
      logger.error('ETL API is not running. Please start the backend server first.');
      logger.debug('Run: npm run dev:api');
      process.exit(1);
    }

    // Track overall stats
    const pipelineStats: Record<string, any> = {
      transformations: loadOnly ? 'skipped' : 'pending',
      mongoLoad: transformOnly ? 'skipped' : 'pending',
      errors: 0,
      warnings: 0,
    };

    // Step 1: Transform data (unless --load-only)
    if (!loadOnly) {
      await runTransformations();
      pipelineStats.transformations = 'complete';
    }

    // Step 2: Backup MongoDB (unless skipped or transform-only)
    if (!transformOnly && !skipBackup) {
      await backupMongoDB();
    }

    // Step 3: Load data to MongoDB (unless --transform-only)
    if (!transformOnly) {
      logger.section('Loading data to MongoDB');

      const loadStats = {
        totalInserted: 0,
        totalUpdated: 0,
        totalFailed: 0,
        entitiesLoaded: 0,
        entitiesSkipped: 0,
      };

      for (const entity of ENTITY_ORDER) {
        const result = await loadEntityToMongoDB(entity);
        if (result.success) {
          if (result.stats.skipped) {
            loadStats.entitiesSkipped++;
          } else {
            loadStats.entitiesLoaded++;
            loadStats.totalInserted += result.stats.inserted || 0;
            loadStats.totalUpdated += result.stats.updated || 0;
            loadStats.totalFailed += result.stats.failed || 0;
          }
        } else {
          pipelineStats.errors++;
        }
      }

      pipelineStats.mongoLoad = 'complete';
      pipelineStats.loadStats = loadStats;
    }

    // Determine overall status
    const hasErrors =
      pipelineStats.errors > 0 ||
      (pipelineStats.loadStats && pipelineStats.loadStats.entitiesLoaded === 0 && !transformOnly);
    const status = hasErrors ? '❌ Failed' : '✅ Success';

    // Final summary
    logger.finalSummary({
      Status: status,
      Transformations: pipelineStats.transformations,
      'MongoDB Load': pipelineStats.mongoLoad,
      ...(pipelineStats.loadStats && {
        'Entities Loaded': `${pipelineStats.loadStats.entitiesLoaded}/${ENTITY_ORDER.length}`,
        'Total Inserted': pipelineStats.loadStats.totalInserted,
        'Total Updated': pipelineStats.loadStats.totalUpdated,
        'Total Failed': pipelineStats.loadStats.totalFailed,
      }),
      ...(pipelineStats.errors > 0 && {
        Errors: pipelineStats.errors,
      }),
    });

    if (!transformOnly && verbose) {
      console.log('\nNext steps:');
      console.log('1. Start the frontend: npm run dev:frontend');
      console.log('2. View data at: http://localhost:5174');
      console.log('3. Run tests: npm test && npx playwright test');
    }
  } catch (error: any) {
    logger.error('ETL Pipeline failed', error);
    process.exit(1);
  }
}

// Run the pipeline
main().catch(console.error);
