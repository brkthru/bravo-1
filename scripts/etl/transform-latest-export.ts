#!/usr/bin/env bun
/**
 * Transform the latest PostgreSQL export to MongoDB format
 * Automatically finds the most recent export in the exports/raw directory
 */

import fs from 'fs/promises';
import path from 'path';
import { transformPostgresToMongoDB } from './transform-postgres-to-mongodb';

async function findLatestExport(): Promise<string | null> {
  const exportsDir = '../../exports/raw';

  try {
    const entries = await fs.readdir(exportsDir, { withFileTypes: true });
    const directories = entries
      .filter((entry) => entry.isDirectory() && /^\d{8}-\d{6}$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse();

    return directories[0] || null;
  } catch (error) {
    console.error('Error finding exports:', error);
    return null;
  }
}

async function main() {
  const latestExport = await findLatestExport();

  if (!latestExport) {
    console.error('No export directories found in exports/raw/');
    process.exit(1);
  }

  console.log(`Using latest export: ${latestExport}`);

  // Update the paths in the transform script
  const transformScript = await fs.readFile('./transform-postgres-to-mongodb.ts', 'utf-8');
  const updatedScript = transformScript
    .replace(
      /const POSTGRES_BACKUP_DIR = '.*'/,
      `const POSTGRES_BACKUP_DIR = '../../exports/raw/${latestExport}'`
    )
    .replace(
      /const OUTPUT_DIR = '.*'/,
      `const OUTPUT_DIR = '../../data/transformed/${latestExport}'`
    );

  await fs.writeFile('./transform-postgres-to-mongodb.ts', updatedScript);

  // Update the load script path
  const loadScript = await fs.readFile('./load-new-schema-data.ts', 'utf-8');
  const updatedLoadScript = loadScript.replace(
    /const INPUT_FILE = '.*'/,
    `const INPUT_FILE = '../../data/transformed/${latestExport}/campaigns-from-postgres.json'`
  );

  await fs.writeFile('./load-new-schema-data.ts', updatedLoadScript);

  console.log('Updated scripts to use latest export');
  console.log(`Input: exports/raw/${latestExport}`);
  console.log(`Output: data/transformed/${latestExport}`);
}

main().catch(console.error);
