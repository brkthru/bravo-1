# ETL Pipeline Detailed Documentation

## Overview

The ETL pipeline in `bravo-1/scripts/etl/` works with MongoDB data, NOT PostgreSQL directly. Here's the actual data flow:

## Data Flow Diagram

```
PostgreSQL (media_tool)
    ↓
[Previous Migration - Already Done]
    ↓
MongoDB (mediatool_v2) - Collections:
  - campaigns_backup (13,417 records)
  - lineItems
  - strategies
  - mediaBuys
  - platformEntities
  - accounts
  - teams
  - users (empty)
    ↓
[ETL Scripts]
    ↓
1. Extract (extract-data.ts)
    ↓
./data-export/ (JSON files)
    ↓
2. Transform (transform-data.ts)
    ↓
./data-transformed/ (JSON files)
    ↓
3. Load (load-data.ts)
    ↓
MongoDB (mediatool_v2) - campaigns collection
```

## Important Note

**The ETL scripts do NOT pull from PostgreSQL directly.** The data was already migrated from PostgreSQL to MongoDB at some point, and these scripts work with that MongoDB data.

## Detailed Pipeline Steps

### 1. Extract Step (`extract-data.ts`)

**Source**: MongoDB database `mediatool_v2`
**Output**: `./data-export/` directory

#### What it extracts:

```javascript
const collections = [
  'campaigns_backup', // 13,417 campaigns
  'lineItems', // Line item data
  'strategies', // Strategy data
  'mediaBuys', // Media buy data
  'platformEntities', // Platform entity data
  'accounts', // Account data
  'teams', // Team data
  'users', // User data (currently empty)
  'channels', // Channel definitions
  'tactics', // Tactic definitions
  'mediaPlatforms', // Media platform definitions
  'rateCards', // Rate card data
  'dashboardConfigs', // Dashboard configurations
  'metricDefinitions', // Metric definitions
  'platformMetrics', // Platform metrics data
];
```

#### Output files in `./data-export/`:

- `campaigns_backup.json` - Main campaign data
- `lineItems.json` - Line item data
- `strategies.json` - Strategy data
- `mediaBuys.json` - Media buy data
- `platformEntities.json` - Platform entity data (largest file)
- `extraction-summary.json` - Metadata about the extraction

### 2. Transform Step (`transform-data.ts`)

**Source**: `./data-export/` directory
**Output**: `./data-transformed/` directory

#### What it does:

1. Reads the extracted JSON files
2. Embeds strategies and line items within campaigns (denormalization)
3. Calculates budgets from line items
4. Enriches data with channel/tactic names
5. Creates a denormalized structure for performance

#### Key transformation:

```javascript
// Original structure (normalized)
campaigns_backup → strategies → lineItems

// Transformed structure (denormalized)
campaigns: {
  ...campaignData,
  strategies: [
    {
      ...strategyData,
      lineItems: [...lineItemData]
    }
  ]
}
```

#### Output files in `./data-transformed/`:

- `campaigns.json` - Denormalized campaign data with embedded strategies and line items
- `transformation-summary.json` - Summary of the transformation

### 3. Load Step (`load-data.ts`)

**Source**: `./data-transformed/` directory
**Target**: MongoDB database `mediatool_v2`, `campaigns` collection

#### What it does:

1. Reads transformed campaigns from `./data-transformed/campaigns.json`
2. Backs up current campaigns collection (if exists)
3. Clears the campaigns collection
4. Loads the transformed data
5. Creates necessary indexes

#### Backup behavior:

- Creates timestamped backup: `campaigns_backup_2025-06-21T12-00-00-000Z`
- Preserves existing data before overwriting

## PostgreSQL Connection

For the actual PostgreSQL to MongoDB migration, there's a separate script:

### Location: `bravo-1/scripts/postgres-export/`

This directory contains:

- `export-postgres-raw.ts` - Exports raw PostgreSQL data
- Output: `postgres-raw-export/` directory with JSON files

The PostgreSQL export is separate from the ETL pipeline and provides:

- Direct table exports without transformation
- Preserves all relationships
- Maintains data integrity

## Summary

1. **ETL Scripts** (`/scripts/etl/`):
   - Work with MongoDB data already migrated
   - Extract from `mediatool_v2` database
   - Transform to denormalized structure
   - Load back into MongoDB

2. **PostgreSQL Export** (`/scripts/postgres-export/`):
   - Direct export from PostgreSQL
   - Raw data without transformations
   - Used for fresh migrations

The confusion stems from the fact that the MongoDB data in `campaigns_backup` collection appears to be from a flawed previous migration (generic team data, wrong campaign numbers). For a proper migration, use the PostgreSQL export scripts instead of the ETL scripts.
