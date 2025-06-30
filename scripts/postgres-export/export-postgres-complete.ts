#!/usr/bin/env bun
/**
 * Complete PostgreSQL Export Script
 *
 * Exports all tables including:
 * - Core media planning data
 * - Performance metrics (daily impressions, videos)
 * - Zoho sync data
 * - Historical/audit data
 */

import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';

// PostgreSQL connection configuration
const POSTGRES_CONFIG = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'media_tool',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
};

// Generate timestamp for unique export directory
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '-');
const OUTPUT_DIR = `../../exports/raw/${TIMESTAMP}`;

// Comprehensive list of tables to export
const TABLES_TO_EXPORT = [
  // Core tables
  'accounts',
  'campaigns',
  'strategies',
  'line_items',
  'line_item_media_buys',
  'media_buys',

  // Reference data
  'channels',
  'tactics',
  'media_platforms',
  'tactic_media_platforms',
  'unit_price_types',

  // Platform data
  'media_platform_entities',
  'media_platform_entity_metadata',

  // Performance metrics (IMPORTANT!)
  'platform_buy_daily_impressions',
  'platform_buy_daily_videos',

  // User/team data
  'users',
  'teams',
  'reps',
  'reps_x_teams',

  // Rate cards
  'rate_card',
  'rate_card_history',

  // Change tracking
  'changesets',

  // History tables (audit trails)
  'campaigns_history',
  'strategies_history',
  'line_items_history',
  'line_item_media_buys_history',
  'media_buys_history',
  'media_platform_entities_history',

  // Additional tables that might exist
  'zoho_sync_log',
  'zoho_campaigns',
  'zoho_accounts',
  'zoho_users',
  'campaign_metrics',
  'line_item_metrics',
  'media_buy_metrics',
];

async function tableExists(client: Client, tableName: string): Promise<boolean> {
  const result = await client.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'media_tool' 
      AND table_name = $1
    )`,
    [tableName]
  );
  return result.rows[0].exists;
}

async function exportTable(
  client: Client,
  tableName: string
): Promise<{ count: number; filename: string; size: number }> {
  console.log(`\nExporting ${tableName}...`);

  try {
    // Check if table exists
    const exists = await tableExists(client, tableName);
    if (!exists) {
      console.log(`  Table does not exist, skipping`);
      return { count: 0, filename: '', size: 0 };
    }

    // Get total count
    const countResult = await client.query(`SELECT COUNT(*) FROM media_tool.${tableName}`);
    const totalCount = parseInt(countResult.rows[0].count);
    console.log(`  Total records: ${totalCount.toLocaleString()}`);

    if (totalCount === 0) {
      console.log(`  Skipping empty table`);
      return { count: 0, filename: '', size: 0 };
    }

    // Export data in batches to handle large tables
    const batchSize = 10000;
    let offset = 0;
    const allData: any[] = [];

    while (offset < totalCount) {
      const query = `SELECT * FROM media_tool.${tableName} ORDER BY 1 LIMIT $1 OFFSET $2`;
      const result = await client.query(query, [batchSize, offset]);

      allData.push(...result.rows);

      const progress = Math.min(
        100,
        Math.round(((offset + result.rows.length) / totalCount) * 100)
      );

      // Show progress for large tables
      if (totalCount > batchSize) {
        process.stdout.write(
          `\r  Progress: ${progress}% (${(offset + result.rows.length).toLocaleString()}/${totalCount.toLocaleString()})`
        );
      }

      offset += batchSize;
    }

    if (totalCount > batchSize) {
      console.log(); // New line after progress
    }

    // Write to file
    const filename = `${tableName}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);
    const jsonData = JSON.stringify(allData, null, 2);
    await fs.writeFile(filepath, jsonData);

    const stats = await fs.stat(filepath);
    const size = stats.size;
    console.log(`  ✅ Exported to: ${filename} (${(size / 1024 / 1024).toFixed(2)} MB)`);

    return { count: allData.length, filename, size };
  } catch (error) {
    console.error(`  ❌ Error exporting ${tableName}:`, error);
    return { count: 0, filename: '', size: 0 };
  }
}

async function exportMetadata(client: Client) {
  console.log('\nExporting database metadata...');

  try {
    // Simple query to get all tables
    const tablesQuery = `
      SELECT 
        table_name
      FROM information_schema.tables
      WHERE table_schema = 'media_tool'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    const tables = await client.query(tablesQuery);

    // Get column information for each table
    const columnsQuery = `
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'media_tool'
      ORDER BY table_name, ordinal_position;
    `;

    const columns = await client.query(columnsQuery);

    // Group columns by table
    const tableColumns: Record<string, any[]> = {};
    columns.rows.forEach((col) => {
      if (!tableColumns[col.table_name]) {
        tableColumns[col.table_name] = [];
      }
      tableColumns[col.table_name].push({
        name: col.column_name,
        type: col.data_type,
        nullable: col.is_nullable === 'YES',
        default: col.column_default,
      });
    });

    // Get row counts for each table
    const tableCounts: Record<string, number> = {};
    for (const table of tables.rows) {
      try {
        const countResult = await client.query(
          `SELECT COUNT(*) FROM media_tool.${table.table_name}`
        );
        tableCounts[table.table_name] = parseInt(countResult.rows[0].count);
      } catch (e) {
        tableCounts[table.table_name] = 0;
      }
    }

    const metadata = {
      exportedAt: new Date().toISOString(),
      database: POSTGRES_CONFIG.database,
      host: `${POSTGRES_CONFIG.host}:${POSTGRES_CONFIG.port}`,
      tables: tables.rows.map((t) => ({
        name: t.table_name,
        rowCount: tableCounts[t.table_name] || 0,
        columns: tableColumns[t.table_name] || [],
      })),
    };

    const metadataPath = path.join(OUTPUT_DIR, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
    console.log('  ✅ Exported database metadata');
  } catch (error) {
    console.error('  ⚠️  Could not export metadata:', error);
    // Continue with export even if metadata fails
  }
}

async function main() {
  const client = new Client(POSTGRES_CONFIG);

  try {
    // Connect to PostgreSQL
    await client.connect();
    console.log('🚀 PostgreSQL Complete Export');
    console.log('='.repeat(60));
    console.log(`Database: ${POSTGRES_CONFIG.database}`);
    console.log(`Host: ${POSTGRES_CONFIG.host}:${POSTGRES_CONFIG.port}`);
    console.log(`Output: ${OUTPUT_DIR}`);
    console.log('='.repeat(60));

    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    // Export metadata first
    await exportMetadata(client);

    // Export summary
    const exportSummary: any = {
      exportedAt: new Date().toISOString(),
      database: POSTGRES_CONFIG.database,
      host: `${POSTGRES_CONFIG.host}:${POSTGRES_CONFIG.port}`,
      timestamp: TIMESTAMP,
      tables: {},
      performanceMetrics: {},
      missingTables: [],
    };

    // Export each table
    for (const tableName of TABLES_TO_EXPORT) {
      const result = await exportTable(client, tableName);

      if (result.count > 0) {
        exportSummary.tables[tableName] = result;

        // Track performance metrics specifically
        if (tableName.includes('daily_impressions') || tableName.includes('daily_videos')) {
          exportSummary.performanceMetrics[tableName] = result;
        }
      } else if (result.filename === '') {
        exportSummary.missingTables.push(tableName);
      }
    }

    // Write export summary
    const summaryPath = path.join(OUTPUT_DIR, 'export-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(exportSummary, null, 2));

    // Calculate totals
    const totalRecords = Object.values(exportSummary.tables).reduce(
      (sum: number, table: any) => sum + table.count,
      0
    );
    const totalSize = Object.values(exportSummary.tables).reduce(
      (sum: number, table: any) => sum + table.size,
      0
    );

    console.log('\n' + '='.repeat(60));
    console.log('📊 Export Summary');
    console.log('='.repeat(60));
    console.log(`✅ Exported tables: ${Object.keys(exportSummary.tables).length}`);
    console.log(`📈 Performance tables: ${Object.keys(exportSummary.performanceMetrics).length}`);
    console.log(`❌ Missing tables: ${exportSummary.missingTables.length}`);
    console.log(`📦 Total records: ${totalRecords.toLocaleString()}`);
    console.log(`💾 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

    if (exportSummary.performanceMetrics.platform_buy_daily_impressions) {
      console.log('\n📈 Performance Metrics:');
      const impressions = exportSummary.performanceMetrics.platform_buy_daily_impressions;
      console.log(`  Daily impressions: ${impressions.count.toLocaleString()} records`);
    }

    if (exportSummary.performanceMetrics.platform_buy_daily_videos) {
      const videos = exportSummary.performanceMetrics.platform_buy_daily_videos;
      console.log(`  Daily videos: ${videos.count.toLocaleString()} records`);
    }

    console.log('\n✅ Export completed successfully!');
    console.log(`📁 Data exported to: ${OUTPUT_DIR}`);
    console.log('='.repeat(60));
  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the export
if (import.meta.main) {
  main().catch(console.error);
}
