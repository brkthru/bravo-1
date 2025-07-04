# Bravo-1 Scripts Directory

This directory contains all scripts for data migration, ETL, and pipeline operations.

## Directory Structure

```
scripts/
├── etl/                     # ETL scripts for MongoDB and PostgreSQL data
│   ├── extract-data.ts      # Extract data from MongoDB
│   ├── transform-data.ts    # Transform MongoDB structure
│   ├── transform-postgres-data.ts  # Transform PostgreSQL to MongoDB structure
│   ├── load-data.ts         # Load data into MongoDB
│   └── run-etl.ts          # Main ETL runner
│
├── postgres-export/         # PostgreSQL export utilities
│   └── export-postgres-raw.ts  # Export PostgreSQL tables to JSON
│
├── production-pipeline/     # Production-ready timestamped pipeline
│   ├── production-export-pipeline.sh       # Full production pipeline with S3
│   ├── production-export-pipeline-local.sh # Local testing version
│   ├── test-transform-load.sh              # Test transformation script
│   ├── compare-exports.sh                  # Compare different export versions
│   ├── restore-from-backup.sh              # Restore specific backup version
│   └── config/                             # Pipeline configuration
│
└── archive/                 # Old migration scripts (kept for reference)
```

## Quick Start

### 1. Export from PostgreSQL

```bash
cd production-pipeline
./production-export-pipeline-local.sh
```

This creates timestamped exports in `/exports/raw/YYYYMMDD-HHMMSS/`

### 2. Transform Data

The pipeline automatically transforms data and stores it in `/exports/transformed/YYYYMMDD-HHMMSS/`

### 3. Load into MongoDB

The pipeline automatically loads transformed data into MongoDB

## Data Flow

```
PostgreSQL → Export (JSON) → Transform → Load → MongoDB
           ↓                ↓                  ↓
    exports/raw/      exports/transformed/   mediatool_v2
```

## Key Scripts

### Production Pipeline (`production-pipeline/`)

- **production-export-pipeline.sh**: Full pipeline with AWS S3 backup
- **production-export-pipeline-local.sh**: Local version without S3
- **compare-exports.sh**: Compare different export versions
- **restore-from-backup.sh**: Restore a specific timestamped backup

### ETL Scripts (`etl/`)

- **run-etl.ts**: Main ETL runner (use with `bun run`)
- **transform-postgres-data.ts**: Transforms PostgreSQL structure to MongoDB

### PostgreSQL Export (`postgres-export/`)

- **export-postgres-raw.ts**: Exports all PostgreSQL tables to JSON

## Timestamps

All timestamps are in UTC format (YYYYMMDD-HHMMSS) to ensure consistency across timezones.

## Data Storage

- **Raw exports**: `/exports/raw/{timestamp}/`
- **Transformed data**: `/exports/transformed/{timestamp}/`
- **MongoDB backups**: `/data/mongodb-backups/{timestamp}/`

## Environment Variables

Create `production-pipeline/config/pipeline.env`:

```bash
# PostgreSQL Configuration
PROD_PG_HOST=localhost
PROD_PG_PORT=5432
PROD_PG_DB=media_tool
PROD_PG_USER=media_tool
PROD_PG_PASSWORD=pass

# AWS Configuration (for S3 uploads)
AWS_PROFILE=default
AWS_REGION=us-east-1
S3_BUCKET=media-tool-backups
```

## For New Users

See [Download and Setup Guide](production-pipeline/SETUP-NEW-USER.md) for instructions on:

- Downloading data from S3
- Setting up local environment
- Loading data into MongoDB
