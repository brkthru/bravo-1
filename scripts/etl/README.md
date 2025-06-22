# MongoDB ETL Process

This directory contains scripts for extracting, transforming, and loading MongoDB data. 

**IMPORTANT**: These scripts work with data already in MongoDB (`mediatool_v2` database). They do NOT pull from PostgreSQL. For PostgreSQL exports, see `/scripts/postgres-export/`.

This process is useful for:
- Transforming MongoDB data from normalized to denormalized structure
- Creating embedded document structures for performance
- Testing different MongoDB schema designs
- Backing up and restoring MongoDB data

## Prerequisites

- MongoDB running locally on port 27017
- Database name: `mediatool_v2`
- Bun runtime installed

## Data Flow

```
MongoDB (mediatool_v2) → Extract → ./data-export/ → Transform → ./data-transformed/ → Load → MongoDB (mediatool_v2)
```

## ETL Scripts

### 1. Extract (`extract-data.ts`)
**Source**: MongoDB database `mediatool_v2`  
**Output**: JSON files in `./data-export/`

Extracts data from MongoDB collections:
- `campaigns_backup` - 13,417 campaigns (from previous migration)
- `lineItems` - Line item data
- `strategies` - Strategy data
- `mediaBuys` - Media buy data
- `platformEntities` - Platform entity data (largest: 695MB)
- And more...

### 2. Transform (`transform-data.ts`)
**Source**: JSON files in `./data-export/`  
**Output**: JSON files in `./data-transformed/`

Transforms the extracted data to denormalized MongoDB structure:
- Embeds strategies and line items within campaigns
- Calculates budgets from line items
- Enriches data with channel/tactic names
- Creates the denormalized structure for performance

Creates: `campaigns.json` with embedded documents

### 3. Load (`load-data.ts`)
**Source**: JSON files in `./data-transformed/`  
**Target**: MongoDB `mediatool_v2` database, `campaigns` collection

Loads the transformed data back into MongoDB:
- Backs up current campaigns collection (timestamped)
- Clears existing campaigns collection
- Loads transformed denormalized data
- Creates necessary indexes

## Usage

### Run Complete ETL Process
```bash
bun run scripts/etl/run-etl.ts
```

### Run Individual Steps
```bash
# Extract only
bun run scripts/etl/run-etl.ts extract

# Transform only
bun run scripts/etl/run-etl.ts transform

# Load only
bun run scripts/etl/run-etl.ts load
```

### Direct Script Execution
```bash
# Extract data
bun scripts/etl/extract-data.ts

# Transform data
bun scripts/etl/transform-data.ts

# Load data
bun scripts/etl/load-data.ts
```

## Output Structure

### After Extract
```
./data-export/
├── campaigns_backup.json      # Main campaign data
├── lineItems.json            # Line item data
├── strategies.json           # Strategy data
├── extraction-summary.json   # Summary of extraction
└── ... (other collections)
```

### After Transform
```
./data-transformed/
├── campaigns.json              # Transformed campaign data
└── transformation-summary.json # Summary of transformation
```

## Data Storage Options

### Option 1: Check into Git (for demo/test data)
If the data is small and non-sensitive:
```bash
# Add to git
git add data-export/
git add data-transformed/
git commit -m "Add demo data export"
```

### Option 2: Secure External Storage
For production data:
1. Compress the data:
   ```bash
   tar -czf mongodb-backup-$(date +%Y%m%d).tar.gz data-export/
   ```

2. Store in secure location:
   - AWS S3 with encryption
   - Google Cloud Storage
   - Secure file server

3. Create import script:
   ```bash
   # Download and extract
   curl -O https://secure-storage/mongodb-backup.tar.gz
   tar -xzf mongodb-backup.tar.gz
   
   # Run transform and load
   bun run scripts/etl/run-etl.ts transform
   bun run scripts/etl/run-etl.ts load
   ```

## Important Distinction: MongoDB ETL vs PostgreSQL Export

### This ETL Pipeline:
- Works with data ALREADY in MongoDB
- Located in: `/scripts/etl/`
- Source: MongoDB `mediatool_v2` database
- Purpose: Transform MongoDB data structure (normalize → denormalize)

### PostgreSQL Export:
- Exports directly from PostgreSQL database
- Located in: `/scripts/postgres-export/`
- Source: PostgreSQL `media_tool` database
- Purpose: Create fresh backup from original PostgreSQL data

## Restoring from Backup

To restore data from a backup:

1. Place the backup files in `./data-export/`
2. Run transform: `bun run scripts/etl/run-etl.ts transform`
3. Run load: `bun run scripts/etl/run-etl.ts load`

## Safety Features

- Current campaigns are automatically backed up before loading new data
- Backup collections are named with timestamps
- All operations are logged with summaries
- Indexes are automatically created after loading

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running: `mongod`
- Check connection string in scripts
- Verify database name is `mediatool_v2`

### Missing Data Files
- Run extract first: `bun run scripts/etl/run-etl.ts extract`
- Check file paths in `data-export/` and `data-transformed/`

### Memory Issues with Large Collections
- The scripts handle large collections in batches
- Adjust `batchSize` in scripts if needed

## Notes

- The ETL process preserves all original data
- Transformation is idempotent (can be run multiple times)
- Always backup before loading new data