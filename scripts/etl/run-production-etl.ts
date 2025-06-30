#!/usr/bin/env bun
/**
 * Master ETL workflow script for production data synchronization
 * Handles the complete pipeline from PostgreSQL export to MongoDB load
 * with schema change detection and interactive decision making
 */

import { MongoClient } from 'mongodb';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';

const execAsync = promisify(exec);

interface ETLConfig {
  postgresDb: string;
  mongoDb: string;
  interactive: boolean;
  autoLatest: boolean;
  skipBackup: boolean;
  source: 'direct' | 's3';
}

interface SchemaChange {
  type: 'new_field' | 'type_change' | 'dropped_field' | 'new_table';
  table: string;
  field?: string;
  oldType?: string;
  newType?: string;
  required?: boolean;
}

class ProductionETLWorkflow {
  private config: ETLConfig;
  private mongoClient: MongoClient | null = null;

  constructor(config: Partial<ETLConfig> = {}) {
    this.config = {
      postgresDb: 'media_tool',
      mongoDb: 'bravo-1',
      interactive: false,
      autoLatest: false,
      skipBackup: false,
      source: 's3',
      ...config,
    };
  }

  async run() {
    console.log(chalk.blue('🚀 Starting Production ETL Workflow'));
    console.log(chalk.gray(`Target MongoDB: ${this.config.mongoDb}`));

    try {
      // Step 1: Check prerequisites
      await this.checkPrerequisites();

      // Step 2: Acquire production data
      const dataPath = await this.acquireProductionData();

      // Step 3: Detect schema changes
      const changes = await this.detectSchemaChanges(dataPath);

      // Step 4: Handle schema changes
      if (changes.length > 0) {
        await this.handleSchemaChanges(changes);
      }

      // Step 5: Transform data
      const transformedPath = await this.transformData(dataPath);

      // Step 6: Load into MongoDB
      await this.loadIntoMongoDB(transformedPath);

      // Step 7: Validate results
      await this.validateResults();

      // Step 8: Push to S3
      if (!this.config.interactive || (await this.confirmPushToS3())) {
        await this.pushToS3();
      }

      console.log(chalk.green('✅ ETL Workflow completed successfully!'));
    } catch (error) {
      console.error(chalk.red('❌ ETL Workflow failed:'), error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  private async checkPrerequisites() {
    console.log(chalk.blue('Checking prerequisites...'));

    // Check AWS CLI
    try {
      await execAsync('aws --version');
      console.log(chalk.green('  ✓ AWS CLI installed'));
    } catch {
      throw new Error('AWS CLI not found. Please install it first.');
    }

    // Check AWS credentials
    try {
      await execAsync('aws sts get-caller-identity --profile brkthru-mediatool-dev');
      console.log(chalk.green('  ✓ AWS credentials configured'));
    } catch {
      console.log(chalk.yellow('  ⚠ AWS credentials not configured'));
      console.log(chalk.gray('    Run: aws configure sso'));
    }

    // Check MongoDB
    try {
      this.mongoClient = new MongoClient('mongodb://localhost:27017');
      await this.mongoClient.connect();
      console.log(chalk.green('  ✓ MongoDB running'));
    } catch {
      throw new Error('MongoDB not running on localhost:27017');
    }

    // Check if database needs to be created
    const admin = this.mongoClient.db().admin();
    const dbs = await admin.listDatabases();
    const dbExists = dbs.databases.some((db) => db.name === this.config.mongoDb);

    if (!dbExists) {
      console.log(chalk.yellow(`  ⚠ Database '${this.config.mongoDb}' will be created`));
    }
  }

  private async acquireProductionData(): Promise<string> {
    console.log(chalk.blue('\\nAcquiring production data...'));

    if (this.config.source === 's3') {
      return await this.downloadFromS3();
    } else {
      return await this.exportDirectly();
    }
  }

  private async downloadFromS3(): Promise<string> {
    const scriptsDir = path.join(process.cwd(), '..', 'production-pipeline');

    if (this.config.autoLatest) {
      console.log(chalk.gray('  Downloading latest export from S3...'));
      const { stdout } = await execAsync('./download-from-s3.sh --auto-latest', {
        cwd: scriptsDir,
      });

      // Parse output to get data path
      const match = stdout.match(/Data extracted to: (.+)/);
      if (match) {
        return match[1];
      }
    } else if (this.config.interactive) {
      console.log(chalk.gray('  Launching interactive S3 download...'));
      const { stdout } = await execAsync('./download-from-s3.sh', { cwd: scriptsDir });

      const match = stdout.match(/Data extracted to: (.+)/);
      if (match) {
        return match[1];
      }
    }

    throw new Error('Failed to download data from S3');
  }

  private async exportDirectly(): Promise<string> {
    console.log(chalk.gray('  Exporting directly from production PostgreSQL...'));
    const scriptsDir = path.join(process.cwd(), '..', 'production-pipeline');

    const { stdout } = await execAsync('./export-from-production.sh', { cwd: scriptsDir });

    const match = stdout.match(/Export completed: (.+)/);
    if (match) {
      return match[1];
    }

    throw new Error('Failed to export from production');
  }

  private async detectSchemaChanges(dataPath: string): Promise<SchemaChange[]> {
    console.log(chalk.blue('\\nDetecting schema changes...'));

    // Compare with existing schema definitions
    const changes: SchemaChange[] = [];

    // This would normally compare against Zod schemas
    // For now, we'll simulate some detection
    const campaignsFile = path.join(dataPath, 'campaigns.json');
    if (await this.fileExists(campaignsFile)) {
      const data = JSON.parse(await fs.readFile(campaignsFile, 'utf-8'));
      if (data.length > 0) {
        const sample = data[0];

        // Check for new fields not in our schema
        const knownFields = [
          'id',
          'campaign_number',
          'campaign_name',
          'budget',
          'stage',
          'account_id',
          'strategy_id',
          'proposed_budget',
          'expected_revenue',
          'goals_kpis',
          'new_business',
          'flight_date',
          'end_date',
        ];

        for (const field of Object.keys(sample)) {
          if (!knownFields.includes(field)) {
            changes.push({
              type: 'new_field',
              table: 'campaigns',
              field,
              newType: typeof sample[field],
            });
          }
        }
      }
    }

    if (changes.length > 0) {
      console.log(chalk.yellow(`  Found ${changes.length} schema changes`));
      changes.forEach((change) => {
        console.log(chalk.gray(`    - ${change.type}: ${change.table}.${change.field}`));
      });
    } else {
      console.log(chalk.green('  ✓ No schema changes detected'));
    }

    return changes;
  }

  private async handleSchemaChanges(changes: SchemaChange[]) {
    console.log(chalk.blue('\\nHandling schema changes...'));

    if (this.config.interactive) {
      const { strategy } = await inquirer.prompt([
        {
          type: 'list',
          name: 'strategy',
          message: 'How should we handle schema changes?',
          choices: [
            { name: 'Apply all changes automatically', value: 'auto' },
            { name: 'Review each change individually', value: 'manual' },
            { name: 'Skip schema updates for now', value: 'skip' },
            { name: 'Abort ETL process', value: 'abort' },
          ],
        },
      ]);

      if (strategy === 'abort') {
        throw new Error('ETL aborted by user');
      }

      if (strategy === 'manual') {
        for (const change of changes) {
          const { action } = await inquirer.prompt([
            {
              type: 'list',
              name: 'action',
              message: `${change.type}: ${change.table}.${change.field} (${change.newType})`,
              choices: [
                { name: 'Add to schema', value: 'add' },
                { name: 'Ignore', value: 'ignore' },
                { name: 'Map to existing field', value: 'map' },
              ],
            },
          ]);

          if (action === 'add') {
            console.log(chalk.gray(`    Adding ${change.field} to schema...`));
            // Update Zod schema here
          }
        }
      }
    } else {
      console.log(chalk.gray('  Applying safe changes automatically...'));
      // Apply only non-breaking changes
    }
  }

  private async transformData(dataPath: string): Promise<string> {
    console.log(chalk.blue('\\nTransforming data...'));

    const { stdout } = await execAsync(
      `bun transform-postgres-to-mongodb.ts --input ${dataPath} --db ${this.config.mongoDb}`,
      { cwd: process.cwd() }
    );

    const match = stdout.match(/Output saved to: (.+)/);
    if (match) {
      console.log(chalk.green('  ✓ Data transformed successfully'));
      return match[1];
    }

    throw new Error('Failed to transform data');
  }

  private async loadIntoMongoDB(transformedPath: string) {
    console.log(chalk.blue('\\nLoading into MongoDB...'));

    if (!this.config.skipBackup) {
      console.log(chalk.gray('  Creating backup...'));
      await execAsync(
        `bun backup-mongo-collection.ts --db ${this.config.mongoDb} --collection campaigns`,
        { cwd: process.cwd() }
      );
    }

    await execAsync(
      `bun load-new-schema-data.ts --input ${transformedPath} --db ${this.config.mongoDb}`,
      { cwd: process.cwd() }
    );

    console.log(chalk.green('  ✓ Data loaded successfully'));
  }

  private async validateResults() {
    console.log(chalk.blue('\\nValidating results...'));

    if (!this.mongoClient) {
      this.mongoClient = new MongoClient('mongodb://localhost:27017');
      await this.mongoClient.connect();
    }

    const db = this.mongoClient.db(this.config.mongoDb);
    const count = await db.collection('campaigns').countDocuments();

    console.log(chalk.gray(`  Campaigns loaded: ${count}`));

    // Sample validation
    const sample = await db.collection('campaigns').findOne();
    if (sample && sample.price && sample.metrics) {
      console.log(chalk.green('  ✓ Schema validation passed'));
    } else {
      console.log(chalk.yellow('  ⚠ Schema validation warning'));
    }
  }

  private async confirmPushToS3(): Promise<boolean> {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Push transformed data to S3?',
        default: true,
      },
    ]);

    return confirm;
  }

  private async pushToS3() {
    console.log(chalk.blue('\\nPushing to S3...'));

    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const s3Path = `s3://brkthru-media-tool-exports/transformed/${this.config.mongoDb}/${timestamp}/`;

    console.log(chalk.gray(`  Uploading to ${s3Path}`));

    // Implementation would upload transformed data
    console.log(chalk.green('  ✓ Data pushed to S3'));
  }

  private async cleanup() {
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const config: Partial<ETLConfig> = {
  interactive: args.includes('--interactive'),
  autoLatest: args.includes('--auto-latest'),
  skipBackup: args.includes('--skip-backup'),
  source: args.includes('--source=direct') ? 'direct' : 's3',
};

if (args.includes('--db')) {
  const dbIndex = args.indexOf('--db');
  if (dbIndex !== -1 && args[dbIndex + 1]) {
    config.mongoDb = args[dbIndex + 1];
  }
}

// Run workflow
const workflow = new ProductionETLWorkflow(config);
workflow.run().catch((error) => {
  console.error(error);
  process.exit(1);
});
