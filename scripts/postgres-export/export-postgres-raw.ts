import { Client } from 'pg';
import fs from 'fs/promises';
import path from 'path';

// PostgreSQL connection configuration
const POSTGRES_CONFIG = {
  host: process.env.PG_HOST || 'localhost',
  port: parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'media_tool',
  user: process.env.PG_USER || 'media_tool',
  password: process.env.PG_PASSWORD || 'pass',
};

const OUTPUT_DIR = './postgres-raw-export';

// Tables to export (excluding system tables)
const TABLES_TO_EXPORT = [
  'accounts',
  'campaigns',
  'changesets',
  'channels',
  'line_item_media_buys',
  'line_item_media_buys_history',
  'line_items',
  'line_items_history',
  'media_buys',
  'media_buys_history',
  'media_platform_entities',
  'media_platform_entities_history',
  'media_platform_entity_metadata',
  'media_platforms',
  'platform_buy_daily_impressions',
  'platform_buy_daily_videos',
  'rate_card',
  'rate_card_history',
  'reps',
  'reps_x_teams',
  'strategies',
  'strategies_history',
  'tactic_media_platforms',
  'tactics',
  'teams',
  'unit_price_types',
  'users'
];

async function exportTable(client: Client, tableName: string): Promise<{ count: number; filename: string; size: number }> {
  console.log(`\nExporting ${tableName}...`);
  
  try {
    // Get total count
    const countResult = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
    const totalCount = parseInt(countResult.rows[0].count);
    console.log(`  Total records: ${totalCount}`);
    
    if (totalCount === 0) {
      console.log(`  Skipping empty table`);
      return { count: 0, filename: '', size: 0 };
    }
    
    // Export data in batches to handle large tables
    const batchSize = 10000;
    let offset = 0;
    const allData: any[] = [];
    
    while (offset < totalCount) {
      const query = `SELECT * FROM ${tableName} ORDER BY 1 LIMIT $1 OFFSET $2`;
      const result = await client.query(query, [batchSize, offset]);
      
      allData.push(...result.rows);
      
      const progress = Math.min(100, Math.round((offset + result.rows.length) / totalCount * 100));
      console.log(`  Progress: ${progress}% (${offset + result.rows.length}/${totalCount})`);
      
      offset += batchSize;
    }
    
    // Write to file
    const filename = `${tableName}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);
    const jsonData = JSON.stringify(allData, null, 2);
    await fs.writeFile(filepath, jsonData);
    
    const stats = await fs.stat(filepath);
    const size = stats.size;
    console.log(`  Exported to: ${filename} (${(size / 1024 / 1024).toFixed(2)} MB)`);
    
    return { count: allData.length, filename, size };
  } catch (error) {
    console.error(`  Error exporting ${tableName}:`, error);
    return { count: 0, filename: '', size: 0 };
  }
}

async function main() {
  const client = new Client(POSTGRES_CONFIG);
  
  try {
    // Connect to PostgreSQL
    await client.connect();
    console.log('Connected to PostgreSQL');
    console.log(`Database: ${POSTGRES_CONFIG.database}`);
    console.log(`Host: ${POSTGRES_CONFIG.host}:${POSTGRES_CONFIG.port}`);
    
    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log(`\nOutput directory: ${OUTPUT_DIR}`);
    
    // Export summary
    const exportSummary: any = {
      exportedAt: new Date().toISOString(),
      database: POSTGRES_CONFIG.database,
      host: `${POSTGRES_CONFIG.host}:${POSTGRES_CONFIG.port}`,
      tables: {}
    };
    
    // Export each table
    for (const tableName of TABLES_TO_EXPORT) {
      const result = await exportTable(client, tableName);
      if (result.count > 0) {
        exportSummary.tables[tableName] = result;
      }
    }
    
    // Write export summary
    const summaryPath = path.join(OUTPUT_DIR, 'export-summary.json');
    await fs.writeFile(summaryPath, JSON.stringify(exportSummary, null, 2));
    
    // Calculate totals
    const totalRecords = Object.values(exportSummary.tables)
      .reduce((sum: number, table: any) => sum + table.count, 0);
    const totalSize = Object.values(exportSummary.tables)
      .reduce((sum: number, table: any) => sum + table.size, 0);
    
    console.log('\n========================================');
    console.log('Export completed successfully!');
    console.log(`Total tables: ${Object.keys(exportSummary.tables).length}`);
    console.log(`Total records: ${totalRecords.toLocaleString()}`);
    console.log(`Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log('========================================\n');
    
  } catch (error) {
    console.error('Export failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run the export
if (require.main === module) {
  main().catch(console.error);
}