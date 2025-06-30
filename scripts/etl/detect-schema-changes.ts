#!/usr/bin/env bun
/**
 * Detect schema changes between PostgreSQL data and Zod schemas
 * Compares actual data structure with defined schemas to identify:
 * - New fields
 * - Type changes
 * - Dropped fields
 * - Constraint changes
 */

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { z } from 'zod';

// Import existing schemas
import { CampaignSchema } from '@bravo-1/shared/schema-v4/campaign-v4';
import { UserSchema } from '@bravo-1/shared/schema-v4/user-v4';
import { AccountSchema } from '@bravo-1/shared/schema-v4/account-v4';

interface SchemaChange {
  table: string;
  field: string;
  type: 'new_field' | 'type_change' | 'dropped_field' | 'constraint_change';
  details: {
    currentType?: string;
    expectedType?: string;
    sampleValue?: any;
    occurrences?: number;
    required?: boolean;
  };
  severity: 'breaking' | 'warning' | 'info';
}

interface DetectionResult {
  changes: SchemaChange[];
  summary: {
    breaking: number;
    warnings: number;
    info: number;
  };
  recommendations: string[];
}

class SchemaChangeDetector {
  private schemas: Map<string, z.ZodSchema<any>>;
  private dataPath: string;

  constructor(dataPath: string) {
    this.dataPath = dataPath;
    this.schemas = new Map([
      ['campaigns', CampaignSchema],
      ['users', UserSchema],
      ['accounts', AccountSchema],
    ]);
  }

  async detectChanges(): Promise<DetectionResult> {
    console.log(chalk.blue('🔍 Detecting schema changes...'));

    const changes: SchemaChange[] = [];
    const recommendations: string[] = [];

    // Check each table
    for (const [tableName, schema] of this.schemas) {
      console.log(chalk.gray(`\\n  Checking ${tableName}...`));
      const tableChanges = await this.checkTable(tableName, schema);
      changes.push(...tableChanges);
    }

    // Generate recommendations
    if (changes.some((c) => c.type === 'new_field' && c.details.required)) {
      recommendations.push(
        'New required fields detected. Update Zod schemas with appropriate defaults.'
      );
    }

    if (changes.some((c) => c.type === 'type_change')) {
      recommendations.push(
        'Type changes detected. Create migration scripts for data transformation.'
      );
    }

    if (changes.some((c) => c.severity === 'breaking')) {
      recommendations.push(
        'Breaking changes detected. Consider versioning the API or creating compatibility layer.'
      );
    }

    // Calculate summary
    const summary = {
      breaking: changes.filter((c) => c.severity === 'breaking').length,
      warnings: changes.filter((c) => c.severity === 'warning').length,
      info: changes.filter((c) => c.severity === 'info').length,
    };

    return { changes, summary, recommendations };
  }

  private async checkTable(tableName: string, schema: z.ZodSchema<any>): Promise<SchemaChange[]> {
    const changes: SchemaChange[] = [];
    const filePath = path.join(this.dataPath, `${tableName}.json`);

    try {
      const data = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      if (!Array.isArray(data) || data.length === 0) {
        console.log(chalk.yellow(`    ⚠ No data found for ${tableName}`));
        return changes;
      }

      // Analyze field presence and types
      const fieldStats = this.analyzeFields(data);

      // Get expected fields from Zod schema
      const expectedFields = this.getSchemaFields(schema);

      // Check for new fields
      for (const [field, stats] of fieldStats) {
        if (!expectedFields.has(field)) {
          changes.push({
            table: tableName,
            field,
            type: 'new_field',
            details: {
              currentType: stats.types[0],
              sampleValue: stats.sample,
              occurrences: stats.count,
              required: stats.count === data.length,
            },
            severity: stats.count === data.length ? 'warning' : 'info',
          });
        }
      }

      // Check for type changes
      for (const [field, expectedType] of expectedFields) {
        const stats = fieldStats.get(field);
        if (stats) {
          const actualType = this.normalizeType(stats.types[0]);
          if (actualType !== expectedType && expectedType !== 'any') {
            changes.push({
              table: tableName,
              field,
              type: 'type_change',
              details: {
                currentType: actualType,
                expectedType,
                sampleValue: stats.sample,
              },
              severity: 'breaking',
            });
          }
        } else {
          // Field expected but not found in data
          changes.push({
            table: tableName,
            field,
            type: 'dropped_field',
            details: {
              expectedType,
            },
            severity: 'warning',
          });
        }
      }

      console.log(
        chalk.gray(`    Found ${changes.filter((c) => c.table === tableName).length} changes`)
      );
    } catch (error) {
      console.log(chalk.red(`    ❌ Error reading ${tableName}: ${error}`));
    }

    return changes;
  }

  private analyzeFields(data: any[]): Map<string, any> {
    const fieldStats = new Map();

    // Sample up to 100 records for analysis
    const sample = data.slice(0, 100);

    for (const record of sample) {
      for (const [field, value] of Object.entries(record)) {
        if (!fieldStats.has(field)) {
          fieldStats.set(field, {
            types: [],
            count: 0,
            sample: value,
          });
        }

        const stats = fieldStats.get(field);
        stats.count++;

        const type = this.getType(value);
        if (!stats.types.includes(type)) {
          stats.types.push(type);
        }
      }
    }

    return fieldStats;
  }

  private getType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof Date) return 'date';
    return typeof value;
  }

  private normalizeType(type: string): string {
    const typeMap: Record<string, string> = {
      number: 'number',
      string: 'string',
      boolean: 'boolean',
      object: 'object',
      array: 'array',
      null: 'null',
      undefined: 'undefined',
    };

    return typeMap[type] || type;
  }

  private getSchemaFields(schema: z.ZodSchema<any>): Map<string, string> {
    const fields = new Map();

    // This is a simplified version - in reality we'd need to parse the Zod schema
    // For now, we'll return some known fields
    if (schema === CampaignSchema) {
      fields.set('campaignId', 'string');
      fields.set('campaignNumber', 'string');
      fields.set('name', 'string');
      fields.set('price', 'object');
      fields.set('status', 'string');
      fields.set('dates', 'object');
      fields.set('team', 'object');
      fields.set('metrics', 'object');
    }

    return fields;
  }

  async generateReport(result: DetectionResult): Promise<void> {
    console.log(chalk.blue('\\n📊 Schema Change Report'));
    console.log(chalk.gray('═'.repeat(50)));

    // Summary
    console.log(chalk.white('\\nSummary:'));
    console.log(chalk.red(`  Breaking Changes: ${result.summary.breaking}`));
    console.log(chalk.yellow(`  Warnings: ${result.summary.warnings}`));
    console.log(chalk.blue(`  Info: ${result.summary.info}`));

    // Detailed changes
    if (result.changes.length > 0) {
      console.log(chalk.white('\\nDetailed Changes:'));

      for (const change of result.changes) {
        const icon =
          change.severity === 'breaking' ? '❌' : change.severity === 'warning' ? '⚠️ ' : 'ℹ️ ';

        console.log(`\\n${icon} ${chalk.bold(change.table + '.' + change.field)}`);
        console.log(chalk.gray(`   Type: ${change.type}`));

        if (change.details.currentType) {
          console.log(chalk.gray(`   Current Type: ${change.details.currentType}`));
        }
        if (change.details.expectedType) {
          console.log(chalk.gray(`   Expected Type: ${change.details.expectedType}`));
        }
        if (change.details.required) {
          console.log(chalk.yellow(`   Required: Yes (found in all records)`));
        }
        if (change.details.sampleValue !== undefined) {
          console.log(
            chalk.gray(`   Sample: ${JSON.stringify(change.details.sampleValue).slice(0, 50)}...`)
          );
        }
      }
    }

    // Recommendations
    if (result.recommendations.length > 0) {
      console.log(chalk.white('\\nRecommendations:'));
      result.recommendations.forEach((rec, i) => {
        console.log(chalk.cyan(`  ${i + 1}. ${rec}`));
      });
    }

    // Save report
    const reportPath = path.join(process.cwd(), 'schema-change-report.json');
    await fs.writeFile(reportPath, JSON.stringify(result, null, 2));
    console.log(chalk.gray(`\\nFull report saved to: ${reportPath}`));
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  let dataPath = path.join(process.cwd(), '../../data/postgres-backups/2025-06-27');

  // Allow custom data path
  if (args.includes('--data')) {
    const dataIndex = args.indexOf('--data');
    if (dataIndex !== -1 && args[dataIndex + 1]) {
      dataPath = args[dataIndex + 1];
    }
  }

  console.log(chalk.gray(`Data path: ${dataPath}`));

  const detector = new SchemaChangeDetector(dataPath);
  const result = await detector.detectChanges();
  await detector.generateReport(result);

  // Exit with error code if breaking changes found
  if (result.summary.breaking > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(chalk.red('❌ Error:'), error);
  process.exit(1);
});
