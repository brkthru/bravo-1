#!/usr/bin/env bun
import * as fs from 'fs/promises';
import * as path from 'path';

const API_BASE_URL = process.env.API_URL || 'http://localhost:3001/api';
const INPUT_DIR = './data-transformed';
const BATCH_SIZE = 500;

interface LoadResult {
  entity: string;
  total: number;
  inserted: number;
  updated: number;
  failed: number;
  duration: number;
  errors?: Array<{ index: number; error: string }>;
}

async function loadViaAPI(): Promise<void> {
  try {
    console.log('Loading data via API...');
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Batch Size: ${BATCH_SIZE}`);

    // Check API availability
    const healthCheck = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
    if (!healthCheck.ok) {
      throw new Error(
        'API is not available. Please ensure the backend server is running:\n  cd backend && npm run dev'
      );
    }
    const health = await healthCheck.json();
    console.log('API Status:', health);

    // Get ETL status
    const etlStatusResponse = await fetch(`${API_BASE_URL}/etl/status`);
    if (etlStatusResponse.ok) {
      const etlStatus = await etlStatusResponse.json();
      console.log('ETL System:', etlStatus.data);
    }

    // Load campaigns
    const campaignsPath = path.join(INPUT_DIR, 'campaigns-decimal.json');
    if (await fileExists(campaignsPath)) {
      console.log('\nLoading campaigns...');
      const result = await loadEntity('campaigns', campaignsPath);
      printResult(result);
    }

    // Future: Load other entities
    // const strategiesPath = path.join(INPUT_DIR, 'strategies.json');
    // const lineItemsPath = path.join(INPUT_DIR, 'lineItems.json');

    console.log('\n✅ Data loading via API completed!');
  } catch (error) {
    console.error('Failed to load data via API:', error);
    throw error;
  }
}

async function loadEntity(entity: string, filePath: string): Promise<LoadResult> {
  const startTime = Date.now();
  const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));

  console.log(`Found ${data.length} ${entity} to load`);

  const result: LoadResult = {
    entity,
    total: data.length,
    inserted: 0,
    updated: 0,
    failed: 0,
    duration: 0,
    errors: [],
  };

  // Process in batches
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(data.length / BATCH_SIZE);

    console.log(`  Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)...`);

    try {
      const response = await fetch(`${API_BASE_URL}/etl/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entity,
          data: batch,
          options: {
            validateAll: true,
            stopOnError: false,
            applyCalculations: true,
            returnFailedRecords: true,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error(`  Batch ${batchNumber} failed:`, error);
        result.failed += batch.length;
        result.errors?.push({
          index: i,
          error: error.error || 'Unknown error',
        });
        continue;
      }

      const batchResult = await response.json();
      result.inserted += batchResult.data.inserted;
      result.updated += batchResult.data.updated;
      result.failed += batchResult.data.failed;

      if (batchResult.data.errors) {
        result.errors?.push(
          ...batchResult.data.errors.map((e: any) => ({
            index: i + e.index,
            error: e.error,
          }))
        );
      }

      // Show progress
      const progress = Math.round(((i + batch.length) / data.length) * 100);
      console.log(`  Progress: ${progress}%`);
    } catch (error) {
      console.error(`  Batch ${batchNumber} error:`, error);
      result.failed += batch.length;
      result.errors?.push({
        index: i,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  result.duration = Date.now() - startTime;
  return result;
}

function printResult(result: LoadResult): void {
  console.log(`\n${result.entity} Load Summary:`);
  console.log(`  Total: ${result.total}`);
  console.log(`  Inserted: ${result.inserted}`);
  console.log(`  Updated: ${result.updated}`);
  console.log(`  Failed: ${result.failed}`);
  console.log(`  Duration: ${(result.duration / 1000).toFixed(2)}s`);

  if (result.errors && result.errors.length > 0) {
    console.log(`\n  First 5 errors:`);
    result.errors.slice(0, 5).forEach((error) => {
      console.log(`    - Record ${error.index}: ${error.error}`);
    });

    if (result.errors.length > 5) {
      console.log(`    ... and ${result.errors.length - 5} more errors`);
    }
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

// CLI interface
const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help') {
  console.log(`
ETL Data Loader
===============

This script loads transformed data into MongoDB using the API endpoints.
This ensures all business logic, calculations, and validation are applied consistently.

Usage:
  bun load-data.ts              # Load all data
  bun load-data.ts help         # Show this help

Prerequisites:
  1. Backend server must be running (npm run dev:backend)
  2. MongoDB must be running
  3. Data must be transformed (run transform-data.ts first)

Environment Variables:
  API_URL     - API base URL (default: http://localhost:3001/api)
  BATCH_SIZE  - Records per batch (default: 500)

Benefits:
  - All calculations are applied consistently
  - Data validation is enforced
  - Audit trail with calculation versions
  - No duplicate business logic
`);
  process.exit(0);
}

// Run the loader
loadViaAPI().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
