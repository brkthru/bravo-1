# Bravo-1 ETL Pipeline

This directory contains the unified ETL (Extract, Transform, Load) pipeline for migrating data from PostgreSQL to MongoDB.

## 🚀 Quick Start

```bash
# Run complete ETL with latest export
bun etl-pipeline.ts --clean --verify

# Interactive mode (recommended for first-time users)
./quick-start-etl.sh
```

## 📋 Main Scripts

### `etl-pipeline.ts` - Unified ETL Pipeline

The **SINGLE** source of truth for all ETL operations. Handles extract, transform, and load for all PostgreSQL → MongoDB migrations.

```bash
# Full ETL with clean start
bun etl-pipeline.ts --clean --verify

# ETL without cleaning existing data
bun etl-pipeline.ts --verify

# Use specific export date
bun etl-pipeline.ts --export=20250628 --verify
```

### `quick-start-etl.sh` - Interactive ETL Runner

User-friendly interface for running ETL operations with prompts and validations.

## 📊 Data Flow

1. **Clean** (optional): Drop existing MongoDB databases
2. **Extract**: Use PostgreSQL export from `exports/raw/YYYYMMDD-HHMMSS/`
3. **Transform**: Convert to MongoDB schema with:
   - ObjectId generation
   - Media trader aggregation from line items
   - Field name conversions (snake_case → camelCase)
   - Status mappings and calculations
4. **Load**: Batch insert into MongoDB collections
5. **Verify** (optional): Validate data integrity

## 🗄️ Collections Loaded

### Core Collections

- **accounts**: 9,861 documents - Customer accounts
- **campaigns**: 13,498 documents - Media campaigns (with aggregated media traders)
- **strategies**: 13,498 documents - Campaign strategies
- **lineItems**: 4,251 documents - Line items with media trader assignments

### Media Planning

- **lineItemMediaBuys**: 5,802 documents - Planned media buys
- **mediaBuys**: 56,339 documents - Actual media buy records
- **mediaPlatformEntities**: 143,313 documents - Platform-specific entities

### Reference Data

- **zohoUsers**: 327 documents - User data from Zoho CRM
- **mediaPlatforms**: 24 documents - Platform definitions (Facebook, Google DV360, etc.)
- **channels**: 7 documents - Media channels
- **tactics**: 36 documents - Media tactics
- **teams**: 88 documents - Team structures

**Total**: ~247,000 documents

### Performance Metrics (when available in export)

- **platformBuyDailyImpressions**: Daily impression metrics by platform
- **platformBuyDailyVideos**: Daily video metrics by platform

### Additional Collections (separate scripts)

- **bravoUsers**: Application users with enhanced features (run `setup-bravo-users.ts`)

## 🔧 Configuration

The pipeline automatically:

- Detects latest export or uses specified date
- Connects to MongoDB at `mongodb://localhost:27017/bravo-1`
- Handles media trader aggregation from line items to campaigns
- Ensures consistent ObjectId formatting

## 🏗️ Architecture Principles

1. **Single Pipeline**: One script (`etl-pipeline.ts`) handles all ETL operations
2. **Idempotent**: Can be run multiple times safely
3. **Configurable**: Command-line options for different scenarios
4. **Verifiable**: Built-in data verification
5. **Fast**: Batch processing, completes in ~30 seconds

## 📝 Common Tasks

### Fresh Start (Development)

```bash
bun etl-pipeline.ts --clean --verify
```

### Update Existing Data

```bash
bun etl-pipeline.ts --verify
```

### Use Specific Export

```bash
bun etl-pipeline.ts --export=20250628 --verify
```

### Interactive Mode

```bash
./quick-start-etl.sh
```

## 🔄 Field Mappings

| PostgreSQL Field             | MongoDB Field         | Notes                      |
| ---------------------------- | --------------------- | -------------------------- |
| `id`                         | `campaignId`          | Original ID preserved      |
| `_id`                        | ObjectId              | New MongoDB ObjectId       |
| `campaign_number`            | `campaignNumber`      | e.g., "CN-20"              |
| `campaign_name`              | `name`                |                            |
| `budget`                     | `price.targetAmount`  | New structure              |
| `stage`                      | `status`              | Mapped to L1/L2/L3         |
| `lead_account_owner_user_id` | `team.accountManager` | User object                |
| `media_trader_user_ids`      | `team.mediaTraders`   | Aggregated from line items |

## 🚨 Important Notes

1. **Media Traders**: Aggregated from line items, not stored at campaign level in PostgreSQL
2. **ObjectIds**: All `_id` fields use proper MongoDB ObjectId format
3. **Backups**: Previous data is backed up before loading new data
4. **Idempotent**: Safe to run multiple times - clears collections before loading

## 🗂️ Archived Scripts

Older ETL scripts have been archived to `archive/` directory. The unified pipeline replaces:

- Multiple transform scripts (`transform-postgres-data.ts`, `transform-postgres-with-traders.ts`, etc.)
- Separate load scripts (`load-data.ts`, `load-campaigns-with-traders.ts`, etc.)
- Various test and migration utilities

Use `etl-pipeline.ts` for all ETL operations going forward.

## 🔍 Troubleshooting

### MongoDB Connection Failed

```bash
# Check MongoDB is running
docker ps | grep mongo
# or
mongosh bravo-1 --eval "db.campaigns.countDocuments()"
```

### Export Not Found

```bash
# List available exports
ls -la ../../exports/raw/
```

### Out of Memory

The pipeline processes large collections in batches (1000 documents). If you encounter memory issues, the batch size can be adjusted in `etl-pipeline.ts`.

## 📚 Related Documentation

- [`/docs/ETL-PRODUCTION-WORKFLOW.md`](../../docs/ETL-PRODUCTION-WORKFLOW.md) - Production ETL guide
- [`/docs/ETL-DIAGRAM.md`](../../docs/ETL-DIAGRAM.md) - Visual ETL flow
- [`ETL-SUMMARY.md`](./ETL-SUMMARY.md) - Latest ETL run summary
