#!/usr/bin/env bun

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

async function runETL() {
  console.log('=== MongoDB Data ETL Process ===\n');

  const steps = [
    {
      name: 'Extract',
      script: 'extract-data.ts',
      description: 'Extracting data from source...',
    },
    {
      name: 'Transform',
      script: 'transform-data.ts',
      description: 'Transforming data to new structure...',
    },
    {
      name: 'Load',
      script: 'load-data.ts',
      description: 'Loading data via API (with calculations and validation)...',
    },
  ];

  // Check if user wants to run specific step
  const args = process.argv.slice(2);
  const specificStep = args[0];

  if (specificStep && !['extract', 'transform', 'load', 'all'].includes(specificStep)) {
    console.error(`Invalid step: ${specificStep}`);
    console.error('Usage: bun run etl [extract|transform|load|all]');
    console.error('\nOptions:');
    console.error('  extract   - Extract data from source');
    console.error('  transform - Transform data structure');
    console.error('  load      - Load data via API (applies calculations, validation)');
    console.error('  all       - Run complete ETL process');
    process.exit(1);
  }

  // Filter steps based on argument
  let stepsToRun = steps;
  if (specificStep && specificStep !== 'all') {
    stepsToRun = steps.filter((s) => s.name.toLowerCase() === specificStep);
  }

  // Run selected steps
  for (const step of stepsToRun) {
    console.log(`\n${step.description}`);
    console.log(`Running: bun ${step.script}`);

    try {
      const { stdout, stderr } = await execAsync(`bun ${path.join(__dirname, step.script)}`);

      if (stdout) console.log(stdout);
      if (stderr) console.error(stderr);

      console.log(`✓ ${step.name} completed successfully`);
    } catch (error) {
      console.error(`✗ ${step.name} failed:`, error.message);
      process.exit(1);
    }
  }

  console.log('\n=== ETL Process Complete ===');

  // Show summary of output directories
  const dirs = ['./data-export', './data-transformed'];
  console.log('\nOutput directories:');

  for (const dir of dirs) {
    try {
      const stats = await fs.stat(dir);
      if (stats.isDirectory()) {
        const files = await fs.readdir(dir);
        console.log(`\n${dir}:`);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const fileStats = await fs.stat(filePath);
          const sizeMB = (fileStats.size / 1024 / 1024).toFixed(2);
          console.log(`  - ${file} (${sizeMB} MB)`);
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  console.log('\nNext steps:');
  console.log('1. Check the extracted data in ./data-export/');
  console.log('2. Review the transformed data in ./data-transformed/');
  console.log('3. The data has been loaded into MongoDB via API');
  console.log('\nTo run individual steps:');
  console.log('  bun run etl extract   # Extract data only');
  console.log('  bun run etl transform # Transform data only');
  console.log('  bun run etl load      # Load data via API');
}

// Run the ETL process
runETL();
