# Pipeline Timestamped Exports Documentation

## Overview
The production pipeline creates timestamped exports that maintain consistency across all stages of the data transformation process. Each export run is identified by a unique timestamp in the format `YYYYMMDD-HHMMSS` in UTC timezone to ensure consistency across different server locations and timezones.

## Quick Links
- [Setup Guide for New Users](../scripts/production-pipeline/SETUP-NEW-USER.md)
- [Download Script](../scripts/production-pipeline/download-from-s3.sh)
- [Pipeline Scripts](../scripts/production-pipeline/)

## Directory Structure

All timestamped exports are stored in:
```
/Users/ryan/code-repos/github/brkthru/bravo_code/bravo-1/exports/
```

### Main Export Directories

```
exports/
├── raw/                    # Raw PostgreSQL JSON exports
│   └── {timestamp}/        # e.g., 20250622-072114/
│       ├── accounts.json
│       ├── campaigns.json
│       ├── users.json
│       ├── line_items.json
│       ├── strategies.json
│       ├── export-summary.json
│       └── ... (24 total files)
│
├── transformed/            # Transformed data for MongoDB
│   └── {timestamp}/        # Same timestamp as raw
│       ├── campaigns.json  # Denormalized with embedded data
│       └── transformation-summary.json
│
├── temp/                   # Temporary files during processing
│   └── prod_dump_{timestamp}.sql
│
└── logs/                   # Pipeline execution logs
    └── pipeline_{timestamp}.log
```

## Timestamp Consistency

All timestamps are generated in UTC to prevent timezone-related issues. The same timestamp is used throughout the entire pipeline:
- PostgreSQL database: `media_tool_20250622-072114` (UTC)
- Raw export directory: `exports/raw/20250622-072114/` (UTC)
- Transformed directory: `exports/transformed/20250622-072114/` (UTC)
- MongoDB database: `mediatool_20250622-072114` (UTC, when using versioned loading)

## Finding Your Exports

### List All Exports
```bash
# Show all timestamped exports
ls -la /Users/ryan/code-repos/github/brkthru/bravo_code/bravo-1/exports/raw/

# Example output:
drwxr-xr-x@ 27 ryan staff 864 Jun 22 07:21 20250622-072114
drwxr-xr-x@ 27 ryan staff 864 Jun 22 07:21 20250622-072152
drwxr-xr-x@ 27 ryan staff 864 Jun 22 07:23 20250622-072326
```

### Find Latest Export
```bash
# Get the most recent export
ls -t exports/raw/ | head -1

# Full path to latest raw export
LATEST=$(ls -t exports/raw/ | head -1)
echo "Latest export: exports/raw/$LATEST"
```

### Check Export Contents
```bash
# View summary of an export
TIMESTAMP="20250622-072114"
cat exports/raw/$TIMESTAMP/export-summary.json | jq '.'

# Check transformation summary
cat exports/transformed/$TIMESTAMP/transformation-summary.json | jq '.'
```

## Export Contents

### Raw Export (`exports/raw/{timestamp}/`)
Contains exact PostgreSQL data in JSON format:
- **export-summary.json** - Metadata about the export
- **campaigns.json** - 13,417 campaign records
- **users.json** - 326 user records with emails
- **line_items.json** - Line item data
- **strategies.json** - Strategy records
- Plus 20+ other tables

### Transformed Export (`exports/transformed/{timestamp}/`)
Contains MongoDB-ready denormalized data:
- **campaigns.json** - Campaigns with embedded strategies, line items, and user data
- **transformation-summary.json** - Details about the transformation

## Pipeline Scripts Location

The pipeline scripts are in:
```
bravo-1/scripts/production-pipeline/
├── production-export-pipeline.sh      # Main production pipeline
├── production-export-pipeline-local.sh # Local testing version
├── restore-from-backup.sh            # Restore specific timestamp
├── compare-exports.sh                # Compare different versions
└── test-transform-load.sh            # Test transformation only
```

## Running the Pipeline

### Full Pipeline Run
```bash
cd scripts/production-pipeline
./production-export-pipeline-local.sh

# This creates:
# - Timestamp: 20250622-143000 (example)
# - exports/raw/20250622-143000/
# - exports/transformed/20250622-143000/
# - PostgreSQL DB: media_tool_20250622-143000
# - MongoDB DB: mediatool_v2 (or mediatool_20250622-143000 if versioned)
```

### Restore Specific Version
```bash
./restore-from-backup.sh --timestamp 20250622-072114 --mongodb
```

### Compare Versions
```bash
./compare-exports.sh \
  --version1 20250622-072114 \
  --version2 20250622-072326 \
  --output comparison.json
```

## Version Tracking

### MongoDB Versions File
```bash
cat exports/mongodb-versions.json
```
Shows all MongoDB databases created with their timestamps.

### Finding Associated Files
All files for a specific export run share the same timestamp:
```bash
TIMESTAMP="20250622-072114"

# Raw export
ls exports/raw/$TIMESTAMP/

# Transformed data
ls exports/transformed/$TIMESTAMP/

# Temporary SQL dump (if still exists)
ls exports/temp/prod_dump_$TIMESTAMP.sql

# Associated databases
echo "PostgreSQL: media_tool_$TIMESTAMP"
echo "MongoDB: mediatool_$TIMESTAMP"
```

## Metadata Files

### Export Summary (`export-summary.json`)
```json
{
  "exportedAt": "2025-06-22T06:21:14Z",  // UTC timestamp
  "database": "media_tool",
  "host": "localhost:5432",
  "tables": {
    "campaigns": {
      "count": 13417,
      "filename": "campaigns.json",
      "size": 11205266
    },
    // ... more tables
  }
}
```

### Transformation Summary (`transformation-summary.json`)
```json
{
  "transformedAt": "2025-06-22T06:25:00Z",  // UTC timestamp
  "source": "PostgreSQL export",
  "totalCampaigns": 13417,
  "totalStrategies": 13417,
  "totalLineItems": 4118,
  "totalUsers": 326,
  "outputFile": "campaigns.json"
}
```

## S3 Storage (When Configured)

When S3 is configured, files are uploaded with the same timestamp structure:
```
s3://media-tool-backups/
├── postgres-exports/
│   ├── raw/
│   │   └── 2025-06-22/
│   │       └── 20250622-072114-raw.tar.gz
│   ├── transformed/
│   │   └── 2025-06-22/
│   │       └── 20250622-072114-transformed.tar.gz
│   └── metadata/
│       └── 2025-06-22/
│           └── 20250622-072114.json
```

## Cleanup

Old exports can be safely deleted:
```bash
# Remove exports older than 7 days
find exports/raw -type d -name "20*" -mtime +7 -exec rm -rf {} \;
find exports/transformed -type d -name "20*" -mtime +7 -exec rm -rf {} \;

# Remove temporary files
rm -f exports/temp/*.sql
```

## Timezone Handling

All timestamps in the pipeline are generated in UTC to ensure consistency:
- Shell scripts use `date -u +%Y%m%d-%H%M%S` for UTC timestamps
- TypeScript files use `new Date().toISOString()` which is always UTC
- Log messages display timestamps with "UTC" suffix for clarity

This prevents issues when:
- Running exports from different timezones
- Comparing exports across servers
- Scheduling automated exports
- Working with international teams

## Best Practices

1. **Always use timestamps** - Never overwrite exports
2. **Keep raw and transformed together** - Same timestamp for traceability
3. **Document purpose** - Add notes to mongodb-versions.json
4. **Regular cleanup** - Delete old local exports after S3 upload
5. **Verify counts** - Check export-summary.json matches expectations
6. **Use UTC timestamps** - All timestamps should be in UTC timezone