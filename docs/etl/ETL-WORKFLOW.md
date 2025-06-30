# ETL Workflow Documentation

## Overview

The bravo-1 project has two main ETL pipelines:

1. **PostgreSQL → MongoDB Pipeline** (Primary) - Transforms raw PostgreSQL data to MongoDB format
2. **MongoDB → MongoDB Pipeline** (Secondary) - Transforms existing MongoDB data to new schema

## Data Sources

All data is stored in the `/data` directory:

```
data/
├── postgres-backups/2025-06-27/    # ✅ CANONICAL SOURCE - PostgreSQL raw export
├── mongodb-exports/                # MongoDB exports (already transformed, missing fields)
│   ├── 2025-06-18/
│   └── 2025-06-22/
└── transformed/                    # ETL output
    ├── 2025-06-27-postgres/       # From PostgreSQL
    └── 2025-06-18-mongodb/        # From MongoDB
```

## Primary Pipeline: PostgreSQL → MongoDB

This is the recommended pipeline that preserves all data fields.

### 1. Export from PostgreSQL

**Script**: `scripts/postgres-export/export-postgres-raw.ts`  
**Output**: `data/postgres-backups/YYYY-MM-DD/`

```bash
cd scripts/postgres-export
bun export-postgres-raw.ts
```

Exports all 24 tables from PostgreSQL including:

- `campaigns.json` - 13,417 campaigns with all 20 fields
- `users.json` - 326 users
- `accounts.json` - 9,796 accounts
- `strategies.json` - 13,417 strategies
- `line_items.json` - 4,118 line items

### 2. Transform to MongoDB Schema

**Script**: `scripts/etl/transform-postgres-to-mongodb.ts`  
**Input**: `data/postgres-backups/2025-06-27/`  
**Output**: `data/transformed/2025-06-27-postgres/`

```bash
cd scripts/etl
bun transform-postgres-to-mongodb.ts
```

Transformations applied:

- `budget` → `price` with structure: `{targetAmount, actualAmount, remainingAmount, currency}`
- `impressions` → `units` with `unitType` field
- Split `margin` into `marginAmount` and `marginPercentage`
- Team structure updated with new roles
- Preserves all PostgreSQL fields including `campaignId`, `proposedBudget`, `expectedRevenue`

### 3. Load into MongoDB

**Script**: `scripts/etl/load-new-schema-data.ts`  
**Input**: `data/transformed/2025-06-27-postgres/campaigns-from-postgres.json`  
**Target**: MongoDB `mediatool_v2.campaigns`

```bash
cd scripts/etl
bun load-new-schema-data.ts
```

Actions:

- Backs up existing campaigns
- Clears campaigns collection
- Loads transformed data
- Creates indexes

## Secondary Pipeline: MongoDB → MongoDB

Used for transforming existing MongoDB data to new schema (limited by missing fields).

### 1. Convert Schema

**Script**: `scripts/etl/convert-to-new-schema.ts`  
**Input**: `data/mongodb-exports/2025-06-18/campaigns_backup.json`  
**Output**: `data/transformed/2025-06-18-mongodb/campaigns-new-schema.json`

```bash
cd scripts/etl
bun convert-to-new-schema.ts
```

⚠️ **Warning**: This pipeline cannot recover fields that were lost in the original PostgreSQL → MongoDB transformation.

## Complete Workflow Commands

### Full PostgreSQL → MongoDB Pipeline

```bash
# 1. Export from PostgreSQL (if needed)
cd scripts/postgres-export
bun export-postgres-raw.ts

# 2. Transform to MongoDB format
cd ../etl
bun transform-postgres-to-mongodb.ts

# 3. Load into MongoDB
bun load-new-schema-data.ts
```

### Quick MongoDB Schema Update

```bash
cd scripts/etl
bun convert-to-new-schema.ts
bun load-new-schema-data.ts
```

## Field Mappings

### Campaign Fields

| PostgreSQL         | MongoDB (New Schema) | Notes               |
| ------------------ | -------------------- | ------------------- |
| `id`               | `campaignId`         | Zoho ID preserved   |
| `campaign_number`  | `campaignNumber`     | e.g., "CN-20"       |
| `campaign_name`    | `name`               |                     |
| `budget`           | `price.targetAmount` | Changed terminology |
| `stage`            | `status`             | Mapped values       |
| `proposed_budget`  | `proposedBudget`     | Preserved           |
| `expected_revenue` | `expectedRevenue`    | Preserved           |
| `goals_kpis`       | `goalsKpis`          | Preserved           |
| `new_business`     | `newBusiness`        | Preserved           |

### Calculated Fields

- `price.actualAmount` - Calculated from spend
- `price.remainingAmount` - `targetAmount - actualAmount`
- `dates.daysElapsed` - Days since campaign start
- `dates.totalDuration` - Total campaign duration
- `metrics.marginAmount` - Calculated from margin percentage
- `metrics.units` - Aggregated from line items

## Validation

After loading data, verify with:

```bash
# Check campaign count
curl http://localhost:3001/api/campaigns | jq '.pagination'

# Check a specific campaign
curl http://localhost:3001/api/campaigns | jq '.data[0]'

# Verify new schema fields
curl http://localhost:3001/api/campaigns | jq '.data[0] | {price, metrics}'
```

## Best Practices

1. **Always use PostgreSQL backup** as the source for new transformations
2. **Create timestamped directories** for each export/transformation
3. **Document field mappings** when creating new transformations
4. **Test with small dataset** before running on full data
5. **Backup MongoDB** before loading new data

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Test connection
psql -h localhost -p 5432 -U postgres -d media_tool -c "SELECT COUNT(*) FROM media_tool.campaigns"
```

### MongoDB Connection Issues

```bash
# Test connection
mongosh mediatool_v2 --eval "db.campaigns.countDocuments()"
```

### Transform Script Errors

- Check input file paths exist
- Verify JSON files are valid
- Check memory usage for large files

## Next Steps

1. **Add validation** - Create scripts to validate data integrity after transformation
2. **Add metrics** - Track transformation performance and data quality
3. **Automate pipeline** - Create scheduled jobs for regular updates
4. **Add monitoring** - Alert on ETL failures or data anomalies
