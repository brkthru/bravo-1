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
    console.log('Loading data via API (without validation)...');
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

    // Load campaigns
    const campaignsPath = path.join(INPUT_DIR, 'campaigns-decimal.json');
    if (await fileExists(campaignsPath)) {
      console.log('\nLoading campaigns...');
      const result = await loadEntity('campaigns', campaignsPath);
      printResult(result);
    }

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
            validateAll: false, // DISABLE VALIDATION
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

// Run the loader
loadViaAPI().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
